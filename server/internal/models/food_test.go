package models

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)

func validFood() SaveFoodRequest {
	value := 200.0
	return SaveFoodRequest{Reason: "initial log", Entry: FoodEntry{ID: "00000000-0000-4000-8000-000000000001", LocalDate: "2026-01-02", Timezone: "Asia/Singapore", TimePrecision: "date_only", Status: "recorded", Items: []FoodItem{{Name: "Test food", Kind: "food", Portion: "1 serving", PortionBasis: "user", Nutrients: map[string]FoodNutrient{"energy": {Value: &value, Unit: "kcal", Basis: "estimate", Confidence: "low", Reference: "synthetic test estimate"}}}}}}
}

// TestFoodValidation prevents unit confusion, invented zeros, unmarked photo assumptions and date shifts.
func TestFoodValidation(t *testing.T) {
	cases := []struct {
		name   string
		change func(*SaveFoodRequest)
	}{
		{"missing value", func(r *SaveFoodRequest) {
			n := r.Entry.Items[0].Nutrients["energy"]
			n.Value = nil
			r.Entry.Items[0].Nutrients["energy"] = n
		}},
		{"wrong unit", func(r *SaveFoodRequest) {
			n := r.Entry.Items[0].Nutrients["energy"]
			n.Unit = "kJ"
			r.Entry.Items[0].Nutrients["energy"] = n
		}},
		{"negative", func(r *SaveFoodRequest) { *r.Entry.Items[0].Nutrients["energy"].Value = -1 }},
		{"nonfinite", func(r *SaveFoodRequest) { *r.Entry.Items[0].Nutrients["energy"].Value = math.NaN() }},
		{"range excludes value", func(r *SaveFoodRequest) {
			n := r.Entry.Items[0].Nutrients["energy"]
			lo, hi := 300.0, 400.0
			n.Low = &lo
			n.High = &hi
			r.Entry.Items[0].Nutrients["energy"] = n
		}},
		{"photo assumptions absent", func(r *SaveFoodRequest) { r.Entry.Items[0].PortionBasis = "photo_estimate" }},
		{"wrong local date", func(r *SaveFoodRequest) {
			v := time.Date(2026, 1, 2, 17, 0, 0, 0, time.UTC)
			r.Entry.EatenAt = &v
			r.Entry.TimePrecision = "exact"
		}},
		{"no reason", func(r *SaveFoodRequest) { r.Reason = "" }},
	}
	if err := validFood().Validate(); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := validFood()
			c.change(&r)
			if r.Validate() == nil {
				t.Fatal("expected validation failure")
			}
		})
	}
	r := validFood()
	r.Entry.Items[0].Nutrients = map[string]FoodNutrient{}
	if err := r.Validate(); err != nil {
		t.Fatalf("unknown nutrition must remain loggable: %v", err)
	}
}

// TestDecodeFoodRejectsImages ensures accidental image payloads and extra JSON are not accepted.
func TestDecodeFoodRejectsImages(t *testing.T) {
	raw, err := json.Marshal(validFood())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = DecodeFood(strings.NewReader(string(raw))); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{strings.TrimSuffix(string(raw), "}") + `,"image":"data:image/png;base64,AAAA"}`, string(raw) + ` {}`} {
		if _, err = DecodeFood(strings.NewReader(bad)); err == nil {
			t.Fatal("accepted unknown image field or trailing object")
		}
	}
}
