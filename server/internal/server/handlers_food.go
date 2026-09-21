package server

import (
	"errors"
	"net/http"

	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (s *Server) handleSaveFood(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 256*1024)
	req, err := models.DecodeFood(r.Body)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	record, err := s.db.SaveFoodEntry(r.Context(), uid, req)
	if err != nil {
		status := http.StatusInternalServerError
		message := "could not save food entry"
		if errors.Is(err, storage.ErrFoodConflict) {
			status = http.StatusConflict
			message = err.Error()
		}
		if errors.Is(err, storage.ErrFoodNotFound) {
			status = http.StatusNotFound
			message = err.Error()
		}
		s.log.Error("saving food entry", "error", err)
		writeJSON(w, status, map[string]string{"error": message})
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (s *Server) handleFoodCatalog(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUserID(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, models.NutrientUnits)
}

func (s *Server) handleFoodEntries(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	start, end := r.URL.Query().Get("start"), r.URL.Query().Get("end")
	if err := storage.FoodDateRange(start, end); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	records, err := s.db.ListFoodEntries(r.Context(), uid, start, end)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read food entries; try a shorter date range"})
		return
	}
	totals, err := storage.SummarizeFood(records, start, end)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not summarize food entries"})
		return
	}
	writeJSON(w, 200, map[string]any{"entries": records, "days": totals, "start": start, "end_exclusive": end})
}

func (s *Server) handleFoodHistory(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUserID(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid entry ID"})
		return
	}
	records, err := s.db.FoodHistory(r.Context(), uid, id)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "could not read revisions"})
		return
	}
	writeJSON(w, 200, records)
}
