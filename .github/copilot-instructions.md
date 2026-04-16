# OpenRouter Auto — Workspace Instructions

## Architecture

This is a **monorepo** with three packages that expose the same SDK surface across different runtimes:

```
packages/
├── core/      # TypeScript SDK — single source of truth for all logic
├── react/     # React wrapper — thin context + UI components over @openrouter-auto/core
└── python/    # Python SDK — mirrors core logic with idiomatic Python conventions
```

### Package responsibilities

| Package                    | Entry point                              | What it owns                                                                             |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@openrouter-auto/core`    | `packages/core/src/sdk.ts`               | Model fetching, parameter validation, cost calculation, storage adapters, error handling |
| `@openrouter-auto/react`   | `packages/react/src/context.tsx`         | `OpenRouterProvider`, `useOpenRouter` hook, four UI components                           |
| `openrouter_auto` (Python) | `packages/python/openrouter_auto/sdk.py` | Async-first mirror of core; adds CLI (`cli.py`)                                          |

### Core internal modules (TypeScript and Python mirror each other 1-to-1)

| Module     | TS file         | Python file     | Responsibility                                        |
| ---------- | --------------- | --------------- | ----------------------------------------------------- |
| SDK        | `sdk.ts`        | `sdk.py`        | `OpenRouterAuto` class, public API                    |
| Types      | `types.ts`      | `types.py`      | All shared interfaces / dataclasses                   |
| Errors     | `errors.ts`     | `errors.py`     | `OpenRouterAutoError`, error-code mapping             |
| Storage    | `storage.ts`    | `storage.py`    | `MemoryStorage`, `LocalStorageAdapter`, `FileStorage` |
| Parameters | `parameters.ts` | `parameters.py` | Validation, defaults, sanitization                    |
| Cost       | `cost.ts`       | `cost.py`       | Token estimation, cost breakdown                      |

### Storage adapters

Three pluggable adapters share the same async `get / set / remove / clear` interface:

- **Memory** — default, no persistence
- **localStorage** — browser only; key-prefixed with `ora_`
- **File** — Node.js / Python; writes `.openrouter-auto.json` to `configPath`

Always inject storage via `options.storage` for tests rather than relying on the environment.

### React component hierarchy

```
<OpenRouterProvider>          ← initialises SDK, owns all state
  <ModelSelector />           ← searchable dropdown (read-only)
  <ModelConfigPanel />        ← parameter form + inline test
  <CostEstimator />           ← live cost breakdown
  <ErrorDisplay />            ← maps error codes to tips
```

All components consume state exclusively through `useOpenRouter()`; never instantiate `OpenRouterAuto` directly inside a component.

### Data flow summary

```
OpenRouter API ──fetch──► SDK (cache) ──models──► Storage adapter
                                    ──configs──► Storage adapter
Application ──chat()──► SDK ──axios/httpx──► OpenRouter API
```

---

## Code Style

- **TypeScript**: camelCase variables/functions, PascalCase classes/interfaces, dot-case file names (e.g. `sdk.ts`, `cost.ts`)
- **Python**: snake_case variables/functions, PascalCase classes (e.g. `OpenRouterAuto`), snake_case file names
- Folder names: kebab-case in all packages

Follow the Coding Conventions in [default.instructions.md](vscode-userdata:/Users/maqsad/Library/Application%20Support/Code/User/globalStorage/github.copilot-chat/github/maqsad-io/instructions/default.instructions.md).

---

## Build & Test

### TypeScript / React (npm workspaces)

```bash
# Install all dependencies
npm install

# Build all packages (CJS + ESM + .d.ts via tsup)
npm run build

# Watch mode
npm run dev

# Lint all packages
npm run lint

# Run unit tests (jest)
npm run test

# Build / test a single package
cd packages/core && npm run build
```

### Python

```bash
cd packages/python

# Install in editable mode with dev extras
pip install -e ".[dev]"

# Run tests
pytest

# Type check
mypy openrouter_auto/

# Format
black openrouter_auto/

# CLI (after install)
openrouter-auto --help
```

---

## Conventions

- **Parity rule**: every feature added to `packages/core` must be replicated in `packages/python` and vice-versa. Keep module names and APIs aligned.
- **Storage isolation in tests**: always pass a `MemoryStorage` instance via `options.storage`; never rely on file system in unit tests.
- **Error codes are the API contract**: use named constants from `errors.ts` / `errors.py` instead of raw strings when creating or matching errors.
- **No direct axios/httpx usage outside `sdk.ts` / `sdk.py`**: all HTTP calls go through the SDK class's shared client instance.
- **React state lives in context only**: components are stateless — all mutations go through `useOpenRouter()` actions.

---

## Key reference files

- Full feature list and architecture diagram → [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md)
- Public API documentation → [README.md](../README.md)
- Quick-start guide → [QUICKSTART.md](../QUICKSTART.md)
- TypeScript usage example → [examples/react-basic.tsx](../examples/react-basic.tsx)
- Python usage example → [examples/python-basic.py](../examples/python-basic.py)
