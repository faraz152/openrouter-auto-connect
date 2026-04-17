package openrouterauto

import (
	"encoding/json"
	"fmt"

	_ "embed"
)

//go:embed registry/parameters.json
var parametersJSON []byte

//go:embed registry/platform-params.json
var platformParamsJSON []byte

type parameterDef struct {
	Type    string   `json:"type"`
	Min     *float64 `json:"min"`
	Max     *float64 `json:"max"`
	Default any      `json:"default"`
	Enum    []any    `json:"enum"`
}

var (
	paramDefs      map[string]parameterDef
	platformParams map[string]bool
)

func init() {
	if err := json.Unmarshal(parametersJSON, &paramDefs); err != nil {
		panic("openrouterauto: failed to load parameters.json: " + err.Error())
	}
	var list []string
	if err := json.Unmarshal(platformParamsJSON, &list); err != nil {
		panic("openrouterauto: failed to load platform-params.json: " + err.Error())
	}
	platformParams = make(map[string]bool, len(list))
	for _, p := range list {
		platformParams[p] = true
	}
}

// ValidateParameters checks params against the registry definitions for model.
// Returns a slice of human-readable error strings (empty = valid).
func ValidateParameters(model Model, params map[string]any) []string {
	supported := make(map[string]bool, len(model.SupportedParameters))
	for _, p := range model.SupportedParameters {
		supported[p] = true
	}
	var errsOut []string
	for name, value := range params {
		// Platform-level params are always allowed.
		if platformParams[name] {
			continue
		}
		if !supported[name] {
			errsOut = append(errsOut, fmt.Sprintf("%s is not supported by model %s", name, model.ID))
			continue
		}
		def, ok := paramDefs[name]
		if !ok {
			continue // unknown param — pass through
		}
		if msg := validateParamValue(name, value, def); msg != "" {
			errsOut = append(errsOut, msg)
		}
	}
	return errsOut
}

// GetDefaultParameters returns a map of param name → default value for a model.
func GetDefaultParameters(model Model) map[string]any {
	defaults := make(map[string]any)
	for _, name := range model.SupportedParameters {
		if def, ok := paramDefs[name]; ok && def.Default != nil {
			defaults[name] = def.Default
		}
	}
	return defaults
}

func validateParamValue(name string, value any, def parameterDef) string {
	switch def.Type {
	case "number":
		v, ok := toFloat64(value)
		if !ok {
			return fmt.Sprintf("%s must be a number", name)
		}
		if def.Min != nil && v < *def.Min {
			return fmt.Sprintf("%s must be >= %g", name, *def.Min)
		}
		if def.Max != nil && v > *def.Max {
			return fmt.Sprintf("%s must be <= %g", name, *def.Max)
		}
	case "integer":
		// JSON numbers decode as float64; accept both float64 (whole) and int.
		switch v := value.(type) {
		case float64:
			if v != float64(int(v)) {
				return fmt.Sprintf("%s must be an integer", name)
			}
		case int:
			// ok
		default:
			return fmt.Sprintf("%s must be an integer", name)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Sprintf("%s must be a boolean", name)
		}
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Sprintf("%s must be a string", name)
		}
	}
	return ""
}

func toFloat64(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	}
	return 0, false
}
