package models

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// ChatRequest contains transient photos; only its digest and text enter storage.
type ChatRequest struct {
	ID        string   `json:"id"`
	Message   string   `json:"message"`
	Images    []string `json:"images"`
	Timezone  string   `json:"timezone"`
	LocalDate string   `json:"local_date"`
}

func (r ChatRequest) Validate() error {
	id, err := uuid.Parse(r.ID)
	if err != nil || id == uuid.Nil {
		return errors.New("message id must be a UUID")
	}
	if utf8.RuneCountInString(r.Message) > 6000 || (strings.TrimSpace(r.Message) == "" && len(r.Images) == 0) {
		return errors.New("add a message or photo (text limit 6,000 characters)")
	}
	if len(r.Images) > 3 {
		return errors.New("attach up to three photos")
	}
	if _, err = time.LoadLocation(r.Timezone); err != nil || r.Timezone == "" || r.Timezone == "Local" {
		return errors.New("a valid device timezone is required")
	}
	if _, err = time.Parse("2006-01-02", r.LocalDate); err != nil {
		return errors.New("a valid local date is required")
	}
	for _, data := range r.Images {
		prefix, encoded, ok := strings.Cut(data, ",")
		if !ok || (prefix != "data:image/jpeg;base64" && prefix != "data:image/png;base64") || len(encoded) > 3*1024*1024 {
			return errors.New("photos must be JPEG or PNG and under 2 MB")
		}
		raw, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil || len(raw) > 2*1024*1024 {
			return errors.New("invalid photo")
		}
		cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
		if err != nil || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 4096 || cfg.Height > 4096 || cfg.Width*cfg.Height > 16000000 || !strings.Contains(prefix, "image/"+format+";") {
			return errors.New("invalid photo dimensions or type")
		}
	}
	return nil
}

func (r ChatRequest) Hash() string {
	b, _ := json.Marshal(r)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

type ChatTurn struct {
	Sequence     int64            `json:"sequence"`
	ID           string           `json:"id"`
	RequestHash  string           `json:"-"`
	Message      string           `json:"message"`
	ImageCount   int              `json:"image_count"`
	Timezone     string           `json:"timezone"`
	LocalDate    string           `json:"local_date"`
	Reply        string           `json:"reply"`
	FoodRequest  *SaveFoodRequest `json:"-"`
	SavedDate    string           `json:"saved_date,omitempty"`
	SavedEntryID *string          `json:"saved_entry_id,omitempty"`
	Status       string           `json:"status"`
	CreatedAt    time.Time        `json:"created_at"`
}
