import {
  OpenRouterAutoError,
  formatErrorForDisplay,
  getRetryDelay,
  isRetryableError,
  parseOpenRouterError,
} from "../src/errors";

describe("parseOpenRouterError", () => {
  it("maps 401 to INVALID_API_KEY", () => {
    const axiosError = {
      response: { status: 401, data: { error: { message: "Unauthorized" } } },
      message: "Request failed",
    };
    const err = parseOpenRouterError(axiosError);
    expect(err.code).toBe("INVALID_API_KEY");
    expect(err.retryable).toBe(false);
  });

  it("maps 429 to RATE_LIMITED and marks retryable", () => {
    const axiosError = {
      response: { status: 429, data: { message: "Too many requests" } },
      message: "Rate limited",
    };
    const err = parseOpenRouterError(axiosError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps network errors", () => {
    const err = parseOpenRouterError({
      code: "ECONNREFUSED",
      message: "Connection refused",
    });
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("maps timeout errors from message", () => {
    const err = parseOpenRouterError({ message: "Request timeout exceeded" });
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(true);
  });

  it("falls back to UNKNOWN", () => {
    const err = parseOpenRouterError({ message: "Something weird" });
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
  });
});

describe("OpenRouterAutoError", () => {
  it("extends Error with code and retryable", () => {
    const err = new OpenRouterAutoError({
      code: "MODEL_NOT_FOUND",
      message: "Not found",
      retryable: false,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("MODEL_NOT_FOUND");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("Not found");
  });
});

describe("isRetryableError", () => {
  it("returns true for retryable error", () => {
    expect(
      isRetryableError({ code: "RATE_LIMITED", message: "", retryable: true }),
    ).toBe(true);
  });

  it("returns false for non-retryable error", () => {
    expect(
      isRetryableError({
        code: "INVALID_API_KEY",
        message: "",
        retryable: false,
      }),
    ).toBe(false);
  });
});

describe("getRetryDelay", () => {
  it("increases exponentially", () => {
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(2000);
    expect(getRetryDelay(2)).toBe(4000);
  });

  it("caps at 30 seconds", () => {
    expect(getRetryDelay(100)).toBe(30000);
  });
});

describe("formatErrorForDisplay", () => {
  it("includes retry indicator for retryable errors", () => {
    const display = formatErrorForDisplay({
      code: "RATE_LIMITED",
      message: "Rate limited",
      retryable: true,
    });
    expect(display).toContain("retryable");
  });
});
