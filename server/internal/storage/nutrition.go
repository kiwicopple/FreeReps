package storage

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/claude/freereps/internal/models"
)

var ErrNutritionConflict = errors.New("nutrition data changed; refresh before saving")

type NutritionProtocolRecord struct {
	Protocol   models.NutritionProtocol `json:"protocol"`
	Version    int                      `json:"version"`
	Reason     string                   `json:"reason"`
	RecordedAt time.Time                `json:"recorded_at"`
}
type NutritionDay struct {
	Date     string `json:"date"`
	Complete bool   `json:"complete"`
	Version  int    `json:"version"`
}

func (db *DB) NutritionProtocols(ctx context.Context, uid int) ([]NutritionProtocolRecord, error) {
	rows, err := db.Pool.Query(ctx, `SELECT payload,version,reason,recorded_at FROM nutrition_protocols WHERE user_id=$1 ORDER BY version`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []NutritionProtocolRecord{}
	for rows.Next() {
		var r NutritionProtocolRecord
		var b []byte
		if err = rows.Scan(&b, &r.Version, &r.Reason, &r.RecordedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(b, &r.Protocol); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
func (db *DB) SaveNutritionProtocol(ctx context.Context, uid int, req models.SaveNutritionProtocol) (NutritionProtocolRecord, error) {
	var out NutritionProtocolRecord
	if err := req.Validate(); err != nil {
		return out, err
	}
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(734,$1)`, uid); err != nil {
		return out, err
	}
	var version int
	if err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(version),0) FROM nutrition_protocols WHERE user_id=$1`, uid).Scan(&version); err != nil {
		return out, err
	}
	payload, err := json.Marshal(req.Protocol)
	if err != nil {
		return out, err
	}
	if version > 0 {
		var equal bool
		if err = tx.QueryRow(ctx, `SELECT payload=$3::jsonb FROM nutrition_protocols WHERE user_id=$1 AND version=$2`, uid, version, payload).Scan(&equal); err != nil {
			return out, err
		}
		if equal {
			out.Protocol = req.Protocol
			out.Version = version
			err = tx.QueryRow(ctx, `SELECT reason,recorded_at FROM nutrition_protocols WHERE user_id=$1 AND version=$2`, uid, version).Scan(&out.Reason, &out.RecordedAt)
			return out, err
		}
	}
	if version != req.ExpectedVersion {
		return out, ErrNutritionConflict
	}
	out.Protocol = req.Protocol
	out.Version = version + 1
	out.Reason = req.Reason
	err = tx.QueryRow(ctx, `INSERT INTO nutrition_protocols(user_id,version,effective_date,payload,reason) VALUES($1,$2,$3,$4,$5) RETURNING recorded_at`, uid, out.Version, req.Protocol.EffectiveDate, payload, req.Reason).Scan(&out.RecordedAt)
	if err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}
func (db *DB) NutritionDays(ctx context.Context, uid int, start, end string) ([]NutritionDay, error) {
	if err := FoodDateRange(start, end); err != nil {
		return nil, err
	}
	rows, err := db.Pool.Query(ctx, `SELECT to_char(local_date,'YYYY-MM-DD'),complete,version FROM nutrition_days WHERE user_id=$1 AND local_date >= $2 AND local_date < $3 ORDER BY local_date`, uid, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []NutritionDay{}
	for rows.Next() {
		var d NutritionDay
		if err = rows.Scan(&d.Date, &d.Complete, &d.Version); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (db *DB) SaveNutritionDay(ctx context.Context, uid int, date string, complete bool, expected int) (NutritionDay, error) {
	out := NutritionDay{Date: date, Complete: complete}
	if _, err := time.Parse("2006-01-02", date); err != nil || expected < 0 {
		return out, errors.New("invalid date or version")
	}
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(734,$1)`, uid); err != nil {
		return out, err
	}
	var version int
	if err = tx.QueryRow(ctx, `SELECT COALESCE((SELECT version FROM nutrition_days WHERE user_id=$1 AND local_date=$2),0)`, uid, date).Scan(&version); err != nil {
		return out, err
	}
	if version != expected {
		return out, ErrNutritionConflict
	}
	err = tx.QueryRow(ctx, `INSERT INTO nutrition_days(user_id,local_date,complete) VALUES($1,$2,$3) ON CONFLICT(user_id,local_date) DO UPDATE SET complete=EXCLUDED.complete,version=nutrition_days.version+1,updated_at=now() RETURNING version`, uid, date, complete).Scan(&out.Version)
	if err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}
