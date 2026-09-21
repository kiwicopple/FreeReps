package storage

import (
	"testing"

	"github.com/claude/freereps/internal/models"
)

// TestFoodTotalsPreserveUnknown verifies that unreported nutrients and unlogged days are never silently zeroed.
func TestFoodTotalsPreserveUnknown(t *testing.T) {
	energy, zero, lo, hi := 200.0, 0.0, 150.0, 250.0
	records := []FoodRecord{{Entry: models.FoodEntry{LocalDate: "2026-01-02", Status: "recorded", Items: []models.FoodItem{
		{PortionBasis: "photo_estimate", Nutrients: map[string]models.FoodNutrient{"energy": {Value: &energy, Unit: "kcal", Low: &lo, High: &hi, Basis: "estimate"}, "sodium": {Value: &zero, Unit: "mg"}}},
		{Nutrients: map[string]models.FoodNutrient{"energy": {Value: &energy, Unit: "kcal", Basis: "label"}}},
	}}}}
	totals, err := SummarizeFood(records, "2026-01-01", "2026-01-03")
	if err != nil {
		t.Fatal(err)
	}
	if totals[0].Coverage != "no_entries" || totals[0].Nutrients["energy"].KnownSubtotal != nil {
		t.Fatal("missing day became zero")
	}
	e := totals[1].Nutrients["energy"]
	if *e.KnownSubtotal != 400 || !e.CompleteForLoggedItems || e.Low != nil || e.EstimatedItems != 1 {
		t.Fatalf("bad energy coverage: %+v", e)
	}
	sodium := totals[1].Nutrients["sodium"]
	if sodium.KnownSubtotal == nil || *sodium.KnownSubtotal != 0 || sodium.KnownItems != 1 || sodium.CompleteForLoggedItems {
		t.Fatal("known zero conflated with unknown")
	}
	if totals[1].Nutrients["vitamin_c"].KnownSubtotal != nil {
		t.Fatal("invented vitamin C")
	}
	records[0].Entry.Status = "voided"
	totals, err = SummarizeFood(records, "2026-01-02", "2026-01-03")
	if err != nil {
		t.Fatal(err)
	}
	if totals[0].Entries != 0 || totals[0].Nutrients["energy"].KnownSubtotal != nil {
		t.Fatal("voided meal still counted")
	}
}
