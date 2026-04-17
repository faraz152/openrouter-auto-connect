package openrouterauto

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	_ "embed"
)

//go:embed registry/errors.json
var errorsJSON []byte

// errorsRegistry mirrors packages/registry/errors.json.
type errorsRegistry struct {
	CodeMap   map[string]string `json:"code_map"`
	Messages  map[string]string `json:"messages"`
	Tips      map[string]string `json:"tips"`
	Retryable []string          `json:"retryable"`
}

var errs errorsRegistry

func init() {
	if err := json.Unmarshal(errorsJSON, &errs); err != nil {
		panic("openrouterauto: failed to load errors.json: " + err.Error())
	}
}

// ErrorCode is a named error code string matching the registry.
type ErrorCode = string

// Named error code constants — identical to the other SDKs.
const (
	ErrInvalidAPIKey        ErrorCode = "INVALID_API_KEY"
	ErrRateLimited          ErrorCode = "RATE_LIMITED"
	ErrModelNotFound        ErrorCode = "MODEL_NOT_FOUND"
	ErrModelUnavailable     ErrorCode = "MODEL_UNAVAILABLE"
	ErrInvalidParameters    ErrorCode = "INVALID_PARAMETERS"
	ErrInsufficientCredits  ErrorCode = "INSUFFICIENT_CREDITS"
	ErrProviderError        ErrorCode = "PROVIDER_ERROR"
	ErrNetworkError         ErrorCode = "NETWORK_ERROR"
	ErrTimeout              ErrorCode = "TIMEOUT"
	ErrUnknown              ErrorCode = "UNKNOWN"
)

// ORAError is the SDK-level error type. It implements the error interface.
type ORAError struct {
	Code      ErrorCode
	Message   string
	Retryable bool
	Details   map[string]any
}

func (e *ORAError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Format returns the error with a user-facing tip.
func (e *ORAError) Format() string {
	s := "❌ " + e.Message
	if tip, ok := errs.Tips[e.Code]; ok {
		s += "\n💡 Tip: " + tip
	}
	if e.Retryable {
		s += "\n🔄 This error is retryable."
	}
	return s
}

// isRetryable checks whether the given code is in the registry retryable list.
func isRetryable(code ErrorCode) bool {
	for _, c := range errs.Retryable {
		if c == code {
			return true
		}
	}
	return false
}

// parseHTTPError converts an HTTP response into an ORAError.
// It sanitises the details to exclude auth headers.
func parseHTTPError(resp *http.Response, body []byte) *ORAError {
	statusKey := fmt.Sprintf("%d", resp.StatusCode)
	code, ok := errs.CodeMap[statusKey]
	if !ok {
		code = ErrUnknown
	}

	// Try to extract a message from the JSON body
	message := errs.Messages[code]
	var bodyData map[string]any
	if json.Unmarshal(body, &bodyData) == nil {
		// Check for specific patterns that override the code
		var apiMsg string
		if errObj, ok := bodyData["error"].(map[string]any); ok {
			if m, ok := errObj["message"].(string); ok {
				apiMsg = m
			}
		} else if m, ok := bodyData["message"].(string); ok {
			apiMsg = m
		}
		if apiMsg != "" {
			lower := strings.ToLower(apiMsg)
			switch {
			case strings.Contains(lower, "credit") || strings.Contains(lower, "balance"):
				code = ErrInsufficientCredits
			case strings.Contains(lower, "model") && strings.Contains(lower, "not found"):
				code = ErrModelNotFound
			case strings.Contains(lower, "rate limit") || strings.Contains(lower, "too many"):
				code = ErrRateLimited
			case strings.Contains(lower, "invalid key") || strings.Contains(lower, "unauthorized"):
				code = ErrInvalidAPIKey
			}
			message = errs.Messages[code]
			if code == ErrUnknown {
				message += " (" + apiMsg + ")"
			}
		}
	}

	return &ORAError{
		Code:      code,
		Message:   message,
		Retryable: isRetryable(code),
		Details:   map[string]any{"status": resp.StatusCode},
	}
}

// newNetworkError wraps a Go network/timeout error into an ORAError.
func newNetworkError(err error) *ORAError {
	msg := err.Error()
	code := ErrNetworkError
	if strings.Contains(strings.ToLower(msg), "timeout") || strings.Contains(strings.ToLower(msg), "deadline") {
		code = ErrTimeout
	}
	return &ORAError{
		Code:      code,
		Message:   errs.Messages[code],
		Retryable: isRetryable(code),
		Details:   map[string]any{"error_type": fmt.Sprintf("%T", err)},
	}
}
