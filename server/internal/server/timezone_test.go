package server

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
)

// A selected date is a local calendar day, including 23/25-hour DST days, not UTC or server time.
func TestTravelTimeRanges(t *testing.T) {
	for _, tc := range []struct{ zone, date, start, end string }{
		{"America/Los_Angeles", "2025-03-09", "2025-03-09T08:00:00Z", "2025-03-10T07:00:00Z"},
		{"America/New_York", "2025-11-02", "2025-11-02T04:00:00Z", "2025-11-03T05:00:00Z"},
		{"Asia/Singapore", "2025-01-15", "2025-01-14T16:00:00Z", "2025-01-15T16:00:00Z"},
		{"", "2025-01-15", "2025-01-15T00:00:00Z", "2025-01-16T00:00:00Z"},
	} {
		t.Run(tc.zone+tc.date, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/?start="+tc.date+"&end="+tc.date+"&timezone="+tc.zone, nil)
			start, end, err := parseTimeRange(req)
			if err != nil {
				t.Fatal(err)
			}
			if start.UTC().Format(time.RFC3339) != tc.start || end.UTC().Format(time.RFC3339) != tc.end {
				t.Fatalf("range = %s..%s", start, end)
			}
			a, b := localDayWindow(start.Add(time.Hour), start.Location(), 1)
			if !a.Equal(start) || !b.Equal(end) {
				t.Fatalf("dashboard window = %s..%s", a, b)
			}
		})
	}
}

// Changing the grouping zone must not shift the absolute HR window or accept server-local ambiguity.
func TestTravelAbsoluteTimesAndInvalidZones(t *testing.T) {
	req := httptest.NewRequest("GET", "/?start=2025-01-15T06:00:00Z&end=2025-01-15T14:00:00Z&timezone=America/Los_Angeles", nil)
	start, end, err := parseTimeRange(req)
	if err != nil || start.UTC().Hour() != 6 || end.UTC().Hour() != 14 || start.Location().String() != "America/Los_Angeles" {
		t.Fatalf("absolute window changed: %v %v %v", start, end, err)
	}
	for _, zone := range []string{"Local", "Invalid/Zone"} {
		_, _, err := parseTimeRange(httptest.NewRequest("GET", "/?timezone="+zone, nil))
		if err == nil {
			t.Fatalf("accepted invalid zone %s", zone)
		}
	}
}

// A US night recorded under its bedtime date continues beyond midnight UTC.
func TestSleepStagesFollowSessionInstants(t *testing.T) {
	start := time.Date(2025, 1, 14, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 1)
	session := storage.SleepSessionResult{SleepSessionRow: models.SleepSessionRow{SleepStart: end.Add(6 * time.Hour), SleepEnd: end.Add(14 * time.Hour)}}
	a, b := sleepStageWindow(start, end, []storage.SleepSessionResult{session})
	if !a.Equal(start) || !b.Equal(session.SleepEnd) {
		t.Fatalf("missing part of US night: %v..%v", a, b)
	}
}
