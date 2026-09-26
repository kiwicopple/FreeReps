package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/claude/freereps/internal/storage"
)

// Old clients keep UTC. The dashboard supplies the device's IANA zone on every request.
func requestTimeZone(r *http.Request) (*time.Location, error) {
	name := r.URL.Query().Get("timezone")
	if name == "" {
		return time.UTC, nil
	}
	if name == "Local" {
		return nil, fmt.Errorf("timezone must be an IANA name")
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone")
	}
	return loc, nil
}

func localDayWindow(now time.Time, loc *time.Location, days int) (time.Time, time.Time) {
	now = now.In(loc)
	end := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, loc)
	return end.AddDate(0, 0, -days), end
}

// Recorded night labels are dates, but their stages may extend into another UTC day.
func sleepStageWindow(start, end time.Time, sessions []storage.SleepSessionResult) (time.Time, time.Time) {
	for _, session := range sessions {
		if !session.SleepStart.IsZero() && session.SleepStart.Before(start) {
			start = session.SleepStart
		}
		if session.SleepEnd.After(end) {
			end = session.SleepEnd
		}
	}
	return start, end
}
