package chat

import (
	"bytes"
	"context"
	"github.com/claude/freereps/internal/models"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Diagnostics must expose request progress without exposing messages, photos,
// provider bodies or credentials, and must turn off independently of other logs.
func TestDiagnosticPrivacy(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	defer slog.SetDefault(previous)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		_, _ = w.Write([]byte("PRIVATE_PROVIDER_BODY"))
	}))
	defer provider.Close()
	client := NewClient()
	client.URL = provider.URL
	client.HTTP = provider.Client()
	for _, enabled := range []string{"0", "1"} {
		t.Setenv("PROTOCOL_CHAT_VERBOSE", enabled)
		logs.Reset()
		_, err := client.Generate(DiagnosticContext(context.Background()), "PRIVATE_KEY", Input{Request: models.ChatRequest{Message: "PRIVATE_MEAL", Images: []string{"data:image/png;base64,PRIVATE_IMAGE"}}})
		if err == nil {
			t.Fatal("expected provider failure")
		}
		text := logs.String()
		if enabled == "0" && text != "" {
			t.Fatal("diagnostics not disabled")
		}
		if enabled == "1" {
			for _, want := range []string{"generation.started", "provider.attempt", "provider.response", "generation.finished", `"photos":1`, `"status":500`, `"trace":"`} {
				if !strings.Contains(text, want) {
					t.Errorf("missing diagnostic %s", want)
				}
			}
		}
		for _, secret := range []string{"PRIVATE_KEY", "PRIVATE_MEAL", "PRIVATE_IMAGE", "PRIVATE_PROVIDER_BODY"} {
			if strings.Contains(text, secret) {
				t.Fatal("private content leaked")
			}
		}
	}
}
