//go:build integration

package storage

import (
	"context"
	"testing"
	"time"

	"github.com/claude/freereps/internal/models"
)

// A local day spanning two UTC dates must use one source and one bucket. Exercise
// actual SQL across both DST transitions and Singapore, with invented readings only.
func TestTravelDailyAggregation(t *testing.T) {
	for _, tc := range []struct {
		zone  string
		month time.Month
		day   int
	}{
		{"America/Los_Angeles", time.March, 8}, {"America/New_York", time.November, 1}, {"Asia/Singapore", time.January, 14},
	} {
		t.Run(tc.zone, func(t *testing.T) {
			db := aggTestDB(t)
			ctx := context.Background()
			loc, err := time.LoadLocation(tc.zone)
			if err != nil {
				t.Fatal(err)
			}
			start := time.Date(2025, tc.month, tc.day, 0, 0, 0, 0, loc)
			end := start.AddDate(0, 0, 3)
			var rows []models.HealthMetricRow
			for i := 0; i < 3; i++ {
				day := start.AddDate(0, 0, i)
				rows = append(rows, row(day.Add(time.Hour), "step_count", "", float64(10+i)), row(day.AddDate(0, 0, 1).Add(-time.Hour), "step_count", "", float64(20+i)), row(day.Add(12*time.Hour), "step_count", "Oura", 999), row(day.Add(2*time.Hour), "heart_rate", "", float64(60+i)))
			}
			insert(t, db, rows)
			if err := db.UpsertSourcePriority(ctx, aggTestUser, "activity", []string{"", "Oura"}); err != nil {
				t.Fatal(err)
			}
			points, err := db.GetTimeSeries(ctx, "step_count", start, end, "1 day", aggTestUser)
			if err != nil {
				t.Fatal(err)
			}
			daily, err := db.GetDailySeries(ctx, aggTestUser, []string{"step_count", "heart_rate"}, start, end)
			if err != nil {
				t.Fatal(err)
			}
			series, _, _, _, _ := BuildDashboardMetric(daily["step_count"], start, 3, 3)
			if len(points) != 3 || len(daily["step_count"]) != 3 {
				t.Fatalf("wrong daily buckets: %v %v", points, daily)
			}
			for i, p := range points {
				want := float64(30 + 2*i)
				if !p.Time.Equal(start.AddDate(0, 0, i)) || p.Avg == nil || *p.Avg != want || series[i] == nil || *series[i] != want {
					t.Fatalf("day %d: %v, dashboard %v; want %v", i, p, series, want)
				}
			}
			stats, err := db.GetMetricStats(ctx, "step_count", start, end, aggTestUser)
			if err != nil {
				t.Fatal(err)
			}
			if stats.Avg == nil || *stats.Avg != 96 {
				t.Fatalf("range total = %v", stats)
			}
			correlation, err := db.GetCorrelation(ctx, "step_count", "heart_rate", start, end, "1 day", aggTestUser)
			if err != nil {
				t.Fatal(err)
			}
			if correlation.Count != 3 || correlation.PearsonR == nil || !nearly(*correlation.PearsonR, 1) {
				t.Fatalf("local day pairing = %v", correlation)
			}
		})
	}
}
