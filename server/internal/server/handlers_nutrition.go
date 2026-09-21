package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
	"github.com/go-chi/chi/v5"
)

func nutritionStatus(err error) int {
	if errors.Is(err, storage.ErrNutritionConflict) {
		return http.StatusConflict
	}
	return http.StatusInternalServerError
}
func (s *Server) handleNutritionProtocols(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	data, err := s.db.NutritionProtocols(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read protocols"})
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) handleSaveNutritionProtocol(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	req, err := models.DecodeNutrition(r.Body)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	data, err := s.db.SaveNutritionProtocol(r.Context(), uid, req)
	if err != nil {
		writeJSON(w, nutritionStatus(err), map[string]string{"error": "could not save protocol; refresh and retry"})
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) handleNutritionDays(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	start, end := r.URL.Query().Get("start"), r.URL.Query().Get("end")
	if err := storage.FoodDateRange(start, end); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	data, err := s.db.NutritionDays(r.Context(), uid, start, end)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read completion"})
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) handleNutritionDay(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	date := chi.URLParam(r, "date")
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid date"})
		return
	}
	data, err := s.db.NutritionDays(r.Context(), uid, date, t.AddDate(0, 0, 1).Format("2006-01-02"))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read day"})
		return
	}
	if len(data) == 0 {
		writeJSON(w, 200, storage.NutritionDay{Date: date})
		return
	}
	writeJSON(w, 200, data[0])
}
func (s *Server) handleSaveNutritionDay(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	date := chi.URLParam(r, "date")
	var req struct {
		Complete        *bool `json:"complete"`
		ExpectedVersion *int  `json:"expected_version"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	d.DisallowUnknownFields()
	if err := d.Decode(&req); err != nil || req.Complete == nil || req.ExpectedVersion == nil {
		writeJSON(w, 400, map[string]string{"error": "complete and expected_version required"})
		return
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		writeJSON(w, 400, map[string]string{"error": "expected one object"})
		return
	}
	if _, err := time.Parse("2006-01-02", date); err != nil || *req.ExpectedVersion < 0 {
		writeJSON(w, 400, map[string]string{"error": "invalid date or version"})
		return
	}
	data, err := s.db.SaveNutritionDay(r.Context(), uid, date, *req.Complete, *req.ExpectedVersion)
	if err != nil {
		writeJSON(w, nutritionStatus(err), map[string]string{"error": "day changed; refresh and retry"})
		return
	}
	writeJSON(w, 200, data)
}
