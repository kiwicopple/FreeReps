package server

import "testing"

// TestValidateAlertSettings covers the inputs the Settings form can produce. The
// topic path is the case worth a test: juno subscribes to one topic, so a URL
// saved without it (`https://ntfy…/`) posts into a topic nobody reads, and the
// channel then looks configured while reporting nowhere.
func TestValidateAlertSettings(t *testing.T) {
	valid := alertSettingsBody{
		Enabled:          true,
		NtfyURL:          "https://ntfy.coydog-fence.ts.net/kuma-json",
		Hostname:         "freereps",
		CheckIntervalSec: 300,
		FailureThreshold: 3,
		AppleSilenceSec:  129600,
	}

	if msg := validateAlertSettings(valid); msg != "" {
		t.Errorf("valid settings rejected: %s", msg)
	}

	tests := []struct {
		name  string
		mutit func(b *alertSettingsBody)
	}{
		{"no topic in the url", func(b *alertSettingsBody) { b.NtfyURL = "https://ntfy.coydog-fence.ts.net/" }},
		{"no url while enabled", func(b *alertSettingsBody) { b.NtfyURL = "" }},
		{"not an http url", func(b *alertSettingsBody) { b.NtfyURL = "ntfy://host/topic" }},
		{"threshold below one", func(b *alertSettingsBody) { b.FailureThreshold = 0 }},
		{"interval below the floor", func(b *alertSettingsBody) { b.CheckIntervalSec = 30 }},
		{"silence between off and an hour", func(b *alertSettingsBody) { b.AppleSilenceSec = 600 }},
	}
	for _, tt := range tests {
		b := valid
		tt.mutit(&b)
		if msg := validateAlertSettings(b); msg == "" {
			t.Errorf("%s: accepted", tt.name)
		}
	}

	// A disabled channel is only checked for storable numbers: the URL field may
	// be empty while reporting is off.
	off := valid
	off.Enabled = false
	off.NtfyURL = ""
	if msg := validateAlertSettings(off); msg != "" {
		t.Errorf("disabled settings without a url rejected: %s", msg)
	}

	// Zero turns the Apple Health rule off and has to pass.
	noSilence := valid
	noSilence.AppleSilenceSec = 0
	if msg := validateAlertSettings(noSilence); msg != "" {
		t.Errorf("apple_silence_sec = 0 rejected: %s", msg)
	}
}
