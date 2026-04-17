package openrouterauto

import (
	"encoding/json"
	"strconv"
	"strings"

	_ "embed"
)

//go:embed registry/cost.json
var costJSON []byte

type priceTierEntry struct {
	MaxAvgPrice *float64 `json:"max_avg_price"`
}

type costRegistry struct {
	PriceTiers                 map[string]priceTierEntry `json:"price_tiers"`
	TokenEstimateCharsPerToken int                       `json:"token_estimate_chars_per_token"`
	MessageOverheadTokens      int                       `json:"message_overhead_tokens"`
}

var costReg costRegistry

func init() {
	if err := json.Unmarshal(costJSON, &costReg); err != nil {
		panic("openrouterauto: failed to load cost.json: " + err.Error())
	}
}

// IsFreeModel returns true when the model carries zero-cost pricing or a :free suffix.
func IsFreeModel(model Model) bool {
	if strings.HasSuffix(model.ID, ":free") {
		return true
	}
	return parsePrice(model.Pricing.Prompt) == 0 && parsePrice(model.Pricing.Completion) == 0
}

// GetPriceTier classifies a model as "free", "cheap", "moderate", or "expensive".
func GetPriceTier(model Model) string {
	if IsFreeModel(model) {
		return "free"
	}
	avg := (parsePrice(model.Pricing.Prompt) + parsePrice(model.Pricing.Completion)) / 2
	for _, tier := range []string{"cheap", "moderate"} {
		entry, ok := costReg.PriceTiers[tier]
		if ok && entry.MaxAvgPrice != nil && avg <= *entry.MaxAvgPrice {
			return tier
		}
	}
	return "expensive"
}

// CalculateCost returns a CostEstimate for the given token counts.
// The OpenRouter API returns prices as per-1K-token strings.
func CalculateCost(model Model, promptTokens, completionTokens int) CostEstimate {
	pp := parsePrice(model.Pricing.Prompt)
	cp := parsePrice(model.Pricing.Completion)
	promptCost := (float64(promptTokens) / 1000) * pp
	completionCost := (float64(completionTokens) / 1000) * cp
	return CostEstimate{
		PromptCost:     promptCost,
		CompletionCost: completionCost,
		TotalCost:      promptCost + completionCost,
		Currency:       "USD",
	}
}

// EstimateTokens returns a rough token count for text using the registry ratio.
func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}
	cpt := costReg.TokenEstimateCharsPerToken
	if cpt <= 0 {
		cpt = 4
	}
	return (len(text) + cpt - 1) / cpt
}

// parsePrice converts the OpenRouter string price to float64.
func parsePrice(s string) float64 {
	if s == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
