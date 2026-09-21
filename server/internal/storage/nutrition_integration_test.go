//go:build integration

package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/claude/freereps/internal/models"
)

// TestNutritionPersistence exercises real transactions to protect protocol history and completion against stale writers and food corrections.
func TestNutritionPersistence(t *testing.T) {
	dsn := os.Getenv("FREEREPS_TEST_DSN")
	if dsn == "" {
		t.Skip("FREEREPS_TEST_DSN not set")
	}
	ctx := context.Background()
	db, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var name string
	if err = db.Pool.QueryRow(ctx, "SELECT current_database()").Scan(&name); err != nil || name != "freereps_scratch" {
		t.Fatal("requires freereps_scratch")
	}
	migrations, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatal(err)
	}
	if err = RunMigrations(dsn, migrations); err != nil {
		t.Fatal(err)
	}
	const uid = 52531
	const other = 52532
	for _, id := range []int{uid, other} {
		if _, err = db.Pool.Exec(ctx, `INSERT INTO users(id,login) VALUES($1,'protocol-test-'||$1::integer::text) ON CONFLICT DO NOTHING`, id); err != nil {
			t.Fatal(err)
		}
		defer func(id int) {
			for _, table := range []string{"food_entry_revisions", "food_entries", "nutrition_days", "nutrition_protocols"} {
				_, _ = db.Pool.Exec(ctx, "DELETE FROM "+table+" WHERE user_id=$1", id)
			}
			_, _ = db.Pool.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
		}(id)
	}
	r := models.SaveNutritionProtocol{Reason: "synthetic", Protocol: models.NutritionProtocol{EffectiveDate: "2025-01-01", Timezone: "Asia/Singapore", Profile: models.NutritionProfile{Age: 35, Sex: "male", HeightCM: 180, WeightKG: 80}, Targets: map[string]models.NutritionTarget{"protein": {Value: 100, Unit: "g", Kind: "goal", Source: "Synthetic fixture"}}}}
	a, err := db.SaveNutritionProtocol(ctx, uid, r)
	if err != nil || a.Version != 1 {
		t.Fatalf("create: %+v %v", a, err)
	}
	if a, err = db.SaveNutritionProtocol(ctx, uid, r); err != nil || a.Version != 1 {
		t.Fatal("retry not idempotent", err)
	}
	r.Protocol.EffectiveDate = "2025-02-01"
	if _, err = db.SaveNutritionProtocol(ctx, uid, r); !errors.Is(err, ErrNutritionConflict) {
		t.Fatal("stale protocol accepted", err)
	}
	r.ExpectedVersion = 1
	if _, err = db.SaveNutritionProtocol(ctx, uid, r); err != nil {
		t.Fatal(err)
	}
	history, err := db.NutritionProtocols(ctx, uid)
	if err != nil || len(history) != 2 || history[0].Protocol.EffectiveDate != "2025-01-01" {
		t.Fatal("history lost", err)
	}
	isolated, err := db.NutritionProtocols(ctx, other)
	if err != nil || len(isolated) != 0 {
		t.Fatal("profile leak")
	}
	day, err := db.SaveNutritionDay(ctx, uid, "2025-01-02", true, 0)
	if err != nil || day.Version != 1 {
		t.Fatal(err)
	}
	food := models.SaveFoodRequest{Reason: "synthetic", Entry: models.FoodEntry{ID: "00000000-0000-4000-8000-000000000087", LocalDate: "2025-01-02", Timezone: "Asia/Singapore", TimePrecision: "date_only", Status: "recorded", Items: []models.FoodItem{{Name: "Synthetic water", Kind: "drink", Portion: "1 cup", PortionBasis: "user", Nutrients: map[string]models.FoodNutrient{}}}}}
	if _, err = db.SaveFoodEntry(ctx, uid, food); err != nil {
		t.Fatal(err)
	}
	days, err := db.NutritionDays(ctx, uid, "2025-01-02", "2025-01-04")
	if err != nil || len(days) != 1 || days[0].Complete || days[0].Version != 2 {
		t.Fatalf("did not reopen: %+v %v", days, err)
	}
	if _, err = db.SaveNutritionDay(ctx, uid, "2025-01-02", true, 1); !errors.Is(err, ErrNutritionConflict) {
		t.Fatal("stale completion accepted")
	}
	if _, err = db.SaveNutritionDay(ctx, uid, "2025-01-02", true, 2); err != nil {
		t.Fatal(err)
	}
	if _, err = db.SaveFoodEntry(ctx, uid, food); err != nil {
		t.Fatal(err)
	}
	days, _ = db.NutritionDays(ctx, uid, "2025-01-02", "2025-01-03")
	if !days[0].Complete || days[0].Version != 3 {
		t.Fatal("identical retry reopened day")
	}
	food.ExpectedVersion = 1
	food.Entry.LocalDate = "2025-01-03"
	if _, err = db.SaveFoodEntry(ctx, uid, food); err != nil {
		t.Fatal(err)
	}
	days, _ = db.NutritionDays(ctx, uid, "2025-01-02", "2025-01-04")
	if len(days) != 2 || days[0].Complete || days[1].Complete {
		t.Fatal("move did not reopen both dates")
	}
	isolatedDays, _ := db.NutritionDays(ctx, other, "2025-01-02", "2025-01-04")
	if len(isolatedDays) != 0 {
		t.Fatal("day isolation failed")
	}
}
