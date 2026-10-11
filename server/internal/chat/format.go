package chat

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/claude/freereps/internal/models"
)

// The provider must produce actual typed food data, not a JSON string whose
// contents escape Structured Outputs validation. Units come from our catalog.
func responseSchema() map[string]any {
	str := map[string]any{"type": "string"}
	nullableNumber := map[string]any{"type": []string{"number", "null"}, "minimum": 0}
	enum := func(values ...string) map[string]any { return map[string]any{"type": "string", "enum": values} }
	object := func(properties map[string]any) map[string]any {
		required := make([]string, 0, len(properties))
		for k := range properties {
			required = append(required, k)
		}
		sort.Strings(required)
		return map[string]any{"type": "object", "additionalProperties": false, "required": required, "properties": properties}
	}
	keys := make([]string, 0, len(models.NutrientUnits))
	for k := range models.NutrientUnits {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	nutrient := object(map[string]any{"name": enum(keys...), "value": map[string]any{"type": "number", "minimum": 0}, "low": nullableNumber, "high": nullableNumber, "basis": enum("label", "database", "estimate", "measured"), "confidence": enum("low", "medium", "high"), "reference": str})
	item := object(map[string]any{"name": str, "kind": enum("food", "drink", "supplement"), "portion": str, "grams": nullableNumber, "portion_basis": enum("user", "label", "weighed", "photo_estimate"), "assumptions": str, "nutrients": map[string]any{"type": "array", "items": nutrient}})
	entry := object(map[string]any{"id": str, "local_date": str, "timezone": str, "time_precision": enum("date_only", "approximate", "exact"), "eaten_at": map[string]any{"type": []string{"string", "null"}}, "meal": str, "notes": str, "status": enum("recorded"), "items": map[string]any{"type": "array", "minItems": 1, "maxItems": 100, "items": item}})
	food := object(map[string]any{"expected_version": map[string]any{"type": "integer", "minimum": 0}, "reason": str, "entry": entry})
	return object(map[string]any{"reply": str, "food_record": map[string]any{"anyOf": []any{food, map[string]any{"type": "null"}}}})
}

type providerNutrient struct {
	Name string `json:"name"`
	models.FoodNutrient
}
type providerItem struct {
	models.FoodItem
	Nutrients []providerNutrient `json:"nutrients"`
}
type providerFood struct {
	ExpectedVersion int    `json:"expected_version"`
	Reason          string `json:"reason"`
	Entry           struct {
		models.FoodEntry
		Items []providerItem `json:"items"`
	} `json:"entry"`
}

func decodeProposal(raw []byte) (Proposal, error) {
	var wire struct {
		Reply string        `json:"reply"`
		Food  *providerFood `json:"food_record"`
	}
	if err := json.Unmarshal(raw, &wire); err != nil {
		return Proposal{}, errors.New("invalid_json_shape")
	}
	if strings.TrimSpace(wire.Reply) == "" || len(wire.Reply) > 16000 {
		return Proposal{}, errors.New("invalid_reply")
	}
	result := Proposal{Reply: wire.Reply}
	if wire.Food == nil {
		return result, nil
	}
	food := models.SaveFoodRequest{Reason: wire.Food.Reason, ExpectedVersion: wire.Food.ExpectedVersion, Entry: wire.Food.Entry.FoodEntry}
	food.Entry.Items = nil
	for _, item := range wire.Food.Entry.Items {
		value := item.FoodItem
		value.Nutrients = map[string]models.FoodNutrient{}
		for _, n := range item.Nutrients {
			unit, ok := models.NutrientUnits[n.Name]
			if !ok {
				return Proposal{}, errors.New("unknown_nutrient")
			}
			if _, duplicate := value.Nutrients[n.Name]; duplicate {
				return Proposal{}, errors.New("duplicate_nutrient")
			}
			n.Unit = unit
			value.Nutrients[n.Name] = n.FoodNutrient
		}
		food.Entry.Items = append(food.Entry.Items, value)
	}
	if err := food.Validate(); err != nil {
		return Proposal{}, errors.New(validationCode(err))
	}
	data, err := json.Marshal(food)
	if err != nil {
		return Proposal{}, errors.New("invalid_food")
	}
	text := string(data)
	result.FoodJSON = &text
	return result, nil
}

// Never log arbitrary validator text: it can contain model-supplied field names.
func validationCode(err error) string {
	message := err.Error()
	for _, rule := range []struct{ match, code string }{
		{"entry.id", "invalid_id"}, {"local_date", "invalid_local_date"}, {"timezone", "invalid_timezone"}, {"time_precision", "invalid_time_precision"}, {"eaten_at", "invalid_eaten_at"},
		{"status", "invalid_status"}, {"reason", "invalid_reason"}, {"1–100", "invalid_item_count"}, {"consumed portion", "missing_portion"}, {"portion_basis", "invalid_portion_basis"}, {"grams", "invalid_grams"}, {"assumptions", "missing_assumptions"},
		{"nutrient or unit", "invalid_nutrient_unit"}, {"nonnegative", "invalid_value"}, {"basis, confidence", "invalid_provenance"}, {"low and high", "incomplete_range"}, {"invalid range", "invalid_range"},
	} {
		if strings.Contains(message, rule.match) {
			return rule.code
		}
	}
	return "invalid_food"
}
