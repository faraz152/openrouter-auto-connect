# Multi-Language SDK Expansion Plan

**Goal:** Enable adding new language SDKs (Go, Rust, etc.) with ~400-500 LOC each by extracting shared data into a language-agnostic `packages/registry/` that all SDKs consume.

**Metric:** After Phase 1, adding a new language SDK requires ZERO changes to registry files — only a thin HTTP wrapper.

---

## Current Problem

The TS and Python SDKs duplicate ~40-50% of their code as identical data:

| Duplicated Data                 | TS Source       | Python Source   | Lines |
| ------------------------------- | --------------- | --------------- | ----- |
| Parameter definitions + ranges  | `parameters.ts` | `parameters.py` | ~100  |
| Platform params whitelist       | `parameters.ts` | `parameters.py` | ~25   |
| Error code → status mapping     | `errors.ts`     | `errors.py`     | ~15   |
| Error messages (user-facing)    | `errors.ts`     | `errors.py`     | ~12   |
| Error tips                      | `errors.ts`     | `errors.py`     | ~10   |
| Retryable error list            | `errors.ts`     | `errors.py`     | ~5    |
| Price tier thresholds           | `cost.ts`       | `cost.py`       | ~8    |
| **Total duplicated data lines** |                 |                 | ~175  |

Every new language would add another 175 lines of copy-paste that must stay in sync.

---

## Architecture After Expansion

```
packages/
├── registry/                          ← NEW: single source of truth (JSON)
│   ├── parameters.json                ← defaults, ranges, types, descriptions
│   ├── errors.json                    ← code map, messages, tips, retryable
│   ├── cost.json                      ← tier thresholds
│   └── platform-params.json           ← always-allowed param names
│
├── core/        → reads registry/ at build time (tsup resolveJsonModule)
├── python/      → reads registry/ at import time (importlib.resources / json.load)
├── react/       → unchanged (wraps core/)
├── go/          → Phase 2: reads registry/ via go:embed
└── rust/        → Phase 3: reads registry/ via include_str!
```

---

## Phase 1 — Extract Registry (current TS + Python, zero breaking changes)

**Scope:** Create `packages/registry/` with 4 JSON files. Refactor TS and Python to import from them. No new languages yet.

### Step 1.1 — Create `packages/registry/parameters.json`

Extract from `parameters.ts` / `parameters.py`:

```jsonc
{
  "parameters": {
    "temperature": {
      "type": "number",
      "description": "Controls randomness. Lower = more deterministic, higher = more creative.",
      "default": 1.0,
      "min": 0,
      "max": 2
    },
    "top_p": { ... },
    // ... all 13 parameters
  }
}
```

**Source:** `DEFAULT_PARAMETERS` from both `parameters.ts` and `parameters.py` — identical data.

### Step 1.2 — Create `packages/registry/platform-params.json`

Extract from `PLATFORM_PARAMS` (Set in TS, frozenset in Python):

```json
[
  "model",
  "messages",
  "stream",
  "stream_options",
  "tools",
  "tool_choice",
  "parallel_tool_calls",
  "reasoning",
  "include",
  "response_format",
  "provider",
  "models",
  "route",
  "plugins",
  "metadata",
  "trace",
  "session_id",
  "user",
  "modalities",
  "logprobs",
  "top_logprobs",
  "cache_control",
  "service_tier"
]
```

### Step 1.3 — Create `packages/registry/errors.json`

Extract from `errors.ts` / `errors.py`:

```jsonc
{
  "code_map": {
    "401": "INVALID_API_KEY",
    "403": "INVALID_API_KEY",
    "429": "RATE_LIMITED",
    // ... all status→code mappings
    "ECONNREFUSED": "NETWORK_ERROR",
    "ETIMEDOUT": "TIMEOUT",
  },
  "messages": {
    "INVALID_API_KEY": "Invalid or missing API key. Please check your OpenRouter API key.",
    "RATE_LIMITED": "Rate limit exceeded. Please wait before making more requests.",
    // ... all 10 error codes
  },
  "tips": {
    "RATE_LIMITED": "Wait a few seconds before retrying.",
    "INSUFFICIENT_CREDITS": "Visit https://openrouter.ai/credits to add more credits.",
    "MODEL_NOT_FOUND": "Try refreshing the model list to get the latest models.",
    "MODEL_UNAVAILABLE": "Free models are often intermittently unavailable. Use getBestFreeModel() to find a working one, or skip the test when adding.",
    "PROVIDER_ERROR": "This model may be temporarily unavailable. Try another model.",
    "INVALID_PARAMETERS": "Check that your parameters are within the model's supported range.",
  },
  "retryable": [
    "RATE_LIMITED",
    "PROVIDER_ERROR",
    "NETWORK_ERROR",
    "TIMEOUT",
    "MODEL_UNAVAILABLE",
  ],
}
```

### Step 1.4 — Create `packages/registry/cost.json`

Extract from `cost.ts` / `cost.py`:

```json
{
  "price_tiers": {
    "free": { "max_avg_price": 0 },
    "cheap": { "max_avg_price": 0.0001 },
    "moderate": { "max_avg_price": 0.01 },
    "expensive": { "max_avg_price": null }
  },
  "token_estimate_chars_per_token": 4,
  "message_overhead_tokens": 4
}
```

### Step 1.5 — Rewire TypeScript `packages/core/` to import from registry

Changes per file:

| File            | Change                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parameters.ts` | Replace inline `DEFAULT_PARAMETERS` object with `import params from '../../registry/parameters.json'` + construct `ParameterDefinition[]` from it. Replace `PLATFORM_PARAMS` Set with import from `platform-params.json`. |
| `errors.ts`     | Replace inline `ERROR_CODE_MAP`, `ERROR_MESSAGES`, tips, and `RETRYABLE_ERRORS` with imports from `errors.json`.                                                                                                          |
| `cost.ts`       | Replace hardcoded tier thresholds and token estimate constants with imports from `cost.json`.                                                                                                                             |
| `tsconfig.json` | Add `"resolveJsonModule": true` if not already present.                                                                                                                                                                   |

**No changes to:** `types.ts`, `sdk.ts`, `storage.ts`, `index.ts`, React components.

**Verification:** `npm run build && npx jest` → same 40/40 tests pass.

### Step 1.6 — Rewire Python `packages/python/` to load from registry

Changes per file:

| File            | Change                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parameters.py` | Replace inline `DEFAULT_PARAMETERS` dict with `json.load()` from `../../registry/parameters.json` + construct `ParameterDefinition` objects. Replace `PLATFORM_PARAMS` frozenset with load from `platform-params.json`. |
| `errors.py`     | Replace inline dicts with loads from `errors.json`.                                                                                                                                                                     |
| `cost.py`       | Replace hardcoded thresholds with loads from `cost.json`.                                                                                                                                                               |

**JSON loading strategy:** Use `importlib.resources` or `pathlib.Path(__file__).resolve()` to find `packages/registry/` relative to the package.

**Verification:** `pytest tests/ -q` → same 42/42 tests pass.

### Step 1.7 — Commit and push

```
git add packages/registry/ packages/core/ packages/python/
git commit -m "[REFACTOR] Extract shared data into packages/registry/ for multi-language support 📦"
git push
```

---

## Phase 2 — Go SDK (~400 LOC)

**Prereq:** Phase 1 complete.

### Structure

```
packages/go/
├── go.mod
├── go.sum
├── client.go           ← NewClient, FetchModels, AddModel, Chat
├── types.go            ← Go structs (generated or hand-written from types)
├── parameters.go       ← Load parameters.json via go:embed, validate
├── errors.go           ← Load errors.json via go:embed, parse
├── cost.go             ← Load cost.json via go:embed, calculate
├── storage.go          ← Memory + File adapters
├── client_test.go      ← Tests mirroring TS/Python
└── registry/           ← symlink or copy of packages/registry/
```

### Key decisions

- **HTTP client:** `net/http` (stdlib) — no external deps for core
- **JSON registry:** `go:embed` compiles JSON into the binary at build time
- **Async model:** Go uses goroutines natively — no async/await needed
- **Storage:** `sync.Map` for memory, `os.ReadFile`/`os.WriteFile` for file
- **Testing:** `go test ./...`

### Implementation order

1. `types.go` — struct definitions matching OpenRouter API
2. `client.go` — `NewClient(apiKey, opts)`, `FetchModels()`, `Chat(req)`
3. `parameters.go` — embed + parse `parameters.json`, validate function
4. `errors.go` — embed + parse `errors.json`, `ParseError(resp)`
5. `cost.go` — embed + parse `cost.json`, `CalculateCost(model, tokens)`
6. `storage.go` — memory + file adapters
7. `client_test.go` — unit tests with httptest mock server

**Estimated effort:** ~400 lines of Go + ~200 lines of tests.

---

## Phase 3 — Rust SDK (~500 LOC)

**Prereq:** Phase 1 complete.

### Structure

```
packages/rust/
├── Cargo.toml
├── src/
│   ├── lib.rs          ← re-exports
│   ├── client.rs       ← Client::new, fetch_models, add_model, chat
│   ├── types.rs        ← serde structs
│   ├── parameters.rs   ← include_str! + serde_json, validate
│   ├── errors.rs       ← include_str! + serde_json, parse
│   ├── cost.rs         ← include_str! + serde_json, calculate
│   └── storage.rs      ← HashMap memory + fs file
└── tests/
    └── integration.rs
```

### Key decisions

- **HTTP client:** `reqwest` (async, widely used)
- **JSON registry:** `include_str!` macro embeds at compile time
- **Serde:** all types derive `Serialize`/`Deserialize`
- **Error handling:** custom `OraError` enum implementing `std::error::Error`
- **Async runtime:** `tokio`

**Estimated effort:** ~500 lines of Rust + ~200 lines of tests.

---

## Phase 4 (Optional) — Type Codegen from JSON Schema

If the project grows beyond 4 languages, maintain types manually becomes painful.

### Approach

1. Create `packages/registry/openrouter-auto.schema.json` (JSON Schema for all types)
2. CI pipeline generates:
   - TypeScript interfaces → `packages/core/src/generated-types.ts`
   - Python dataclasses → `packages/python/openrouter_auto/generated_types.py`
   - Go structs → `packages/go/generated_types.go`
   - Rust structs → `packages/rust/src/generated_types.rs`
3. Hand-written code imports from generated files

**Tool options:** `quicktype`, `json-schema-to-typescript`, `datamodel-code-generator` (Python), custom script.

**Decision:** Defer until ≥4 languages. Manual parity is fine for 2-3 SDKs.

---

## What Each Language Wrapper Must Implement (~300-500 LOC)

Every new SDK only writes these runtime-specific parts:

| Component          | Lines | What it does                                      |
| ------------------ | ----- | ------------------------------------------------- |
| HTTP client        | ~80   | GET /models, POST /chat/completions, auth headers |
| Storage adapter    | ~60   | Memory (map) + File (read/write JSON)             |
| Validate (generic) | ~40   | Loop over parameters.json rules, check types      |
| Cost calc          | ~20   | `tokens × price / 1000`, tier lookup from JSON    |
| Error parse        | ~30   | Read status code, look up in errors.json          |
| SDK orchestration  | ~100  | Initialize, addModel, chat, filterModels          |
| Types / structs    | ~80   | Struct definitions (or generated)                 |
| **Total**          | ~410  |                                                   |

---

## Execution Timeline

| Phase   | Scope                              | Depends On | Status      |
| ------- | ---------------------------------- | ---------- | ----------- |
| Phase 1 | Registry extraction + TS/Py rewire | —          | ✅ Done     |
| Phase 2 | Go SDK                             | Phase 1    | ✅ Done     |
| Phase 3 | Rust SDK                           | Phase 1    | ✅ Done     |
| Phase 4 | Type codegen                       | Phase 1    | When needed |

---

## Risks & Mitigations

| Risk                                    | Mitigation                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| JSON loading adds startup latency       | Files are <5KB; negligible. Go/Rust embed at compile time.                                                              |
| Python package can't find registry path | Use `pathlib.Path(__file__).parent / "../../registry"` resolved at import time, or bundle JSON into the Python package. |
| Registry JSON drifts from SDK code      | CI test: load JSON in each SDK's test suite, assert keys match expected set.                                            |
| New OpenRouter params need JSON update  | Single update to one JSON file vs. N language files.                                                                    |
