package chat

import (
	"context"
	"log/slog"
	"os"

	"github.com/google/uuid"
)

type diagnosticKey struct{}

// DiagnosticContext correlates one HTTP attempt without using a user or meal ID.
func DiagnosticContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, diagnosticKey{}, uuid.NewString())
}

// Diagnostic accepts only developer-selected metadata, never request/response
// bodies, error strings, credentials, or image bytes. Enable independently of
// global debug logging so other integrations cannot expose their payloads.
func Diagnostic(ctx context.Context, event string, attrs ...any) {
	if os.Getenv("PROTOCOL_CHAT_VERBOSE") != "1" {
		return
	}
	trace, _ := ctx.Value(diagnosticKey{}).(string)
	fields := []any{"event", event, "trace", trace}
	fields = append(fields, attrs...)
	slog.InfoContext(ctx, "chat diagnostic", fields...)
}
