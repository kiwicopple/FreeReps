package models

import (
	"strings"
	"testing"
)

// TestNutritionValidation prevents malformed units, unsafe form-specific limits and invalid target ranges.
func TestNutritionValidation(t *testing.T) {
	r := SaveNutritionProtocol{Reason: "test", Protocol: NutritionProtocol{EffectiveDate: "2025-01-01", Timezone: "Asia/Singapore", Profile: NutritionProfile{Age: 35, Sex: "male", HeightCM: 180, WeightKG: 80}, Targets: map[string]NutritionTarget{"protein": {Value: 100, Unit: "g", Kind: "goal", Source: "Synthetic test target"}}}}
	if err := r.Validate(); err != nil {
		t.Fatal(err)
	}
	target := r.Protocol.Targets["protein"]
	target.Unit = "mg"
	r.Protocol.Targets["protein"] = target
	if r.Validate() == nil {
		t.Fatal("accepted wrong unit")
	}
	target.Unit = "g"
	target.Kind = "range"
	r.Protocol.Targets["protein"] = target
	if r.Validate() == nil {
		t.Fatal("accepted missing bounds")
	}
	target.Kind = "goal"
	upper := 200.0
	target.Upper = &upper
	r.Protocol.Targets["protein"] = target
	if r.Validate() == nil {
		t.Fatal("accepted unsupported upper limit")
	}
	if _, err := DecodeNutrition(strings.NewReader(`{"unexpected":true}`)); err == nil {
		t.Fatal("accepted unknown fields")
	}
}
