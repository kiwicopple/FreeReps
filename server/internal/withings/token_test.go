package withings

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

// AuthorizeURL, ExchangeCode and GetValidToken need a database for the per-user
// credentials. What is testable without one is postToken, which is where the
// Withings-specific handling sits.

// TestPostTokenRequestShape verifies the form the token endpoint receives.
//
// Withings routes both the exchange and the refresh through one endpoint and
// distinguishes them by `action=requesttoken` plus `grant_type`. Omitting
// `action` returns a status-code error rather than a token, and the response
// still arrives with HTTP 200.
func TestPostTokenRequestShape(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if got := r.FormValue("action"); got != "requesttoken" {
			t.Errorf("action = %q, want requesttoken", got)
		}
		if got := r.FormValue("grant_type"); got != "authorization_code" {
			t.Errorf("grant_type = %q, want authorization_code", got)
		}
		if got := r.FormValue("code"); got != "auth-code-123" {
			t.Errorf("code = %q, want auth-code-123", got)
		}
		if got := r.FormValue("client_id"); got != "cid" {
			t.Errorf("client_id = %q, want cid", got)
		}
		if got := r.FormValue("client_secret"); got != "csecret" {
			t.Errorf("client_secret = %q, want csecret", got)
		}
		_, _ = fmt.Fprint(w, `{"status":0,"body":{"userid":"42","access_token":"access-tok",
			"refresh_token":"refresh-tok","token_type":"Bearer","expires_in":10800}}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	tok, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{
		"grant_type": {"authorization_code"},
		"code":       {"auth-code-123"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.AccessToken != "access-tok" || tok.RefreshToken != "refresh-tok" {
		t.Errorf("token pair = %q/%q, want access-tok/refresh-tok", tok.AccessToken, tok.RefreshToken)
	}
	if tok.UserID != "42" {
		t.Errorf("userid = %q, want 42", tok.UserID)
	}
	if tok.ExpiresIn != 10800 {
		t.Errorf("expires_in = %d, want 10800", tok.ExpiresIn)
	}
}

// TestPostTokenErrorInBody verifies that a non-zero status fails the call.
// A failed token request answers HTTP 200 with an empty body; treating that as
// success would store an empty token pair over a working one.
func TestPostTokenErrorInBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":503,"body":{},"error":"Invalid Params: invalid code"}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	_, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{
		"grant_type": {"authorization_code"},
		"code":       {"expired"},
	})
	if err == nil {
		t.Fatal("expected an error for status 503, got nil")
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("error type = %T, want *APIError", err)
	}
	if apiErr.Status != 503 {
		t.Errorf("status = %d, want 503", apiErr.Status)
	}
}

// TestPostTokenRejectsEmptyPair verifies that a status-zero response carrying no
// tokens is rejected.
//
// The refresh token rotates and the previous one dies within hours, so storing
// an empty pair loses the connection with nothing to recover from. Failing here
// leaves the old, still-valid pair in the database.
func TestPostTokenRejectsEmptyPair(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":0,"body":{"userid":"42","expires_in":10800}}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	if _, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{}); err == nil {
		t.Fatal("expected an error for a response without tokens, got nil")
	}
}

// TestPostTokenRefreshSendsRefreshToken verifies the refresh call carries the
// stored refresh token under the grant type the endpoint expects.
func TestPostTokenRefreshSendsRefreshToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if got := r.FormValue("grant_type"); got != "refresh_token" {
			t.Errorf("grant_type = %q, want refresh_token", got)
		}
		if got := r.FormValue("refresh_token"); got != "old-refresh" {
			t.Errorf("refresh_token = %q, want old-refresh", got)
		}
		_, _ = fmt.Fprint(w, `{"status":0,"body":{"access_token":"new-access",
			"refresh_token":"new-refresh","token_type":"Bearer","expires_in":10800}}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	tok, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {"old-refresh"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.RefreshToken != "new-refresh" {
		t.Errorf("refresh_token = %q, want the rotated value new-refresh", tok.RefreshToken)
	}
}

// TestPostTokenAcceptsNumericUserID covers the encoding change that stopped the
// integration: Withings began sending `userid` as a bare number on 2026-08-05,
// and against the previous string field the whole token body failed to decode.
// Every refresh then returned an error, so no measurement arrived for 46 days
// while the sync kept reporting a token problem (INCIDENTS.md, 2026-09-20).
func TestPostTokenAcceptsNumericUserID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":0,"body":{"userid":33445566,"access_token":"access-tok",
			"refresh_token":"refresh-tok","token_type":"Bearer","expires_in":10800}}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	tok, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {"old-refresh"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.UserID != "33445566" {
		t.Errorf("userid = %q, want 33445566", tok.UserID)
	}
	if tok.AccessToken != "access-tok" || tok.RefreshToken != "refresh-tok" {
		t.Errorf("token pair = %q/%q, want access-tok/refresh-tok", tok.AccessToken, tok.RefreshToken)
	}
}

// TestPostTokenAcceptsQuotedUserID keeps the earlier encoding covered, because
// the fix has to read both forms rather than replace one with the other.
func TestPostTokenAcceptsQuotedUserID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":0,"body":{"userid":"42","access_token":"access-tok",
			"refresh_token":"refresh-tok","token_type":"Bearer","expires_in":10800}}`)
	}))
	defer srv.Close()

	tm := &TokenManager{httpClient: srv.Client(), tokenURL: srv.URL}
	tok, err := tm.postToken(context.Background(), "cid", "csecret", url.Values{
		"grant_type": {"refresh_token"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.UserID != "42" {
		t.Errorf("userid = %q, want 42", tok.UserID)
	}
}
