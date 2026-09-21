//go:build integration

package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"

	"github.com/claude/freereps/internal/models"
)

// TestFoodPersistence protects retries, optimistic corrections, audit history and user isolation against real Postgres.
func TestFoodPersistence(t *testing.T) {
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
	if err = db.Pool.QueryRow(ctx, "SELECT current_database()").Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "freereps_scratch" {
		t.Fatal("nutrition integration test requires freereps_scratch")
	}
	migrations, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatal(err)
	}
	if err = RunMigrations(dsn, migrations); err != nil {
		t.Fatal(err)
	}
	for _, uid := range []int{52521, 52522} {
		if _, err = db.Pool.Exec(ctx, `INSERT INTO users(id,login) VALUES($1,$2) ON CONFLICT DO NOTHING`, uid, "nutrition-test-"+strconv.Itoa(uid)); err != nil {
			t.Fatal(err)
		}
		defer func(id int) {
			_, _ = db.Pool.Exec(ctx, `DELETE FROM food_entry_revisions WHERE user_id=$1`, id)
			_, _ = db.Pool.Exec(ctx, `DELETE FROM food_entries WHERE user_id=$1`, id)
			_, _ = db.Pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
		}(uid)
	}
	value := 200.0
	req := models.SaveFoodRequest{Reason: "test log", Entry: models.FoodEntry{ID: "00000000-0000-4000-8000-000000000077", LocalDate: "2026-01-02", Timezone: "Asia/Singapore", TimePrecision: "date_only", Status: "recorded", Items: []models.FoodItem{{Name: "Synthetic test meal", Kind: "food", Portion: "1 serving", PortionBasis: "user", Nutrients: map[string]models.FoodNutrient{"energy": {Value: &value, Unit: "kcal", Basis: "estimate", Confidence: "low", Reference: "test fixture"}}}}}}
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := db.SaveFoodEntry(ctx, 52521, req); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	history, err := db.FoodHistory(ctx, 52521, req.Entry.ID)
	if err != nil || len(history) != 1 {
		t.Fatalf("retry history: %v %v", history, err)
	}
	other, err := db.FoodHistory(ctx, 52522, req.Entry.ID)
	if err != nil || len(other) != 0 {
		t.Fatal("cross-user history leak")
	}
	req.Entry.Items[0].Portion = "half serving"
	if _, err = db.SaveFoodEntry(ctx, 52521, req); !errors.Is(err, ErrFoodConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
	value = 100
	req.ExpectedVersion = 1
	req.Reason = "portion correction"
	saved, err := db.SaveFoodEntry(ctx, 52521, req)
	if err != nil || saved.Version != 2 {
		t.Fatalf("correction: %v %v", saved, err)
	}
	if _, err = db.SaveFoodEntry(ctx, 52522, req); !errors.Is(err, ErrFoodNotFound) {
		t.Fatal("updated another user's record")
	}
	req.Entry.Status = "voided"
	req.ExpectedVersion = 2
	req.Reason = "not consumed"
	if _, err = db.SaveFoodEntry(ctx, 52521, req); err != nil {
		t.Fatal(err)
	}
	records, err := db.ListFoodEntries(ctx, 52521, "2026-01-02", "2026-01-03")
	if err != nil {
		t.Fatal(err)
	}
	totals, err := SummarizeFood(records, "2026-01-02", "2026-01-03")
	if err != nil || totals[0].Entries != 0 {
		t.Fatal("voided entry counted")
	}
	history, err = db.FoodHistory(ctx, 52521, req.Entry.ID)
	if err != nil || len(history) != 3 || *history[0].Entry.Items[0].Nutrients["energy"].Value != 200 {
		t.Fatal("audit trail lost original")
	}
	req.Entry.Status = "recorded"
	req.ExpectedVersion = 3
	req.Reason = "restore"
	if _, err = db.SaveFoodEntry(ctx, 52521, req); err != nil {
		t.Fatal(err)
	}
	records, err = db.ListFoodEntries(ctx, 52522, "2026-01-02", "2026-01-03")
	if err != nil || len(records) != 0 {
		t.Fatal("cross-user entry leak")
	}
}
