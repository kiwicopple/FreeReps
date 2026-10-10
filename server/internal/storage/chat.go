package storage

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/claude/freereps/internal/models"
	"github.com/jackc/pgx/v5"
)

var ErrChatBusy = errors.New("another message is still being answered; wait a moment and retry")
var ErrChatChanged = errors.New("this message id has already been used; send edited text as a new message")

// LockChat serializes a user's chat across processes without holding a transaction
// open over the model request. Closing a failed connection releases its lock too.
func (db *DB) LockChat(ctx context.Context, uid int) (func(), error) {
	c, err := db.Pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	var locked bool
	if err = c.QueryRow(ctx, `SELECT pg_try_advisory_lock(735,$1)`, uid).Scan(&locked); err != nil || !locked {
		c.Release()
		if err != nil {
			return nil, err
		}
		return nil, ErrChatBusy
	}
	return func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := c.Exec(cleanup, `SELECT pg_advisory_unlock(735,$1)`, uid); err != nil {
			_ = c.Conn().Close(cleanup)
		}
		c.Release()
	}, nil
}

func (db *DB) ChatKey(ctx context.Context, uid int) (string, error) {
	var key string
	err := db.Pool.QueryRow(ctx, `SELECT api_key FROM chat_credentials WHERE user_id=$1`, uid).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return key, err
}
func (db *DB) SaveChatKey(ctx context.Context, uid int, key string) error {
	_, err := db.Pool.Exec(ctx, `INSERT INTO chat_credentials(user_id,api_key) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET api_key=excluded.api_key`, uid, key)
	return err
}

const chatColumns = `sequence,id::text,request_hash,message,image_count,timezone,local_date::text,reply,food_request,saved_entry_id::text,status,created_at`

func scanChat(row pgx.Row) (models.ChatTurn, error) {
	var t models.ChatTurn
	var food []byte
	err := row.Scan(&t.Sequence, &t.ID, &t.RequestHash, &t.Message, &t.ImageCount, &t.Timezone, &t.LocalDate, &t.Reply, &food, &t.SavedEntryID, &t.Status, &t.CreatedAt)
	if err == nil && len(food) > 0 {
		err = json.Unmarshal(food, &t.FoodRequest)
	}
	if t.SavedEntryID != nil && t.FoodRequest != nil {
		t.SavedDate = t.FoodRequest.Entry.LocalDate
	}
	return t, err
}
func (db *DB) ChatHistory(ctx context.Context, uid int, before int64) ([]models.ChatTurn, error) {
	rows, err := db.Pool.Query(ctx, `SELECT `+chatColumns+` FROM chat_turns WHERE user_id=$1 AND ($2::bigint=0 OR sequence<$2) ORDER BY sequence DESC LIMIT 50`, uid, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ChatTurn{}
	for rows.Next() {
		t, err := scanChat(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result, rows.Err()
}
func (db *DB) StartChatTurn(ctx context.Context, uid int, r models.ChatRequest) (models.ChatTurn, error) {
	if err := r.Validate(); err != nil {
		return models.ChatTurn{}, err
	}
	_, err := db.Pool.Exec(ctx, `INSERT INTO chat_turns(user_id,id,request_hash,message,image_count,timezone,local_date) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, uid, r.ID, r.Hash(), r.Message, len(r.Images), r.Timezone, r.LocalDate)
	if err != nil {
		return models.ChatTurn{}, err
	}
	t, err := scanChat(db.Pool.QueryRow(ctx, `SELECT `+chatColumns+` FROM chat_turns WHERE user_id=$1 AND id=$2`, uid, r.ID))
	if err == nil && t.RequestHash != r.Hash() {
		return t, ErrChatChanged
	}
	return t, err
}
func (db *DB) PrepareChatTurn(ctx context.Context, uid int, id, reply string, food *models.SaveFoodRequest) error {
	var raw any
	if food != nil {
		b, err := json.Marshal(food)
		if err != nil {
			return err
		}
		raw = b
	}
	_, err := db.Pool.Exec(ctx, `UPDATE chat_turns SET reply=$3,food_request=$4,status='prepared' WHERE user_id=$1 AND id=$2 AND status='pending'`, uid, id, reply, raw)
	return err
}
func (db *DB) CompleteChatTurn(ctx context.Context, uid int, id, reply string, saved *string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE chat_turns SET reply=$3,saved_entry_id=$4,status='complete' WHERE user_id=$1 AND id=$2`, uid, id, reply, saved)
	return err
}
func (db *DB) PreparedChatTurns(ctx context.Context, uid int) ([]models.ChatTurn, error) {
	rows, err := db.Pool.Query(ctx, `SELECT `+chatColumns+` FROM chat_turns WHERE user_id=$1 AND status='prepared' ORDER BY sequence`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ChatTurn{}
	for rows.Next() {
		t, err := scanChat(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}
