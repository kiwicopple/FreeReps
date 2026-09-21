package mcp

import (
	"context"
	"strings"

	"github.com/claude/freereps/internal/models"
	"github.com/mark3labs/mcp-go/mcp"
)

var toolGetNutrition = mcp.NewTool("get_nutrition_protocol", mcp.WithDescription("Read all immutable nutrition protocol revisions, ordered by version. For a date choose greatest effective_date <= date, breaking ties by version. Targets are planning references, not diagnoses. Latest version is the save conflict token."))
var toolSaveNutrition = mcp.NewTool("save_nutrition_protocol", mcp.WithDescription(`Save a user-authorized nutrition protocol. Read current protocol first; preserve fields not being changed. JSON: {expected_version,reason,protocol:{effective_date,timezone,profile:{age,sex,height_cm,weight_kg,activity,goal,preferences},notes,targets:{nutrient_key:{value,unit,kind,label,source,low?,high?,upper?}}}}. kind=goal|range|maximum|reference. Units from get_nutrient_catalog. low/high required for range. upper is only for supported unambiguous total-intake ULs. Use 0 for first version. Dates YYYY-MM-DD. Never copy another person's supplement protocol or treat unknown intake as zero.`), mcp.WithString("record_json", mcp.Required(), mcp.Description("Protocol save request JSON")))
var toolGetNutritionDays = mcp.NewTool("get_nutrition_days", mcp.WithDescription("Read completion states and versions for dates. Absent date means incomplete, version 0. Completion is user-reported full-day logging, not complete nutrient composition."), mcp.WithString("start", mcp.Required(), mcp.Description("Inclusive YYYY-MM-DD")), mcp.WithString("end", mcp.Required(), mcp.Description("Exclusive YYYY-MM-DD")))
var toolSaveNutritionDay = mcp.NewTool("save_nutrition_day", mcp.WithDescription("Mark a day complete or reopen it only at the user's request. Read current version first. Food edits reopen affected days and invalidate stale versions."), mcp.WithString("date", mcp.Required(), mcp.Description("YYYY-MM-DD")), mcp.WithBoolean("complete", mcp.Required(), mcp.Description("Whether all intake was logged")), mcp.WithNumber("expected_version", mcp.Required(), mcp.Description("Current day version, 0 if absent")))

func (h *handlers) getNutrition(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	out, err := h.ds.NutritionProtocols(ctx, UserIDFromContext(ctx))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(out)
}
func (h *handlers) saveNutrition(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	raw, err := req.RequireString("record_json")
	if err != nil || len(raw) > 65536 {
		return mcp.NewToolResultError("record_json required; max 64 KiB"), nil
	}
	r, err := models.DecodeNutrition(strings.NewReader(raw))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	out, err := h.ds.SaveNutritionProtocol(ctx, UserIDFromContext(ctx), r)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(out)
}
func (h *handlers) getNutritionDays(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	out, err := h.ds.NutritionDays(ctx, UserIDFromContext(ctx), req.GetString("start", ""), req.GetString("end", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(out)
}
func (h *handlers) saveNutritionDay(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	complete, err := req.RequireBool("complete")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	version, err := req.RequireInt("expected_version")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	out, err := h.ds.SaveNutritionDay(ctx, UserIDFromContext(ctx), req.GetString("date", ""), complete, version)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultJSON(out)
}
