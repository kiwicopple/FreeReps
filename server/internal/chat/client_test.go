package chat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/claude/freereps/internal/models"
)

// TestGenerateWireContract catches provider-format regressions without transmitting any real records or credentials.
func TestGenerateWireContract(t *testing.T) {
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk-synthetic" {
			t.Error("missing server-side key")
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["store"] != false || body["model"] != DefaultModel {
			t.Error("provider persistence/model changed")
		}
		encoded, _ := json.Marshal(body)
		for _, want := range []string{"input_image", "data:image/png;base64,synthetic", "America/Los_Angeles", "2025-01-14", "json_schema", "food_record", "prior reply"} {
			if !strings.Contains(string(encoded), want) {
				t.Errorf("missing %s", want)
			}
		}
		if strings.Contains(string(encoded), "sk-synthetic") {
			t.Error("key included in model context")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"reply\":\"Which items did you eat?\",\"food_record\":null}"}]}]}`))
	}))
	defer provider.Close()
	client := NewClient()
	client.URL = provider.URL
	client.HTTP = provider.Client()
	got, err := client.Generate(context.Background(), "sk-synthetic", Input{Request: models.ChatRequest{Message: "Synthetic menu", Images: []string{"data:image/png;base64,synthetic"}, Timezone: "America/Los_Angeles", LocalDate: "2025-01-14"}, History: []models.ChatTurn{{ID: "old", Message: "prior", Reply: "prior reply", Status: "complete"}}})
	if err != nil || got.Reply != "Which items did you eat?" || got.FoodJSON != nil {
		t.Fatalf("%+v %v", got, err)
	}
}

// TestProviderFailures cannot turn a refusal, truncated generation, or leaked provider error into a nutrition mutation.
func TestProviderFailures(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
	}{
		{"invalid key", 401, "sk-private-secret"}, {"quota", 429, "private provider error"},
		{"server", 500, "private provider error"}, {"truncated", 200, `{"status":"incomplete"}`},
		{"refusal", 200, `{"status":"completed","output":[{"type":"message","content":[{"type":"refusal"}]}]}`},
		{"malformed", 200, `{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"not json"}]}]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer provider.Close()
			client := NewClient()
			client.URL = provider.URL
			client.HTTP = provider.Client()
			result, err := client.Generate(context.Background(), "sk-private-secret", Input{})
			if err == nil || result.FoodJSON != nil {
				t.Fatal("accepted failure")
			}
			if strings.Contains(err.Error(), "private") {
				t.Fatal("leaked raw error")
			}
		})
	}
}
