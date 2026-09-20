package storage

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// DailyPoint is one day's aggregated value for one metric.
type DailyPoint struct {
	Day   time.Time
	Value float64
}

// DashboardMetric carries everything the front page shows for one metric, so
// the whole screen is one request rather than one per panel.
type DashboardMetric struct {
	MetricName string    `json:"metric_name"`
	Units      string    `json:"units"`
	Source     string    `json:"source"`
	Time       time.Time `json:"time"`
	Latest     *float64  `json:"latest"`
	// Mean of the last 7 days minus the mean of the 7 before it. Averaging both
	// windows keeps a single noisy reading from reading as a trend.
	Delta7d *float64 `json:"delta_7d"`
	// The same change relative to the earlier window. The front page shows this
	// instead of Delta7d for cumulative metrics, where an absolute step count
	// difference says less than a percentage.
	Delta7dPct *float64 `json:"delta_7d_pct"`
	// The 5th and 95th percentile over the window. Percentiles rather than
	// min/max, so one dropped sensor reading does not widen the stated range.
	RangeLow  *float64 `json:"range_low"`
	RangeHigh *float64 `json:"range_high"`
	// One value per day over the window, oldest first, null on days with no
	// samples. The sparkline is drawn from this; no second request is needed.
	Series []*float64 `json:"series"`
}

// GetDailySeries returns per-day aggregated values for several metrics in one
// query. Cumulative metrics are summed per day, the rest averaged over their
// 5-minute window averages, matching GetTimeSeries. Each metric resolves its
// source with its own category priority first.
func (db *DB) GetDailySeries(ctx context.Context, userID int, metricNames []string, start, end time.Time) (map[string][]DailyPoint, error) {
	if len(metricNames) == 0 {
		return map[string][]DailyPoint{}, nil
	}

	params := make([]string, len(metricNames))
	args := make([]any, 0, len(metricNames)+1)
	args = append(args, userID)
	for i, name := range metricNames {
		params[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, name)
	}
	// Literals, not parameters: the planner has to see the bounds to exclude
	// chunks while planning. See sqlTimestamp.
	startParam := sqlTimestamp(start)
	endParam := sqlTimestamp(end)

	inClause := strings.Join(params, ",")
	// The range belongs inside the CTE: outside it, the window function runs
	// over the user's whole history before the filter applies.
	cte := dedupCTEMultiMetricRange(
		db.resolvePrioritiesFor(ctx, userID, metricNames), metricNames,
		"$1", inClause, startParam, endParam)

	// One CASE covers both aggregations: metric_name is in the GROUP BY, so the
	// branch is decided per group rather than per row. The inner stage computes
	// both candidates per 5-minute window; summing the window sums is the range
	// total, averaging the window averages weighs every window alike.
	cumulative := make([]string, 0, len(metricNames))
	for _, name := range metricNames {
		if cumulativeMetrics[name] {
			cumulative = append(cumulative, quoteLiteral(name))
		}
	}
	sort.Strings(cumulative)
	aggExpr := "AVG(mean)"
	if len(cumulative) > 0 {
		aggExpr = fmt.Sprintf(
			"CASE WHEN metric_name IN (%s) THEN SUM(total) ELSE AVG(mean) END",
			strings.Join(cumulative, ","))
	}

	query := fmt.Sprintf(
		`%s, windowed AS (
			SELECT metric_name,
			       time_bucket('1 day', time) AS day,
			       %s AS sub,
			       SUM(COALESCE(qty, avg_val)) AS total,
			       AVG(COALESCE(qty, avg_val)) AS mean
			FROM deduped
			WHERE rn = 1
			GROUP BY metric_name, day, sub
		)
		SELECT metric_name, day, %s AS val
		 FROM windowed
		 GROUP BY metric_name, day
		 HAVING %s IS NOT NULL
		 ORDER BY metric_name, day ASC`,
		cte, dedupBucket, aggExpr, aggExpr)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying daily series: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]DailyPoint, len(metricNames))
	for rows.Next() {
		var name string
		var p DailyPoint
		if err := rows.Scan(&name, &p.Day, &p.Value); err != nil {
			return nil, fmt.Errorf("scanning daily series: %w", err)
		}
		result[name] = append(result[name], p)
	}
	return result, rows.Err()
}

// DeltaWindowDays is how far back each side of the 7-day delta reaches. The
// query always covers at least this much, so a 1d or 7d view still has two full
// windows to compare.
const DeltaWindowDays = 14

// BuildDashboardMetric derives the delta, range and sparkline series a front
// page row needs from one metric's daily points.
//
// bufferDays is the length of the queried window; seriesDays is how much of its
// tail the screen shows. They differ when the selected range is shorter than
// the delta needs — the delta is always computed over the full buffer, while
// the series and the stated range follow the selection.
func BuildDashboardMetric(points []DailyPoint, start time.Time, bufferDays, seriesDays int) (series []*float64, delta, deltaPct, low, high *float64) {
	buffer := make([]*float64, bufferDays)
	startDay := start.Truncate(24 * time.Hour)
	for _, p := range points {
		idx := int(p.Day.Truncate(24*time.Hour).Sub(startDay) / (24 * time.Hour))
		if idx >= 0 && idx < bufferDays {
			v := p.Value
			buffer[idx] = &v
		}
	}

	if seriesDays > bufferDays {
		seriesDays = bufferDays
	}
	series = buffer[bufferDays-seriesDays:]

	// The stated range describes what the screen shows, so it reads the series
	// rather than the whole buffer.
	values := make([]float64, 0, len(series))
	for _, v := range series {
		if v != nil {
			values = append(values, *v)
		}
	}
	if len(values) > 0 {
		low, high = percentileRange(values, 0.05, 0.95)
	}

	recent := windowMean(buffer, bufferDays-7, bufferDays)
	prior := windowMean(buffer, bufferDays-DeltaWindowDays, bufferDays-7)
	if recent != nil && prior != nil {
		d := *recent - *prior
		delta = &d
		if *prior != 0 {
			pct := d / math.Abs(*prior)
			deltaPct = &pct
		}
	}
	return series, delta, deltaPct, low, high
}

// windowMean averages the non-null slots in [from, to). Returns nil when the
// window holds no samples at all.
func windowMean(series []*float64, from, to int) *float64 {
	if from < 0 {
		from = 0
	}
	if to > len(series) {
		to = len(series)
	}
	var sum float64
	var n int
	for i := from; i < to; i++ {
		if series[i] != nil {
			sum += *series[i]
			n++
		}
	}
	if n == 0 {
		return nil
	}
	mean := sum / float64(n)
	return &mean
}

// percentileRange returns two percentiles by linear interpolation.
func percentileRange(values []float64, lowP, highP float64) (*float64, *float64) {
	if len(values) == 0 {
		return nil, nil
	}
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	lo := percentile(sorted, lowP)
	hi := percentile(sorted, highP)
	return &lo, &hi
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 1 {
		return sorted[0]
	}
	pos := p * float64(len(sorted)-1)
	lower := int(math.Floor(pos))
	upper := int(math.Ceil(pos))
	// Interpolating between two equal values would introduce float error, so a
	// flat stretch reports its own value rather than one ulp beside it.
	if lower == upper || sorted[lower] == sorted[upper] {
		return sorted[lower]
	}
	frac := pos - float64(lower)
	return sorted[lower]*(1-frac) + sorted[upper]*frac
}
