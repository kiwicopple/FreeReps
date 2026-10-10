package server

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestChatOrigin blocks cross-site reads/writes despite the legacy app-wide permissive CORS middleware.
func TestChatOrigin(t *testing.T) {
	s := &Server{baseURL: "https://protocol.example"}
	for _, tc := range []struct {
		name, origin, site, content string
		allowed                     bool
	}{
		{"same origin", "https://protocol.example", "same-origin", "application/json", true},
		{"native client", "", "", "application/json", true},
		{"foreign origin", "https://evil.example", "", "application/json", false},
		{"opaque origin", "null", "", "application/json", false},
		{"cross site", "", "cross-site", "application/json", false},
		{"form", "https://protocol.example", "same-origin", "text/plain", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "https://protocol.example/api/v1/chat", strings.NewReader(`{}`))
			req = req.WithContext(context.WithValue(req.Context(), userIDKey, 42))
			req.Header.Set("Origin", tc.origin)
			req.Header.Set("Sec-Fetch-Site", tc.site)
			req.Header.Set("Content-Type", tc.content)
			w := httptest.NewRecorder()
			w.Header().Set("Access-Control-Allow-Origin", "*")
			_, allowed := s.chatUser(w, req)
			if allowed != tc.allowed {
				t.Fatalf("allowed=%v", allowed)
			}
			if w.Header().Get("Access-Control-Allow-Origin") != "" || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("chat cache/CORS privacy regression")
			}
		})
	}
}
