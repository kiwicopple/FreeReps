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
