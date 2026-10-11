//go:build integration

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/claude/freereps/internal/chat"
	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
	"github.com/google/uuid"
)

// TestChatPersistence exercises actual food mutations and crash recovery with a fake provider and a disposable database.
func TestChatPersistence(t *testing.T) {
	dsn := os.Getenv("FREEREPS_TEST_DSN")
	if dsn == "" {
		t.Skip("scratch DB not configured")
	}
	ctx := context.Background()
	db, err := storage.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var name string
	if err = db.Pool.QueryRow(ctx, "SELECT current_database()").Scan(&name); err != nil || name != "freereps_scratch" {
		t.Fatal("chat test requires freereps_scratch")
	}
	migrations, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatal(err)
	}
	if err = storage.RunMigrations(dsn, migrations); err != nil {
		t.Fatal(err)
	}
	const uid = 53011
	for _, id := range []int{uid, uid + 1} {
		if _, err = db.Pool.Exec(ctx, `INSERT INTO users(id,login) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, "synthetic-chat-"+uuid.NewString()); err != nil {
			t.Fatal(err)
		}

	}
	// Remove only this test’s synthetic users before closing the DB.
	defer func() {
		for _, id := range []int{uid, uid + 1} {
			for _, table := range []string{"chat_turns", "chat_credentials", "food_entry_revisions", "food_entries", "nutrition_days"} {
				_, _ = db.Pool.Exec(ctx, "DELETE FROM "+table+" WHERE user_id=$1", id)
			}
			_, _ = db.Pool.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
		}
	}()
	var proposal = chat.Proposal{Reply: "Synthetic estimate"}
	calls := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer sk-synthetic" {
			t.Error("credential missing")
		}
		var food any
		if proposal.FoodJSON != nil {
			var decoded map[string]any
			_ = json.Unmarshal([]byte(*proposal.FoodJSON), &decoded)
			if entry, ok := decoded["entry"].(map[string]any); ok {
				for _, rawItem := range entry["items"].([]any) {
					item := rawItem.(map[string]any)
					nutrients := []any{}
					for name, rawNutrient := range item["nutrients"].(map[string]any) {
						n := rawNutrient.(map[string]any)
						n["name"] = name
						delete(n, "unit")
						nutrients = append(nutrients, n)
					}
					item["nutrients"] = nutrients
				}
			}
			food = decoded
		}
		raw, _ := json.Marshal(map[string]any{"reply": proposal.Reply, "food_record": food})
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{map[string]any{"type": "message", "content": []any{map[string]any{"type": "output_text", "text": string(raw)}}}}})
	}))
	defer provider.Close()
	client := chat.NewClient()
	client.URL = provider.URL
	client.HTTP = provider.Client()
	s := &Server{db: db, chatClient: client}
	perform := func(handler http.HandlerFunc, method string, body any, id int) *httptest.ResponseRecorder {
		t.Helper()
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(method, "http://protocol.test/api/v1/chat", bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(context.WithValue(ctx, userIDKey, id))
		w := httptest.NewRecorder()
		handler(w, req)
		return w
	}
	keyResult := perform(s.handleChatKey, "PUT", map[string]string{"api_key": "sk-synthetic"}, uid)
	if keyResult.Code != 200 {
		t.Fatal(keyResult.Body.String())
	}
	otherKey, err := db.ChatKey(ctx, uid+1)
	if err != nil || otherKey != "" {
		t.Fatal("cross-user key leak")
	}
	send := func(r models.ChatRequest) models.ChatTurn {
		t.Helper()
		w := perform(s.handleSendChat, "POST", r, uid)
		if w.Code != 200 {
			t.Fatalf("send status %d: %s", w.Code, w.Body.String())
		}
		var result models.ChatTurn
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	request := func(message string) models.ChatRequest {
		return models.ChatRequest{ID: uuid.NewString(), Message: message, Timezone: "America/Los_Angeles", LocalDate: "2025-01-14"}
	}
	value := 250.0
	food := models.SaveFoodRequest{Reason: "Synthetic estimate", Entry: models.FoodEntry{ID: uuid.NewString(), LocalDate: "2025-01-13", Timezone: "America/Los_Angeles", TimePrecision: "date_only", Status: "recorded", Items: []models.FoodItem{{Name: "Synthetic soup", Kind: "food", Portion: "one bowl", PortionBasis: "user", Nutrients: map[string]models.FoodNutrient{"energy": {Value: &value, Unit: "kcal", Basis: "estimate", Confidence: "low", Reference: "synthetic fixture"}}}}}}
	setFood := func(f models.SaveFoodRequest) {
		raw, _ := json.Marshal(f)
		str := string(raw)
		proposal.FoodJSON = &str
	}
	setFood(food)
	r := request("Log my synthetic soup yesterday")
	first := send(r)
	again := send(r)
	if first.SavedEntryID == nil || again.SavedEntryID == nil || *first.SavedEntryID != *again.SavedEntryID || calls != 1 || first.SavedDate != "2025-01-13" {
		t.Fatal("retry duplicated meal, model call, or lost historical date")
	}
	revisions, err := db.FoodHistory(ctx, uid, *first.SavedEntryID)
	if err != nil || len(revisions) != 1 {
		t.Fatal("retry created revision", err)
	}
	changed := r
	changed.Message = "different"
	if w := perform(s.handleSendChat, "POST", changed, uid); w.Code != 409 {
		t.Fatal("changed replay accepted")
	}
	food.Entry.ID = *first.SavedEntryID
	food.ExpectedVersion = 1
	food.Entry.Items[0].Portion = "half bowl"
	value = 125
	setFood(food)
	correction := send(request("I ate half of that soup"))
	if correction.SavedEntryID == nil || *correction.SavedEntryID != *first.SavedEntryID {
		t.Fatal("correction created new meal")
	}
	revisions, err = db.FoodHistory(ctx, uid, *first.SavedEntryID)
	if err != nil || len(revisions) != 2 || *revisions[len(revisions)-1].Entry.Items[0].Nutrients["energy"].Value != 125 {
		t.Fatal("correction payload/history incorrect", err)
	}
	food.Entry.ID = uuid.NewString()
	setFood(food)
	if w := perform(s.handleSendChat, "POST", request("Correct an unknown record"), uid); w.Code != 409 {
		t.Fatal("accepted unknown correction")
	}
	proposal.FoodJSON = nil
	reply := send(request("What is on this menu?"))
	if reply.SavedEntryID != nil {
		t.Fatal("discussion logged food")
	}
	invalid := "{}"
	proposal.FoodJSON = &invalid
	if w := perform(s.handleSendChat, "POST", request("Invalid estimate"), uid); w.Code != 502 {
		t.Fatal("accepted invalid food")
	}
	// Simulate death after the nutrition write but before completing the chat turn.
	recoverReq := request("Recover my meal")
	if _, err = db.StartChatTurn(ctx, uid, recoverReq); err != nil {
		t.Fatal(err)
	}
	food.Entry.ID = uuid.NewString()
	food.ExpectedVersion = 0
	food.Entry.LocalDate = "2025-01-14"
	if err = db.PrepareChatTurn(ctx, uid, recoverReq.ID, "Recovery estimate", &food); err != nil {
		t.Fatal(err)
	}
	if _, err = db.SaveFoodEntry(ctx, uid, food); err != nil {
		t.Fatal(err)
	}
	previousCalls := calls
	recovered := send(recoverReq)
	if recovered.SavedEntryID == nil || *recovered.SavedEntryID != food.Entry.ID || calls != previousCalls {
		t.Fatal("recovery regenerated estimate")
	}
	revisions, err = db.FoodHistory(ctx, uid, food.Entry.ID)
	if err != nil || len(revisions) != 1 {
		t.Fatal("recovery duplicated revision", err)
	}
	// The connection-level advisory lock survives transactions and is scoped by user.
	release, err := db.LockChat(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.LockChat(ctx, uid); !errors.Is(err, storage.ErrChatBusy) {
		release()
		t.Fatal("lock allowed concurrent sends", err)
	}
	otherRelease, err := db.LockChat(ctx, uid+1)
	if err != nil {
		release()
		t.Fatal(err)
	}
	otherRelease()
	release()
	history := perform(s.handleChat, "GET", nil, uid)
	if history.Code != 200 || strings.Contains(history.Body.String(), "sk-synthetic") || strings.Contains(history.Body.String(), "food_request") || strings.Contains(history.Body.String(), "request_hash") {
		t.Fatal("history leaked private metadata")
	}
	empty := perform(s.handleChat, "GET", nil, uid+1)
	if empty.Code != 200 || strings.Contains(empty.Body.String(), "Synthetic soup") || strings.Contains(empty.Body.String(), "Recover my meal") {
		t.Fatal("cross-user history leak")
	}
	// Cursor pagination must never mix users or reverse the visible conversation.
	for range 52 {
		if _, err = db.StartChatTurn(ctx, uid, request("Synthetic older message")); err != nil {
			t.Fatal(err)
		}
	}
	latest, err := db.ChatHistory(ctx, uid, 0)
	if err != nil || len(latest) != 50 {
		t.Fatal("history page limit", err)
	}
	older, err := db.ChatHistory(ctx, uid, latest[0].Sequence)
	if err != nil || len(older) == 0 || older[len(older)-1].Sequence >= latest[0].Sequence {
		t.Fatal("history cursor repeated rows", err)
	}
}
