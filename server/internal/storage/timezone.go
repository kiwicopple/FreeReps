package storage

import "time"

// Keep UTC SQL for legacy callers; IANA zones align days to local midnight, including DST.
// Locations come from Go's time.LoadLocation, never an unvalidated SQL fragment.
func timeBucketSQL(width string, locations ...*time.Location) string {
	if len(locations) == 0 || locations[0] == nil || locations[0].String() == "" || locations[0] == time.UTC {
		return "time_bucket(" + width + ", time)"
	}
	return "time_bucket(" + width + ", time, " + quoteLiteral(locations[0].String()) + ")"
}
