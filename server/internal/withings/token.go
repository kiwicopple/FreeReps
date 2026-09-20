package withings

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/claude/freereps/internal/storage"
)

const (
	defaultAuthorizeURL = "https://account.withings.com/oauth2_user/authorize2"
	defaultTokenURL     = "https://wbsapi.withings.net/v2/oauth2"

	// Only measurements are read. Sleep, activity and workouts come from Oura
	// and Hevy, and an unused scope is consent the user is asked for for nothing.
	withingsScopes = "user.metrics"

	// refreshBuffer is how far before expiry the token is refreshed proactively.
	// Withings access tokens live three hours, so in practice almost every sync
	// cycle refreshes.
	refreshBuffer = 5 * time.Minute
)

// TokenManager handles OAuth2 token exchange and refresh for the Withings API.
// Client credentials are loaded per-user from the database.
type TokenManager struct {
	db           *storage.DB
	httpClient   *http.Client
	authorizeURL string
	tokenURL     string
}

// NewTokenManager creates a new token manager.
func NewTokenManager(db *storage.DB) *TokenManager {
	return &TokenManager{
		db:           db,
		httpClient:   &http.Client{Timeout: 15 * time.Second},
		authorizeURL: defaultAuthorizeURL,
		tokenURL:     defaultTokenURL,
	}
}

// AuthorizeURL returns the Withings OAuth2 authorization URL for user consent.
func (tm *TokenManager) AuthorizeURL(ctx context.Context, userID int, redirectURI, state string) (string, error) {
	stored, err := tm.db.GetWithingsToken(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("getting withings credentials: %w", err)
	}
	if stored == nil || stored.ClientID == "" {
		return "", fmt.Errorf("no withings credentials configured for user %d", userID)
	}

	params := url.Values{
		"response_type": {"code"},
		"client_id":     {stored.ClientID},
		"redirect_uri":  {redirectURI},
		"scope":         {withingsScopes},
		"state":         {state},
	}
	return tm.authorizeURL + "?" + params.Encode(), nil
}

// ExchangeCode exchanges an OAuth2 authorization code for tokens and stores them.
// The code is valid for 30 seconds, so this runs directly in the callback with
// nothing deferrable in front of it.
func (tm *TokenManager) ExchangeCode(ctx context.Context, code, redirectURI string, userID int) error {
	stored, err := tm.db.GetWithingsToken(ctx, userID)
	if err != nil {
		return fmt.Errorf("getting withings credentials: %w", err)
	}
	if stored == nil || stored.ClientID == "" {
		return fmt.Errorf("no withings credentials for user %d", userID)
	}

	tok, err := tm.postToken(ctx, stored.ClientID, stored.ClientSecret, url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {redirectURI},
	})
	if err != nil {
		return fmt.Errorf("exchanging code: %w", err)
	}

	return tm.storeToken(ctx, userID, tok)
}

// GetValidToken returns a valid access token, refreshing if close to expiry.
//
// The refresh token rotates: the response carries a new one and the previous
// value stops working once the new access token is used. The new pair is
// therefore persisted before the access token is handed out, and a failed write
// fails the call rather than letting the caller proceed with a token whose
// refresh counterpart is already lost.
func (tm *TokenManager) GetValidToken(ctx context.Context, userID int) (string, error) {
	stored, err := tm.db.GetWithingsToken(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("getting stored token: %w", err)
	}
	if stored == nil || stored.AccessToken == "" {
		return "", fmt.Errorf("no withings token for user %d", userID)
	}

	if time.Until(stored.ExpiresAt) > refreshBuffer {
		return stored.AccessToken, nil
	}

	tok, err := tm.postToken(ctx, stored.ClientID, stored.ClientSecret, url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {stored.RefreshToken},
	})
	if err != nil {
		return "", fmt.Errorf("refreshing token: %w", err)
	}

	if err := tm.storeToken(ctx, userID, tok); err != nil {
		return "", fmt.Errorf("storing refreshed token: %w", err)
	}
	return tok.AccessToken, nil
}

// Disconnect removes Withings credentials, tokens and sync state for a user.
func (tm *TokenManager) Disconnect(ctx context.Context, userID int) error {
	if err := tm.db.DeleteWithingsSyncStates(ctx, userID); err != nil {
		return err
	}
	return tm.db.DeleteWithingsToken(ctx, userID)
}

// storeToken persists a token response, preserving the client credentials.
func (tm *TokenManager) storeToken(ctx context.Context, userID int, tok *tokenBody) error {
	tokenType := tok.TokenType
	if tokenType == "" {
		tokenType = "Bearer"
	}
	return tm.db.UpsertWithingsToken(ctx, storage.WithingsToken{
		UserID:         userID,
		AccessToken:    tok.AccessToken,
		RefreshToken:   tok.RefreshToken,
		TokenType:      tokenType,
		ExpiresAt:      time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second),
		WithingsUserID: string(tok.UserID),
	})
}

// postToken performs a POST to the Withings token endpoint with per-user client
// credentials. Like every other endpoint it answers HTTP 200 on failure and
// reports the outcome in the body.
func (tm *TokenManager) postToken(ctx context.Context, clientID, clientSecret string, form url.Values) (*tokenBody, error) {
	form.Set("action", "requesttoken")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tm.tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("creating token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := tm.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing token request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading token response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, &APIError{Action: "requesttoken", Status: resp.StatusCode, Body: string(body)}
	}

	var env Response
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("decoding token response: %w", err)
	}
	if env.Status != statusOK {
		detail := env.Error
		if detail == "" {
			detail = string(body)
		}
		return nil, &APIError{Action: "requesttoken", Status: env.Status, Body: detail}
	}

	var tok tokenBody
	if err := json.Unmarshal(env.Body, &tok); err != nil {
		return nil, fmt.Errorf("decoding token body: %w", err)
	}
	if tok.AccessToken == "" || tok.RefreshToken == "" {
		return nil, fmt.Errorf("token response carried no token pair")
	}
	return &tok, nil
}
