package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/claude/freereps/internal/chat"
	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
	"github.com/google/uuid"
)

// Chat is private even in local dev mode: don't expose it via the app's general
// permissive CORS policy. JSON-only writes also block cross-site form submits.
func (s *Server) chatUser(w http.ResponseWriter, r *http.Request) (int, bool) {
	w.Header().Del("Access-Control-Allow-Origin")
	w.Header().Set("Cache-Control", "no-store")
	origin := r.Header.Get("Origin")
	if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
		writeJSON(w, 403, map[string]string{"error": "same-origin requests required"})
		return 0, false
	}
	if origin != "" {
		u, err := url.Parse(origin)
		base, _ := url.Parse(s.baseURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || (u.Host != r.Host && (base == nil || base.Host == "" || u.Host != base.Host)) {
			writeJSON(w, 403, map[string]string{"error": "same-origin requests required"})
			return 0, false
		}
	}
	if r.Method != "GET" && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeJSON(w, 415, map[string]string{"error": "JSON required"})
		return 0, false
	}
	return mustUserID(w, r)
}
func decodeChatJSON(w http.ResponseWriter, r *http.Request, v any, limit int64) error {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return errors.New("invalid or oversized request")
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return errors.New("expected one JSON object")
	}
	return nil
}
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.chatUser(w, r)
	if !ok {
		return
	}
	before := int64(0)
	if raw := r.URL.Query().Get("before"); raw != "" {
		var err error
		before, err = strconv.ParseInt(raw, 10, 64)
		if err != nil || before < 0 {
			writeJSON(w, 400, map[string]string{"error": "invalid history cursor"})
			return
		}
	}
	history, err := s.db.ChatHistory(r.Context(), uid, before)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not load chat"})
		return
	}
	key, err := s.db.ChatKey(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read chat connection"})
		return
	}
	writeJSON(w, 200, map[string]any{"turns": history, "configured": key != "", "has_more": len(history) == 50})
}
func (s *Server) handleChatKey(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.chatUser(w, r)
	if !ok {
		return
	}
	var body struct {
		APIKey string `json:"api_key"`
	}
	if err := decodeChatJSON(w, r, &body, 4096); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	key := strings.TrimSpace(body.APIKey)
	if len(key) > 512 || (key != "" && (!strings.HasPrefix(key, "sk-") || strings.ContainsAny(key, " \r\n\t"))) {
		writeJSON(w, 400, map[string]string{"error": "enter a valid OpenAI API key"})
		return
	}
	if err := s.db.SaveChatKey(r.Context(), uid, key); err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not save connection"})
		return
	}
	writeJSON(w, 200, map[string]bool{"configured": key != ""})
}

// finishChat replays the immutable proposal after interruption. SaveFoodEntry's
// stable UUID + payload makes a lost response safe to retry without another meal.
func (s *Server) finishChat(ctx context.Context, uid int, t models.ChatTurn) (models.ChatTurn, error) {
	if t.FoodRequest != nil {
		chat.Diagnostic(ctx, "food.save_started", "correction", t.FoodRequest.ExpectedVersion > 0)
		saved, err := s.db.SaveFoodEntry(ctx, uid, *t.FoodRequest)
		if errors.Is(err, storage.ErrFoodConflict) || errors.Is(err, storage.ErrFoodNotFound) {
			chat.Diagnostic(ctx, "food.save_conflict")
			t.Reply = "This correction was not saved because the food entry changed or is no longer available. Tell me the correction again so I can use the current entry."
		} else if err != nil {
			chat.Diagnostic(ctx, "food.save_failed")
			return t, err
		} else {
			chat.Diagnostic(ctx, "food.saved")
			t.SavedEntryID = &saved.Entry.ID
			t.SavedDate = saved.Entry.LocalDate
			t.Reply += "\n\nSaved to your nutrition log for " + saved.Entry.LocalDate + "."
		}
	}
	if err := s.db.CompleteChatTurn(ctx, uid, t.ID, t.Reply, t.SavedEntryID); err != nil {
		return t, err
	}
	chat.Diagnostic(ctx, "turn.completed", "food_saved", t.SavedEntryID != nil)
	t.Status = "complete"
	return t, nil
}
func (s *Server) handleSendChat(w http.ResponseWriter, r *http.Request) {
	r = r.WithContext(chat.DiagnosticContext(r.Context()))
	started := time.Now()
	stage := "authorize"
	chat.Diagnostic(r.Context(), "request.started")
	defer func() {
		chat.Diagnostic(r.Context(), "request.finished", "stage", stage, "duration_ms", time.Since(started).Milliseconds())
	}()

	uid, ok := s.chatUser(w, r)
	if !ok {
		return
	}
	stage = "decode"
	var req models.ChatRequest
	if err := decodeChatJSON(w, r, &req, 9*1024*1024); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	stage = "validate_request"
	if err := req.Validate(); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	chat.Diagnostic(r.Context(), "request.valid", "photos", len(req.Images), "message_bytes", len(req.Message))
	stage = "lock"
	release, err := s.db.LockChat(r.Context(), uid)
	if err != nil {
		status := 500
		message := "could not open chat"
		if errors.Is(err, storage.ErrChatBusy) {
			status = 409
			message = err.Error()
		}
		writeJSON(w, status, map[string]string{"error": message})
		return
	}
	defer release()
	// Finish any prepared write before considering a new message. The model is
	// never asked to regenerate a proposal that might already have been saved.
	stage = "recover_prepared"
	prepared, err := s.db.PreparedChatTurns(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not recover chat; retry"})
		return
	}
	for _, t := range prepared {
		if _, err = s.finishChat(r.Context(), uid, t); err != nil {
			writeJSON(w, 503, map[string]string{"error": "the previous reply is still being saved; retry without resending as a new meal"})
			return
		}
	}
	stage = "start_turn"
	turn, err := s.db.StartChatTurn(r.Context(), uid, req)
	if err != nil {
		status := 500
		message := "could not save message"
		if errors.Is(err, storage.ErrChatChanged) {
			status = 409
			message = err.Error()
		}
		writeJSON(w, status, map[string]string{"error": message})
		return
	}
	if turn.Status == "complete" {
		stage = "replayed_complete"
		writeJSON(w, 200, turn)
		return
	}
	stage = "credentials"
	key, err := s.db.ChatKey(r.Context(), uid)
	if err != nil || key == "" {
		writeJSON(w, 503, map[string]string{"error": "Connect OpenAI before sending a message"})
		return
	}
	stage = "history"
	history, err := s.db.ChatHistory(r.Context(), uid, 0)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not load recent conversation"})
		return
	}
	day, _ := time.Parse("2006-01-02", req.LocalDate)
	start, end := day.AddDate(0, 0, -6).Format("2006-01-02"), day.AddDate(0, 0, 1).Format("2006-01-02")
	stage = "food_context"
	records, err := s.db.ListFoodEntries(r.Context(), uid, start, end)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read your recent food log; nothing new was logged"})
		return
	}
	totals, err := storage.SummarizeFood(records, req.LocalDate, end)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read food totals"})
		return
	}
	// Full day totals are computed before limiting record context.
	if len(records) > 60 {
		records = records[len(records)-60:]
	}
	stage = "generate"
	proposal, err := s.chatClient.Generate(r.Context(), key, chat.Input{Request: req, History: history, FoodContext: map[string]any{"recent_entries": records, "today_logged_totals": totals, "entry_window_start": start, "entry_limit": 60}})
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}
	stage = "validate_proposal"
	var food *models.SaveFoodRequest
	if proposal.FoodJSON != nil {
		// Validate the proposed mutation through the same contract as ordinary food
		// logging. The model never receives SQL, credentials or another user's data.
		decoded, err := models.DecodeFood(strings.NewReader(*proposal.FoodJSON))
		if err != nil {
			writeJSON(w, 502, map[string]string{"error": "The food estimate was incomplete or invalid. Nothing was logged; please retry or clarify the portion"})
			return
		}
		if decoded.Entry.Status != "recorded" {
			writeJSON(w, 502, map[string]string{"error": "Chat cannot delete entries in this first version"})
			return
		}
		if decoded.ExpectedVersion == 0 {
			decoded.Entry.ID = uuid.NewSHA1(uuid.NameSpaceOID, []byte(fmt.Sprintf("protocol-chat:%d:%s", uid, req.ID))).String()
		} else {
			found := false
			for _, record := range records {
				if record.Entry.ID == decoded.Entry.ID && record.Version == decoded.ExpectedVersion {
					found = true
					break
				}
			}
			if !found {
				writeJSON(w, 409, map[string]string{"error": "The entry to correct is not in the current food context. Please identify a meal from the past seven days"})
				return
			}
		}
		food = &decoded
	}
	stage = "prepare_save"
	if err = s.db.PrepareChatTurn(r.Context(), uid, req.ID, proposal.Reply, food); err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not prepare reply; nothing was logged; retry"})
		return
	}
	turn.Reply = proposal.Reply
	turn.FoodRequest = food
	stage = "finish_save"
	turn, err = s.finishChat(r.Context(), uid, turn)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "The reply is awaiting save confirmation. Retry this message; do not send it as a new meal"})
		return
	}
	stage = "complete"
	writeJSON(w, 200, turn)
}
