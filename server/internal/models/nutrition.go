package models

import (
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
)

type NutritionTarget struct {
	Value  float64  `json:"value"`
	Unit   string   `json:"unit"`
	Kind   string   `json:"kind"` // goal, range, maximum, reference
	Low    *float64 `json:"low,omitempty"`
	High   *float64 `json:"high,omitempty"`
	Label  string   `json:"label"`
	Source string   `json:"source"`
	Upper  *float64 `json:"upper,omitempty"` // only unambiguous total-intake ULs
}
type NutritionProfile struct {
	Age         int     `json:"age"`
	Sex         string  `json:"sex"`
	HeightCM    float64 `json:"height_cm"`
	WeightKG    float64 `json:"weight_kg"`
	Activity    string  `json:"activity"`
	Goal        string  `json:"goal"`
	Preferences string  `json:"preferences"`
}
type NutritionProtocol struct {
	EffectiveDate string                     `json:"effective_date"`
	Timezone      string                     `json:"timezone"`
	Profile       NutritionProfile           `json:"profile"`
	Notes         string                     `json:"notes"`
	Targets       map[string]NutritionTarget `json:"targets"`
}
type SaveNutritionProtocol struct {
	ExpectedVersion int               `json:"expected_version"`
	Reason          string            `json:"reason"`
	Protocol        NutritionProtocol `json:"protocol"`
}

func DecodeNutrition(r io.Reader) (SaveNutritionProtocol, error) {
	var req SaveNutritionProtocol
	d := json.NewDecoder(io.LimitReader(r, 65537))
	d.DisallowUnknownFields()
	if err := d.Decode(&req); err != nil {
		return req, err
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return req, errors.New("expected one JSON object")
	}
	return req, req.Validate()
}
func (r SaveNutritionProtocol) Validate() error {
	p := r.Protocol
	if _, err := time.Parse("2006-01-02", p.EffectiveDate); err != nil {
		return errors.New("invalid effective_date")
	}
	if _, err := time.LoadLocation(p.Timezone); err != nil || p.Timezone == "" || p.Timezone == "Local" {
		return errors.New("explicit timezone required")
	}
	if r.ExpectedVersion < 0 || strings.TrimSpace(r.Reason) == "" || len(r.Reason) > 1000 || len(p.Notes) > 4000 {
		return errors.New("invalid version or reason/notes")
	}
	if p.Profile.Age < 18 || p.Profile.Age > 120 || !oneOf(p.Profile.Sex, "male", "female") || !finitePositive(p.Profile.HeightCM) || p.Profile.HeightCM < 50 || p.Profile.HeightCM > 300 || !finitePositive(p.Profile.WeightKG) || p.Profile.WeightKG < 20 || p.Profile.WeightKG > 500 || len(p.Profile.Preferences) > 2000 || len(p.Profile.Activity) > 300 || len(p.Profile.Goal) > 300 {
		return errors.New("invalid adult nutrition profile")
	}
	if len(p.Targets) > len(NutrientUnits) {
		return errors.New("too many targets")
	}
	for key, t := range p.Targets {
		unit, ok := NutrientUnits[key]
		if !ok || t.Unit != unit || !finitePositive(t.Value) || t.Value == 0 || !oneOf(t.Kind, "goal", "range", "maximum", "reference") || strings.TrimSpace(t.Source) == "" || len(t.Source) > 1500 || len(t.Label) > 150 {
			return errors.New("invalid target: " + key)
		}
		if (t.Low == nil) != (t.High == nil) {
			return errors.New("range requires low and high")
		}
		if t.Kind == "range" && t.Low == nil {
			return errors.New("range requires bounds")
		}
		if t.Low != nil && (!finitePositive(*t.Low) || !finitePositive(*t.High) || *t.Low > t.Value || *t.High < t.Value) {
			return errors.New("invalid target range")
		}
		if t.Upper != nil {
			// Form-specific ULs (retinol, supplemental magnesium, folic acid, etc.) cannot be inferred from the existing nutrient totals.
			if !oneOf(key, "vitamin_d", "vitamin_c", "calcium", "iron", "zinc", "copper", "manganese", "selenium", "iodine", "molybdenum", "phosphorus", "vitamin_b6", "choline") || !finitePositive(*t.Upper) || *t.Upper < t.Value {
				return errors.New("unsupported or invalid total-intake upper limit: " + key)
			}
		}
	}
	return nil
}
