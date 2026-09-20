package server

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"
)

// TestCallbackURLFromRequest covers how the OAuth redirect URI is built when
// nothing is configured. It has to match the origin the user reached the UI on,
// because that is the origin the provider redirects back to — and the provider
// compares the value sent at the start of the flow with the one sent when the
// code is exchanged, so a difference between the two ends the flow at the last
// step with a rejected redirect_uri.
func TestCallbackURLFromRequest(t *testing.T) {
	s := &Server{}

	// tsnet serves TLS, so the request carries a TLS state and no proxy headers.
	req := httptest.NewRequest("GET", "/api/v1/oura/authorize", nil)
	req.Host = "freereps.example.ts.net"
	req.TLS = &tls.ConnectionState{}
	if got := s.callbackURL(req, "/oura/callback"); got != "https://freereps.example.ts.net/oura/callback" {
		t.Errorf("tsnet request: %q", got)
	}

	// Local development without TLS has to yield http, or the provider rejects a
	// URI whose scheme does not match the registered one.
	plain := httptest.NewRequest("GET", "/api/v1/oura/authorize", nil)
	plain.Host = "localhost:8080"
	if got := s.callbackURL(plain, "/oura/callback"); got != "http://localhost:8080/oura/callback" {
		t.Errorf("plain request: %q", got)
	}
}

// TestCallbackURLBehindProxy covers a reverse proxy that terminates TLS and
// forwards plain HTTP: without honouring the headers the URI would carry the
// wrong scheme, and with a rewritten host also the wrong host.
func TestCallbackURLBehindProxy(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest("GET", "/api/v1/withings/authorize", nil)
	req.Host = "freereps.internal:8080"
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("X-Forwarded-Host", "health.example.com")

	if got := s.callbackURL(req, "/withings/callback"); got != "https://health.example.com/withings/callback" {
		t.Errorf("proxied request: %q", got)
	}
}

// TestCallbackURLOverride is the case the configuration exists for: the UI is
// reachable under several names while the provider accepts one registered URI.
func TestCallbackURLOverride(t *testing.T) {
	s := &Server{}
	s.SetBaseURL("https://freereps.example.ts.net/")

	req := httptest.NewRequest("GET", "/api/v1/oura/authorize", nil)
	req.Host = "localhost:8080"

	if got := s.callbackURL(req, "/oura/callback"); got != "https://freereps.example.ts.net/oura/callback" {
		t.Errorf("override ignored: %q", got)
	}
}
