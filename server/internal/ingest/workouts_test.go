package ingest

import "testing"

// TestNormalizeWorkoutName verifies that workout names from different sources
// (German Apple Health, English Apple Health, Oura lowercase) are all mapped
// to canonical English names, while unknown names pass through unchanged.
func TestNormalizeWorkoutName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		// German (Apple Health localized)
		{"Traditionelles Krafttraining", "Traditional Strength Training"},
		{"Outdoor Radfahren", "Cycling"},
		{"Innenräume Radfahren", "Cycling"},
		{"Schwimmbad Schwimmen", "Swimming"},
		{"Freiwasser Schwimmen", "Swimming"},
		{"Wandern", "Hiking"},
		// Unprefixed German names: Health Auto Export delivered "Radfahren"
		// without a location prefix on 2026-09-20, and the missing entry put a
		// second name on a sport that already had 276 rows as "Cycling".
		{"Radfahren", "Cycling"},
		// English (Apple Health, location-prefixed)
		{"Indoor Cycling", "Cycling"},
		{"Outdoor Walk", "Walking"},
		// "Dance" is Apple's name, "Dancing" the canonical one from Oura.
		{"Dance", "Dancing"},
		// Oura (lowercase)
		{"walking", "Walking"},
		{"yoga", "Yoga"},
		{"cycling", "Cycling"},
		{"hiking", "Hiking"},
		{"strength_training", "Strength Training"},
		{"yardwork", "Yard Work"},
		// Already-canonical names pass through unchanged
		{"Cycling", "Cycling"},
		{"Running", "Running"},
		{"Tennis", "Tennis"},
		{"Underwater Diving", "Underwater Diving"},
		{"Some Future Workout", "Some Future Workout"},
	}

	for _, tt := range tests {
		got := NormalizeWorkoutName(tt.input)
		if got != tt.want {
			t.Errorf("NormalizeWorkoutName(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
