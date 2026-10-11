package chat

import (
	"context"
	"encoding/json"
	"github.com/claude/freereps/internal/models"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const syntheticFood = `{"expected_version":0,"reason":"Synthetic estimate","entry":{"id":"00000000-0000-4000-8000-000000000001","local_date":"2025-01-14","timezone":"America/Los_Angeles","time_precision":"date_only","eaten_at":null,"meal":"Lunch","notes":"Assumed serving","status":"recorded","items":[{"name":"Synthetic soup","kind":"food","portion":"one assumed bowl","grams":null,"portion_basis":"user","assumptions":"Assumed one bowl as requested","nutrients":[{"name":"energy","value":200,"low":150,"high":300,"basis":"estimate","confidence":"low","reference":"Synthetic fixture"}]}]}}`

// TestFoodResponseRepair reproduces a model's rejected estimate and verifies an automatic retry before any save.
func TestFoodResponseRepair(t *testing.T) {
	calls := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		schema := body["text"].(map[string]any)["format"].(map[string]any)["schema"].(map[string]any)
		if schema["properties"].(map[string]any)["food_record"] == nil {
			t.Error("food contents are not constrained by schema")
		}
		food := syntheticFood
		if calls == 1 {
			food = strings.Replace(food, `"portion_basis":"user"`, `"portion_basis":"estimate"`, 1)
		} else {
			raw, _ := json.Marshal(body["input"])
			if !strings.Contains(string(raw), "invalid_portion_basis") {
				t.Error("missing validation feedback")
			}
		}
		raw, _ := json.Marshal(map[string]any{"reply": "Assuming one bowl.", "food_record": json.RawMessage(food)})
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{map[string]any{"type": "message", "content": []any{map[string]any{"type": "output_text", "text": string(raw)}}}}})
	}))
	defer provider.Close()
	client := NewClient()
	client.URL = provider.URL
	client.HTTP = provider.Client()
	result, err := client.Generate(context.Background(), "sk-synthetic", Input{Request: models.ChatRequest{Message: "Please estimate an unknown portion"}})
	if err != nil || result.FoodJSON == nil || calls != 2 {
		t.Fatalf("repair failed: calls=%d err=%v", calls, err)
	}
	food, err := models.DecodeFood(strings.NewReader(*result.FoodJSON))
	if err != nil {
		t.Fatal(err)
	}
	if food.Entry.Items[0].Nutrients["energy"].Unit != "kcal" {
		t.Fatal("canonical unit was not assigned")
	}
}

// TestStructuredFoodValidation never silently drops duplicate/unknown nutrients or relaxes food validation.
func TestStructuredFoodValidation(t *testing.T) {
	for _, bad := range []string{
		strings.Replace(syntheticFood, `"name":"energy"`, `"name":"invented_nutrient"`, 1),
		strings.Replace(syntheticFood, `"high":300`, `"high":null`, 1),
		strings.Replace(syntheticFood, `"value":200`, `"value":-1`, 1),
	} {
		_, err := decodeProposal([]byte(`{"reply":"Estimate","food_record":` + bad + `}`))
		if err == nil {
			t.Fatal("accepted invalid food")
		}
	}
}

// Text validation formerly collapsed meal, notes, reason and version into the
// same invalid_reason code, leaving photo retries unable to repair the field.
func TestPhotoTextRepair(t *testing.T) {
	for _, tc := range []struct{ name, old, replacement, rule, hint string }{
		{"meal", `"meal":"Lunch"`, `"meal":"` + strings.Repeat("x", 121) + `"`, "invalid_meal", "120"},
		{"notes", `"notes":"Assumed serving"`, `"notes":"` + strings.Repeat("x", 4001) + `"`, "invalid_notes", "4000"},
		{"reason", `"reason":"Synthetic estimate"`, `"reason":""`, "invalid_reason", "1000"},
		{"long reason", `"reason":"Synthetic estimate"`, `"reason":"` + strings.Repeat("x", 1001) + `"`, "invalid_reason", "1000"},
		{"version", `"expected_version":0`, `"expected_version":-1`, "invalid_expected_version", "expected_version"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Fatal(err)
				}
				encoded, _ := json.Marshal(body["input"])
				for _, photo := range []string{"data:image/png;base64,synthetic-front", "data:image/png;base64,synthetic-label"} {
					if !strings.Contains(string(encoded), photo) {
						t.Error("lost photo on generation or repair")
					}
				}
				food := syntheticFood
				if calls == 1 {
					food = strings.Replace(food, tc.old, tc.replacement, 1)
				} else {
					messages := body["input"].([]any)
					feedback := messages[len(messages)-1].(map[string]any)["content"].(string)
					if !strings.Contains(feedback, tc.rule) || !strings.Contains(feedback, tc.hint) {
						t.Errorf("missing precise repair guidance: %s", feedback)
					}
				}
				raw, _ := json.Marshal(map[string]any{"reply": "Synthetic label estimate", "food_record": json.RawMessage(food)})
				_ = json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{map[string]any{"type": "message", "content": []any{map[string]any{"type": "output_text", "text": string(raw)}}}}})
			}))
			defer provider.Close()
			client := NewClient()
			client.URL = provider.URL
			client.HTTP = provider.Client()
			proposal, err := client.Generate(context.Background(), "sk-synthetic", Input{Request: models.ChatRequest{Message: "Log two synthetic crackers", Images: []string{"data:image/png;base64,synthetic-front", "data:image/png;base64,synthetic-label"}}})
			if err != nil || proposal.FoodJSON == nil || calls != 2 {
				t.Fatalf("repair failed: calls=%d err=%v", calls, err)
			}
		})
	}
}
