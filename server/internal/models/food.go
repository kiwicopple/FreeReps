package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

// NutrientUnits defines canonical consumed-portion units, never per-100g values.
// Different vitamin equivalents are separate keys to prevent invalid sums.
var NutrientUnits = map[string]string{
	"energy": "kcal", "protein": "g", "carbohydrate": "g", "fat": "g",
	"saturated_fat": "g", "monounsaturated_fat": "g", "polyunsaturated_fat": "g", "trans_fat": "g",
	"fiber": "g", "sugar": "g", "added_sugar": "g", "starch": "g", "alcohol": "g",
	"omega_3": "g", "omega_6": "g", "ala": "g", "epa": "g", "dha": "g",
	"cholesterol": "mg", "sodium": "mg", "potassium": "mg", "calcium": "mg", "magnesium": "mg",
	"phosphorus": "mg", "iron": "mg", "zinc": "mg", "copper": "mg", "manganese": "mg",
	"selenium": "ug", "iodine": "ug", "chromium": "ug", "molybdenum": "ug", "chloride": "mg",
	"vitamin_a_rae": "ug", "vitamin_c": "mg", "vitamin_d": "ug", "vitamin_e_alpha_tocopherol": "mg",
	"vitamin_k": "ug", "thiamin_b1": "mg", "riboflavin_b2": "mg", "niacin_b3": "mg",
	"pantothenic_acid_b5": "mg", "vitamin_b6": "mg", "biotin_b7": "ug", "folate_dfe": "ug",
	"folate_total": "ug", "folic_acid": "ug", "vitamin_b12": "ug", "choline": "mg",
	"caffeine": "mg", "water": "ml", "creatine": "g",
}

type FoodNutrient struct {
	Value      *float64 `json:"value"`
	Unit       string   `json:"unit"`
	Low        *float64 `json:"low,omitempty"`
	High       *float64 `json:"high,omitempty"`
	Basis      string   `json:"basis"` // label, database, estimate, or measured
	Confidence string   `json:"confidence"`
	Reference  string   `json:"reference"`
}

type FoodItem struct {
	Name         string                  `json:"name"`
	Kind         string                  `json:"kind"`    // food, drink, supplement
	Portion      string                  `json:"portion"` // amount actually consumed, including leftovers
	Grams        *float64                `json:"grams,omitempty"`
	PortionBasis string                  `json:"portion_basis"` // weighed, label, user, photo_estimate
	Assumptions  string                  `json:"assumptions"`
	Nutrients    map[string]FoodNutrient `json:"nutrients"`
}

type FoodEntry struct {
	ID            string     `json:"id"`
	LocalDate     string     `json:"local_date"`
	Timezone      string     `json:"timezone"`
	EatenAt       *time.Time `json:"eaten_at,omitempty"`
	TimePrecision string     `json:"time_precision"` // exact, approximate, date_only
	Meal          string     `json:"meal"`
	Status        string     `json:"status"` // recorded, voided
	Notes         string     `json:"notes"`
	Items         []FoodItem `json:"items"`
}

type SaveFoodRequest struct {
	Entry           FoodEntry `json:"entry"`
	ExpectedVersion int       `json:"expected_version"`
	Reason          string    `json:"reason"`
}

// DecodeFood rejects unknown fields (including image data) and trailing JSON.
func DecodeFood(r io.Reader) (SaveFoodRequest, error) {
	var req SaveFoodRequest
	d := json.NewDecoder(io.LimitReader(r, 256*1024+1))
	d.DisallowUnknownFields()
	if err := d.Decode(&req); err != nil {
		return req, err
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return req, errors.New("expected one JSON object")
	}
	return req, req.Validate()
}

func oneOf(s string, options ...string) bool {
	for _, option := range options {
		if s == option {
			return true
		}
	}
	return false
}
func finitePositive(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 }

func (r SaveFoodRequest) Validate() error {
	e := r.Entry
	id, err := uuid.Parse(e.ID)
	if err != nil || id == uuid.Nil {
		return errors.New("entry.id must be a nonzero UUID; reuse it for retries")
	}
	if _, err = time.Parse("2006-01-02", e.LocalDate); err != nil {
		return errors.New("local_date must be YYYY-MM-DD")
	}
	zone, err := time.LoadLocation(e.Timezone)
	if err != nil || e.Timezone == "" || e.Timezone == "Local" {
		return errors.New("timezone must be an explicit IANA timezone")
	}
	if !oneOf(e.TimePrecision, "exact", "approximate", "date_only") {
		return errors.New("invalid time_precision")
	}
	if e.TimePrecision == "date_only" {
		if e.EatenAt != nil {
			return errors.New("date_only requires eaten_at to be omitted")
		}
	} else if e.EatenAt == nil || e.EatenAt.In(zone).Format("2006-01-02") != e.LocalDate {
		return errors.New("eaten_at must match local_date in the supplied timezone")
	}
	if !oneOf(e.Status, "recorded", "voided") {
		return errors.New("status must be recorded or voided")
	}
	if len(e.Meal) > 120 || len(e.Notes) > 4000 || len(r.Reason) > 1000 || strings.TrimSpace(r.Reason) == "" || r.ExpectedVersion < 0 {
		return errors.New("reason is required; invalid text length or expected_version")
	}
	if r.ExpectedVersion == 0 && e.Status != "recorded" {
		return errors.New("new entries must be recorded")
	}
	if len(e.Items) < 1 || len(e.Items) > 100 {
		return errors.New("entry needs 1–100 items")
	}
	for _, item := range e.Items {
		if strings.TrimSpace(item.Name) == "" || len(item.Name) > 300 || strings.TrimSpace(item.Portion) == "" || len(item.Portion) > 500 || len(item.Assumptions) > 4000 {
			return errors.New("each item needs a name and consumed portion, within text limits")
		}
		if !oneOf(item.Kind, "food", "drink", "supplement") || !oneOf(item.PortionBasis, "weighed", "label", "user", "photo_estimate") {
			return errors.New("invalid item kind or portion_basis")
		}
		if item.Grams != nil && (!finitePositive(*item.Grams) || *item.Grams == 0) {
			return errors.New("grams must be finite and positive")
		}
		if item.PortionBasis == "photo_estimate" && strings.TrimSpace(item.Assumptions) == "" {
			return errors.New("photo estimates require portion/ingredient assumptions")
		}
		for key, n := range item.Nutrients {
			unit, ok := NutrientUnits[key]
			if !ok || n.Unit != unit {
				return fmt.Errorf("invalid nutrient or unit: %s (expected %s)", key, unit)
			}
			if n.Value == nil || !finitePositive(*n.Value) {
				return fmt.Errorf("%s needs a nonnegative value; omit unknown nutrients", key)
			}
			if !oneOf(n.Basis, "label", "database", "estimate", "measured") || !oneOf(n.Confidence, "low", "medium", "high") || strings.TrimSpace(n.Reference) == "" || len(n.Reference) > 1500 {
				return fmt.Errorf("%s needs basis, confidence and reference", key)
			}
			if (n.Low == nil) != (n.High == nil) {
				return fmt.Errorf("%s needs both low and high, or neither", key)
			}
			if n.Low != nil && (!finitePositive(*n.Low) || !finitePositive(*n.High) || *n.Low > *n.Value || *n.High < *n.Value) {
				return fmt.Errorf("invalid range for %s", key)
			}
		}
	}
	return nil
}
