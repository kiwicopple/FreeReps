package mcp

import (
	"context"
	"strings"

	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
	"github.com/google/uuid"
	"github.com/mark3labs/mcp-go/mcp"
)

var toolSaveFood = mcp.NewTool("save_food_entry",
	mcp.WithDescription(`WRITE a consumed food/drink/supplement record, or correct/void it without losing history. Only log what the user reports consuming. Do not store images. Read get_nutrient_catalog first for the schema and units. Nutrient amounts are TOTALS FOR THE CONSUMED PORTION, not per 100 g. Omit unknown nutrients; never invent vitamins. Use a stable UUID for each eating event and reuse it on retries. expected_version=0 creates, a current version corrects. Return the saved ID and version to the user only after success.`),
	mcp.WithString("record_json", mcp.Required(), mcp.Description("JSON object {entry, expected_version, reason}. Get schema from get_nutrient_catalog.")),
)
var toolGetFood = mcp.NewTool("get_food_log",
	mcp.WithDescription("Read food entries and daily nutrient subtotals with known-item coverage. Unknown is not zero; totals describe logged intake only, never completeness of the day. Voided entries remain visible but are excluded from totals."),
	mcp.WithString("start", mcp.Required(), mcp.Description("Inclusive local consumption date YYYY-MM-DD")),
	mcp.WithString("end", mcp.Required(), mcp.Description("Exclusive local consumption date YYYY-MM-DD, within 366 days")),
)
var toolFoodHistory = mcp.NewTool("get_food_history",
	mcp.WithDescription("Read all revisions of an authenticated user's food entry, including corrections and voids."),
	mcp.WithString("id", mcp.Required(), mcp.Description("Food entry UUID")),
)
var toolFoodCatalog = mcp.NewTool("get_nutrient_catalog", mcp.WithDescription("Read supported food nutrient keys and canonical units, and the food logging schema and estimation rules."))

func (h *handlers) saveFood(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	raw, err := req.RequireString("record_json")
	if err != nil || len(raw) > 256*1024 {
		return mcp.NewToolResultError("record_json is required and limited to 256 KiB"), nil
	}
	input, err := models.DecodeFood(strings.NewReader(raw))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	result, err := h.ds.SaveFoodEntry(ctx, UserIDFromContext(ctx), input)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(result)
}
func (h *handlers) getFood(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	start, end := req.GetString("start", ""), req.GetString("end", "")
	records, err := h.ds.ListFoodEntries(ctx, UserIDFromContext(ctx), start, end)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	days, err := storage.SummarizeFood(records, start, end)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(map[string]any{"entries": records, "days": days, "end_exclusive": end})
}
func (h *handlers) foodHistory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	id := req.GetString("id", "")
	if _, err := uuid.Parse(id); err != nil {
		return mcp.NewToolResultError("invalid entry ID"), nil
	}
	result, err := h.ds.FoodHistory(ctx, UserIDFromContext(ctx), id)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(result)
}
func (h *handlers) foodCatalog(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultJSON(map[string]any{
		"units": models.NutrientUnits,
		"schema": map[string]any{
			"expected_version": "0 for new entries; current saved version for correction or void",
			"reason":           "required short explanation of initial log or correction",
			"entry": map[string]any{
				"id": "new UUID, reuse for retries and corrections", "local_date": "YYYY-MM-DD", "timezone": "IANA name, e.g. Asia/Singapore",
				"eaten_at": "optional RFC3339 timestamp; must agree with local_date", "time_precision": "exact | approximate | date_only (omit eaten_at for date_only)",
				"meal": "optional descriptive label", "status": "recorded | voided", "notes": "text only",
				"items": []any{map[string]any{
					"name": "food/drink/supplement name and brand if known", "kind": "food | drink | supplement",
					"portion": "amount actually consumed, not merely pictured", "grams": "optional positive gram weight",
					"portion_basis": "weighed | label | user | photo_estimate", "assumptions": "portion, ingredients, cooking fats; required for photo_estimate",
					"nutrients": map[string]any{"<catalog key>": map[string]string{"value": "nonnegative number for consumed portion", "unit": "exact catalog unit", "low": "optional lower estimate, paired with high", "high": "optional upper estimate", "basis": "label | database | estimate | measured", "confidence": "low | medium | high", "reference": "actual label, food-database identifier/URL, or explicit model estimate; never fabricated citations"}},
				}},
			},
		},
		"rules": []string{"Unknown nutrient = omitted key, not zero. Entire nutrient maps may be empty.", "Ranges express assumptions, not statistical confidence intervals.", "Keep supplements as separate items. Record elemental mineral amounts from the label.", "Do not add overlapping totals (e.g. total omega-3 plus EPA/DHA, or alternative folate measures).", "Photo identification cannot measure hidden ingredients or vitamin levels. Ask about consumption/portion ambiguity; prefer labels or verified food-composition references.", "No image fields or image storage. Blood biomarkers are separate measurements, not food intake."},
	})
}
