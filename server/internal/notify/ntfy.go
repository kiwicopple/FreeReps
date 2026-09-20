// Package notify posts machine-readable alerts to an ntfy topic, in the shape
// Uptime Kuma's webhook notification produces. A consumer that already parses
// Kuma's webhooks therefore needs no second parser, which is the reason for
// following someone else's field names rather than inventing better ones.
//
// The four required fields — `schema` (the number 1), `monitor_id` (a number),
// `service` (a non-empty string) and `status` (0 = problem, 1 = resolved) — are
// required because a consumer that filters on them drops a message missing one
// of them, and it drops it on its own side: the sender sees a 200 from ntfy and
// nothing else. Send therefore rejects such a payload here, where the reason is
// visible. `hostname`, `monitor_type`, `since` and `msg` are optional.
//
// `monitor_id` identifies the condition, not the firing. A consumer is free to
// group messages by it — an alerting UI shows one row per id, a chat bot one
// thread — and two conditions sharing an id become indistinguishable there.
//
// The deployment this was built for documents its receiving side in its own
// infrastructure repository; nothing in this package depends on that document.

package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Status values as the adapter reads them.
const (
	StatusProblem  = 0
	StatusResolved = 1
)

// Payload is one message on the topic.
type Payload struct {
	Schema      int    `json:"schema"`
	MonitorID   int    `json:"monitor_id"`
	Service     string `json:"service"`
	Status      int    `json:"status"`
	Hostname    string `json:"hostname,omitempty"`
	MonitorType string `json:"monitor_type,omitempty"`
	Since       string `json:"since,omitempty"`
	Msg         string `json:"msg,omitempty"`
}

// Target is where a payload goes. It is passed per call rather than held by the
// Notifier because the channel is configured in the Settings UI: an edit has to
// take effect on the next check, without a restart.
type Target struct {
	// URL is the full topic URL, e.g. https://ntfy.example.com/freereps-alerts
	URL string
	// Hostname fills the payload's `hostname`, naming the deployment the alert
	// came from.
	Hostname string
}

// Sender posts an alert. The watcher takes this interface so its rules can be
// tested without an HTTP server.
type Sender interface {
	Send(ctx context.Context, target Target, p Payload) error
}

// Notifier posts payloads over HTTP.
type Notifier struct {
	httpClient *http.Client
	log        *slog.Logger
}

// New returns a Notifier.
func New(log *slog.Logger) *Notifier {
	return &Notifier{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		log:        log,
	}
}

// Send posts one payload. It fills the fields the contract requires and this
// package owns — `schema`, `hostname`, `monitor_type` and, when the caller left
// it empty, `since`.
//
// A payload a consumer would drop is rejected here instead of being sent, so the
// failure names the missing field rather than surfacing as an alert that was
// never delivered.
func (n *Notifier) Send(ctx context.Context, target Target, p Payload) error {
	if target.URL == "" {
		return fmt.Errorf("no ntfy url configured")
	}
	if p.MonitorID == 0 {
		return fmt.Errorf("monitor_id is required")
	}
	if p.Service == "" {
		return fmt.Errorf("service is required")
	}
	if p.Status != StatusProblem && p.Status != StatusResolved {
		return fmt.Errorf("status must be %d or %d, got %d", StatusProblem, StatusResolved, p.Status)
	}

	p.Schema = 1
	if p.Hostname == "" {
		p.Hostname = target.Hostname
	}
	if p.MonitorType == "" {
		p.MonitorType = "freereps"
	}
	if p.Since == "" {
		p.Since = time.Now().UTC().Format(time.RFC3339)
	}

	body, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshalling alert: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target.URL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating alert request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("posting alert: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("ntfy answered %d", resp.StatusCode)
	}

	n.log.Info("alert sent",
		"monitor_id", p.MonitorID,
		"service", p.Service,
		"status", p.Status,
	)
	return nil
}
