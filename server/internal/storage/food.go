package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/claude/freereps/internal/models"
	"github.com/jackc/pgx/v5"
)

var ErrFoodConflict = errors.New("food entry changed or ID already used; fetch its current version before correcting")
var ErrFoodNotFound = errors.New("food entry not found")

type FoodRecord struct {
	Entry     models.FoodEntry `json:"entry"`
	Version   int              `json:"version"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
}

type FoodRevision struct {
	Entry      models.FoodEntry `json:"entry"`
	Version    int              `json:"version"`
	Reason     string           `json:"reason"`
	RecordedAt time.Time        `json:"recorded_at"`
}

// SaveFoodEntry makes retries idempotent, serializes corrections and retains every revision.
func (db *DB) SaveFoodEntry(ctx context.Context, userID int, req models.SaveFoodRequest) (FoodRecord, error) {
	var record FoodRecord
	if err := req.Validate(); err != nil {
		return record, err
	}
	payload, err := json.Marshal(req.Entry)
	if err != nil {
		return record, err
	}
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return record, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	created := false
	if req.ExpectedVersion == 0 {
		tag, insertErr := tx.Exec(ctx, `INSERT INTO food_entries (user_id,id,local_date,status,payload)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, userID, req.Entry.ID, req.Entry.LocalDate, req.Entry.Status, payload)
		if insertErr != nil {
			return record, insertErr
		}
		created = tag.RowsAffected() == 1
	}
	var existing []byte
	var equal bool
	err = tx.QueryRow(ctx, `SELECT payload,version,created_at,updated_at,payload=$3::jsonb
  FROM food_entries WHERE user_id=$1 AND id=$2 FOR UPDATE`, userID, req.Entry.ID, payload).
		Scan(&existing, &record.Version, &record.CreatedAt, &record.UpdatedAt, &equal)
	if errors.Is(err, pgx.ErrNoRows) {
		return record, ErrFoodNotFound
	}
	if err != nil {
		return record, err
	}
	if !created && !equal {
		if req.ExpectedVersion != record.Version {
			return record, ErrFoodConflict
		}
		err = tx.QueryRow(ctx, `UPDATE food_entries SET local_date=$3,status=$4,payload=$5,
   version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING version,updated_at`,
			userID, req.Entry.ID, req.Entry.LocalDate, req.Entry.Status, payload).Scan(&record.Version, &record.UpdatedAt)
		if err != nil {
			return record, err
		}
	}
	if created || !equal {
		_, err = tx.Exec(ctx, `INSERT INTO food_entry_revisions(user_id,entry_id,version,payload,reason)
   VALUES($1,$2,$3,$4,$5)`, userID, req.Entry.ID, record.Version, payload, req.Reason)
		if err != nil {
			return record, err
		}
	}
	record.Entry = req.Entry
	if err = tx.Commit(ctx); err != nil {
		return FoodRecord{}, err
	}
	return record, nil
}

// FoodDateRange uses stored local consumption dates; end is exclusive.
func FoodDateRange(start, end string) error {
	a, err := time.Parse("2006-01-02", start)
	if err != nil {
		return errors.New("start must be YYYY-MM-DD")
	}
	b, err := time.Parse("2006-01-02", end)
	if err != nil || !b.After(a) || b.Sub(a) > 366*24*time.Hour {
		return errors.New("end must be YYYY-MM-DD, after start, within 366 days")
	}
	return nil
}

func (db *DB) ListFoodEntries(ctx context.Context, userID int, start, end string) ([]FoodRecord, error) {
	if err := FoodDateRange(start, end); err != nil {
		return nil, err
	}
	rows, err := db.Pool.Query(ctx, `SELECT payload,version,created_at,updated_at FROM food_entries
  WHERE user_id=$1 AND local_date >= $2 AND local_date < $3 ORDER BY local_date,id LIMIT 2001`, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([]FoodRecord, 0)
	for rows.Next() {
		var record FoodRecord
		var payload []byte
		if err = rows.Scan(&payload, &record.Version, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(payload, &record.Entry); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if len(records) > 2000 {
		return nil, errors.New("too many food entries; request a shorter date range")
	}
	return records, rows.Err()
}

func (db *DB) FoodHistory(ctx context.Context, userID int, id string) ([]FoodRevision, error) {
	rows, err := db.Pool.Query(ctx, `SELECT payload,version,reason,recorded_at FROM food_entry_revisions
  WHERE user_id=$1 AND entry_id=$2 ORDER BY version`, userID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	revisions := make([]FoodRevision, 0)
	for rows.Next() {
		var revision FoodRevision
		var payload []byte
		if err = rows.Scan(&payload, &revision.Version, &revision.Reason, &revision.RecordedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(payload, &revision.Entry); err != nil {
			return nil, err
		}
		revisions = append(revisions, revision)
	}
	return revisions, rows.Err()
}

type FoodNutrientTotal struct {
	Unit                   string   `json:"unit"`
	KnownSubtotal          *float64 `json:"known_subtotal"`
	KnownItems             int      `json:"known_items"`
	TotalItems             int      `json:"total_items"`
	CompleteForLoggedItems bool     `json:"complete_for_logged_items"`
	EstimatedItems         int      `json:"estimated_items"`
	Low                    *float64 `json:"low,omitempty"`
	High                   *float64 `json:"high,omitempty"`
}

type FoodDayTotal struct {
	Date      string                       `json:"date"`
	Entries   int                          `json:"entries"`
	Items     int                          `json:"items"`
	Coverage  string                       `json:"coverage"`
	Nutrients map[string]FoodNutrientTotal `json:"nutrients"`
}

// SummarizeFood never implies unlogged food was absent or missing vitamins were zero.
func SummarizeFood(records []FoodRecord, start, end string) ([]FoodDayTotal, error) {
	if err := FoodDateRange(start, end); err != nil {
		return nil, err
	}
	date, _ := time.Parse("2006-01-02", start)
	totals := make([]FoodDayTotal, 0)
	for date.Format("2006-01-02") < end {
		day := FoodDayTotal{Date: date.Format("2006-01-02"), Coverage: "no_entries", Nutrients: make(map[string]FoodNutrientTotal)}
		items := make([]models.FoodItem, 0)
		for _, r := range records {
			if r.Entry.Status == "recorded" && r.Entry.LocalDate == day.Date {
				day.Entries++
				items = append(items, r.Entry.Items...)
			}
		}
		day.Items = len(items)
		if day.Entries > 0 {
			day.Coverage = "logged_items_only"
		}
		for key, unit := range models.NutrientUnits {
			total := FoodNutrientTotal{Unit: unit, TotalItems: len(items)}
			sum, low, high := 0.0, 0.0, 0.0
			bounded := true
			for _, item := range items {
				nutrient, ok := item.Nutrients[key]
				if !ok || nutrient.Value == nil {
					continue
				}
				if nutrient.Unit != unit {
					return nil, fmt.Errorf("inconsistent stored unit for %s", key)
				}
				sum += *nutrient.Value
				total.KnownItems++
				if nutrient.Basis == "estimate" || nutrient.Basis == "database" || item.PortionBasis == "photo_estimate" {
					total.EstimatedItems++
				}
				if nutrient.Low == nil || nutrient.High == nil {
					bounded = false
				} else {
					low += *nutrient.Low
					high += *nutrient.High
				}
			}
			if total.KnownItems > 0 {
				total.KnownSubtotal = &sum
			}
			total.CompleteForLoggedItems = len(items) > 0 && total.KnownItems == len(items)
			// Ranges describe all logged items only when every item has a range.
			if bounded && total.CompleteForLoggedItems {
				total.Low = &low
				total.High = &high
			}
			day.Nutrients[key] = total
		}
		totals = append(totals, day)
		date = date.AddDate(0, 0, 1)
	}
	return totals, nil
}
