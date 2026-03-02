# Boost Refactor Plan (AI SDK Resumable Streams + Modular UI)

## 0) Skills Used (and Why)
- `ai-sdk`: canonical APIs for `streamText`, `toUIMessageStreamResponse`, resumable streams, loop control, and middleware.
- `ai-elements`: component patterns for modular chat UI building blocks.
- `hono`: route and streaming structure for the current server runtime.
- `vercel-react-best-practices`: client architecture and performance-oriented React composition.

## 1) Scope and Outcomes
This plan replaces the current custom SSE/session stream flow with AI SDK UI-message streaming semantics, adds Redis-backed resumability, introduces explicit loop/steering control, and restructures the web UI into modular components while preserving robot-specific telemetry (snapshots, motion filmstrip, action log).

### Primary Outcomes
1. Server emits AI SDK UI-message stream protocol (`createUIMessageStreamResponse` / `toUIMessageStreamResponse`) instead of custom ad-hoc SSE shape.
2. Stream resumption works across refresh/reconnect via Redis + `resumable-stream`.
3. Session/chat persistence is first-class in DB: messages + active stream id + step metadata.
4. Agent loop is explicit and bounded using AI SDK loop controls (`stopWhen`, `prepareStep`, optional `ToolLoopAgent`).
5. UI uses composable ai-elements style architecture with clear modules and typed tool rendering.
6. Steering is supported in a safe way (initially non-interrupt steering; optional interrupt mode as separate behavior).

## 2) Current-State Snapshot (Repo-Aligned)
- Server currently runs Hono routes under `apps/server/src/routes`.
- Current session streaming route is `apps/server/src/routes/sessions.ts` and emits custom SSE events (`session_started`, `step`, `session_result`, etc.).
- Orchestration logic exists in `apps/server/src/services/orchestrator.ts` with `streamText`, `prepareStep`, tools, and image context.
- Active stream store is currently in-memory (`apps/server/src/lib/stream-store.ts`) and not resumable across process restarts.
- Web client consumes custom SSE via `apps/web/src/lib/api.ts` and renders bespoke dashboard in `apps/web/src/routes/session.$id.tsx`.

## 3) Non-Negotiable Technical Constraints
1. Use AI SDK stream protocol for chat-compatible UI and tool events.
2. Use persistent stream storage for resumability (Redis + `resumable-stream`).
3. Persist chat/session state in DB (not memory-only).
4. Keep robot control safety path independent from UI stream reliability.
5. Keep emergency stop always available and preemptive.

## 4) Product/Behavior Decisions

### 4.1 Stream Model
Adopt AI SDK UI message stream end-to-end:
- Backend response: `createUIMessageStreamResponse(...)` for custom `data-*` parts and merged stream support; `toUIMessageStreamResponse(...)` when simple forwarding is sufficient.
- Frontend transport: `useChat` + `DefaultChatTransport`
- Stream header contract: AI SDK UI stream protocol (`x-vercel-ai-ui-message-stream: v1` handled by helper)

### 4.2 Resumability
Implement two endpoints per chat/session:
- `POST /api/chat` (or `/v1/chat`) creates stream and stores `activeStreamId`
- `GET /api/chat/:id/stream` resumes stream or returns HTTP 204

### 4.3 Abort vs Resume Tradeoff
AI SDK docs are explicit: `resume: true` conflicts with abort semantics.
Plan:
- Mode A (default for long running): `resume: true`, disable client abort/stop-stream operation.
- Mode B (manual steering interrupt mode): `resume: false`, allow interrupt/abort.
- Emergency stop robot endpoint remains independent and always active.
- For UI-message responses, include `consumeSseStream: consumeStream` when abort handling and `onFinish(isAborted)` cleanup are required.

### 4.4 Steering Strategy
- V1 steering (first implementation): non-interrupt steering via user follow-up message appended into chat/session context.
- V2 steering (optional): interrupt steering in Mode B by ending active generation and starting a new one with operator instruction.
- Do not mix interrupt steering with resumable mode in same request lifecycle.

## 5) Target Architecture

```text
apps/web (TanStack + AI SDK UI)
  -> useChat(id, resume, transport)
  -> POST /v1/chat (create stream)
  -> GET /v1/chat/:id/stream (resume stream)

apps/server (Hono + AI SDK Core/UI)
  -> streamText / ToolLoopAgent (loop control)
  -> toUIMessageStreamResponse
  -> consumeSseStream -> resumable-stream (Redis)
  -> DB persistence (messages, active_stream_id, step summaries)
  -> robot tools -> apps/hub

Redis
  -> transient stream event storage for resumable-stream

Postgres (packages/db)
  -> sessions/chats, ui_messages, active_stream_id, steps/tool execution

apps/hub (FastAPI)
  -> robot execution + safety watchdog + estop
```

## 6) Data Model Changes (DB)

## 6.1 New / Updated Tables
1. `sessions` (existing or extend)
- `id` (pk)
- `goal` (text)
- `status` (`running|completed|stopped|failed`)
- `active_stream_id` (nullable text)
- `resume_enabled` (boolean, default true)
- `created_at`, `updated_at`

2. `session_messages`
- `id` (pk, server-generated)
- `session_id` (fk)
- `role` (`user|assistant|system|tool`)
- `parts_json` (JSONB UIMessage parts)
- `created_at`

3. `session_steps`
- `id` (pk)
- `session_id` (fk)
- `step_index` (int)
- `action_text` (nullable text)
- `reasoning_text` (nullable text)
- `snapshot_url_or_data` (nullable text)
- `movement_snapshots_json` (JSONB)
- `tool_calls_json` (JSONB)
- `created_at`

4. `session_events` (optional audit)
- `id`, `session_id`, `event_type`, `payload_json`, `created_at`

## 6.2 Indexes
- `sessions(status, updated_at desc)`
- `session_messages(session_id, created_at)`
- `session_steps(session_id, step_index)` unique

## 7) Server Refactor Plan (Hono)

## 7.1 New Route Structure
- `apps/server/src/routes/chat.ts` (new)
  - `POST /v1/chat`
  - `GET /v1/chat/:id/stream`
  - `POST /v1/chat/:id/stop` (robot estop + status update)
- Keep `sessions.ts` temporarily as compatibility shim.

## 7.2 POST /v1/chat Flow
1. Validate payload: `{ id, message, mode?, metadata? }`.
2. Load session + persisted messages.
3. Append new user message and clear stale `active_stream_id`.
4. Start model generation using `streamText` (or agent stream).
5. Return `createUIMessageStreamResponse` (or `toUIMessageStreamResponse`) with:
- `originalMessages`
- `generateMessageId`
- `onFinish` persisting final messages and clearing `active_stream_id`
- `consumeSseStream` creating resumable stream and saving `active_stream_id`

## 7.3 GET /v1/chat/:id/stream Flow
1. Load session by id.
2. If no `active_stream_id`, return `204 No Content`.
3. Resume via `resumeExistingStream(active_stream_id)`.
4. Return with `UI_MESSAGE_STREAM_HEADERS`.

## 7.4 Stream Context and Infra
- Replace `lib/stream-store.ts` in-memory map with Redis-backed resumable context adapter.
- Add `apps/server/src/lib/stream-context.ts` wrapping `createResumableStreamContext`.
- Add robust cleanup for stale stream IDs and expired Redis keys.

## 7.5 Orchestrator Integration
Keep robot decision engine but emit AI SDK-native message parts:
- Continue multi-step control via:
  - `stopWhen: [stepCountIs(...), hasToolCall('complete'), hasToolCall('stop')]`
  - `prepareStep` for dynamic image/depth context and movement history
- Record per-step data into `session_steps` from callbacks.
- Emit robot telemetry as `data-*` stream parts (e.g. `data-robot-step`, `data-snapshot`, `data-filmstrip`) via stream writer merge, not custom SSE events.

## 7.6 Loop Control Hardening
- Enforce max step count and timeout budgets.
- Restrict tool availability per phase (`activeTools` in `prepareStep` when needed).
- Add deterministic fallback to `stop` on invalid tool outputs.
- Keep room for two loop modes:
  - auto tool execution (`execute` on tool definitions)
  - fully manual tool execution (tools without `execute`, server handles `finishReason === 'tool-calls'` loop)

## 8) Language Model Middleware Plan
Use `wrapLanguageModel` in `apps/server/src/lib/providers.ts` (or new `lib/model.ts`).

## 8.1 Middleware Stack (Order Matters)
1. `defaultSettingsMiddleware`
- default temperature, maxOutputTokens, provider options.

2. `extractReasoningMiddleware` (conditional per model)
- parse reasoning tags when model exposes them.

3. Custom logging middleware (`wrapStream` + `wrapGenerate`)
- structured telemetry for params, token usage, finish reason, step timings.

4. Optional cache middleware (phase 2)
- cache generate calls only where deterministic and safe.

5. Optional `addToolInputExamplesMiddleware`
- only if provider has weak tool-call grounding.

## 8.2 Metadata Strategy
Pass per-request metadata through `providerOptions`:
- `sessionId`, `operatorId`, `traceId`, `mode`, `stepIndex`

## 8.3 Guardrails in Middleware
Implement stream-safe guardrails carefully:
- input-side transform rules in `transformParams`
- output guardrails for complete responses
- avoid brittle token-level redaction for partial chunks unless fully tested

## 9) Web UI Refactor Plan (TanStack + Modular Components)

## 9.1 Core Hook Migration
Move from custom SSE parser to `useChat`:
- `id` = session id
- `messages` initial state from server
- `resume` toggled by mode
- `transport: new DefaultChatTransport({...})`
  - custom `prepareSendMessagesRequest`
  - custom `prepareReconnectToStreamRequest`

## 9.2 Component Architecture (new modules)
Under `apps/web/src/components/session/`:
1. `session-shell.tsx`
2. `session-topbar.tsx`
3. `session-conversation.tsx`
4. `session-reasoning-panel.tsx`
5. `session-snapshot-panel.tsx`
6. `session-filmstrip-grid.tsx`
7. `session-action-log.tsx`
8. `session-operator-input.tsx`
9. `session-status-card.tsx`

## 9.3 ai-elements Usage Pattern
Adopt ai-elements composition where it fits:
- `Conversation`, `ConversationContent`, `ConversationScrollButton`
- `Message`, `MessageContent`, `MessageResponse`, `MessageActions`
- keep robot-specific panels outside generic chat components

## 9.4 Typed Tool Rendering
Render tool states from message parts:
- `tool-forward`, `tool-backward`, `tool-turn`, `tool-stop`, `tool-complete`
- states: `input-available`, `output-available`, `output-error`

## 9.5 Visual Layout
Keep dashboard style but componentized:
- left: live snapshot + action overlay + reasoning
- right: system status + filmstrip grid
- bottom: movement/action timeline + operator input

## 9.6 Performance/UX Rules
- avoid expensive rerenders by isolating panels and memoizing derived state.
- avoid polling when stream provides data.
- load fallback snapshot only when no step/snapshot message part is available.

## 10) API Contracts

## 10.1 POST /v1/chat
Request:
```json
{
  "id": "session-id",
  "message": { "id": "...", "role": "user", "parts": [{ "type": "text", "text": "..." }] },
  "mode": "resumable"
}
```

Response:
- AI SDK UI message stream (SSE/data stream protocol)
- May include custom `data-*` parts for robot telemetry and UI state.

## 10.2 GET /v1/chat/:id/stream
- `204` when no active stream
- `200` + UI message stream when active

## 10.3 POST /v1/chat/:id/stop
- sends emergency stop to hub
- sets session status `stopped`
- does not require current stream success

## 11) Migration Strategy (Low Risk)

## Phase 1: Server Streaming Foundation
1. Add DB fields/tables for message + stream tracking.
2. Add Redis + resumable stream context integration.
3. Implement new `/v1/chat` POST + `/v1/chat/:id/stream` GET.
4. Keep existing `/v1/sessions/stream` for temporary backward compatibility.

## Phase 2: Web Hook Migration
1. Introduce new chat API client using `useChat`.
2. Switch session page to use new transport behind feature flag.
3. Preserve current dashboard visuals with new data source.

## Phase 3: Component Modularization
1. Split `session.$id.tsx` into component modules.
2. Add typed tool-result renderers.
3. Add steering mode toggle (`resumable` vs `interruptible`).

## Phase 4: Middleware and Loop Hardening
1. Add `wrapLanguageModel` middleware stack.
2. Add loop budgets, tool gating, and detailed telemetry.
3. Add regression tests for stop/resume/race conditions.

## Phase 5: Decommission Legacy Path
1. Remove old custom SSE parser path.
2. Remove in-memory stream store.
3. Remove compatibility endpoints once stable.

## 12) Detailed File Change Map

### Server
- `apps/server/src/routes/chat.ts` (new)
- `apps/server/src/routes/sessions.ts` (compat shim, then cleanup)
- `apps/server/src/services/orchestrator.ts` (adapt callbacks + persistence integration)
- `apps/server/src/lib/providers.ts` (middleware wrapping)
- `apps/server/src/lib/stream-context.ts` (new)
- `apps/server/src/lib/stream-store.ts` (remove or turn into adapter)
- `apps/server/src/index.ts` (route registration)

### Web
- `apps/web/src/routes/session.$id.tsx` (orchestrates new modular components)
- `apps/web/src/lib/api.ts` (replace custom SSE code path with chat transport helpers)
- `apps/web/src/components/session/*` (new module set)

### DB
- `packages/db/src/schema.ts` and/or `packages/db/src/schema/*` (new tables/columns)
- `packages/db/src/queries/sessions.ts` (expand to messages + stream id operations)
- add migrations accordingly

## 13) Testing Plan

## 13.1 Unit Tests
- stream-id lifecycle functions (set/clear/resume behaviors)
- middleware transform and logging behavior
- loop control conditions and fallback stop behavior

## 13.2 Integration Tests
- POST starts stream and stores active stream id
- GET resumes stream and returns AI SDK headers
- onFinish clears active stream id
- missing stream returns 204
- emergency stop works while stream active

## 13.3 End-to-End Scenarios
1. Start session, refresh page, resume stream successfully.
2. Session completes, refresh page, no stream to resume (204).
3. Redis key expiration path gracefully recovers.
4. Operator steering message appears in next steps.
5. Emergency stop interrupts robot regardless of stream status.

## 14) Observability
- Structured logs for: session id, stream id, step number, tool name, latency, token usage, finish reason.
- Metrics counters:
  - active streams
  - resume attempts / success / fail
  - tool call success / fail
  - emergency stop count
- Trace correlation via `traceId` threaded through client, server, middleware.

## 15) Risks and Mitigations
1. Abort/resume incompatibility confusion
- mitigate with explicit mode toggle and UI labels

2. Race conditions around `active_stream_id`
- clear before new stream, clear on finish, guard against stale IDs

3. Redis stream expiry before reconnect
- handle as normal completion/expired state; return 204 and surface status

4. UI regressions from hook migration
- feature flag and parallel old/new route testing

5. Orchestrator complexity growth
- isolate step extraction/persistence helpers and cap complexity per file

## 16) Acceptance Criteria
1. Chat/session stream uses AI SDK UI protocol end-to-end.
2. Refresh mid-run resumes ongoing stream when in resumable mode.
3. Session and message history persist in DB and rehydrate on reload.
4. Robot step telemetry (action, snapshots, filmstrip) is visible in modular UI.
5. Emergency stop remains reliable and independent from stream state.
6. Legacy custom SSE route can be removed without feature regression.

## 17) Immediate Next Slice (Execution Order)
1. Implement DB schema changes for `active_stream_id` + `session_messages`.
2. Add Redis resumable-stream adapter and new `chat` routes.
3. Wire `toUIMessageStreamResponse({ consumeSseStream, onFinish })` in POST.
4. Implement resume GET endpoint with `UI_MESSAGE_STREAM_HEADERS` + 204 behavior.
5. Switch web session route to `useChat` with custom transport and resumable mode.
6. Split UI into modular components and map typed tool parts to snapshot/filmstrip panels.
7. Add middleware wrapper + telemetry.
8. Add integration tests for resume lifecycle and emergency stop.

## 17.1 Current Progress Log (Implemented)
1. Implemented a manual session loop in `apps/server/src/services/orchestrator.ts` via `runSession(...)`:
- explicit `for` loop over steps
- one-model-step-per-iteration (`stopWhen: [stepCountIs(1)]`)
- per-step parsing of tool calls/results and step event emission
- persisted message history each iteration

2. Implemented interrupt path for emergency stop:
- added in-process run cancellation in orchestrator service (now superseded by `abortSession` + `AbortController`)
- wired `POST /v1/sessions/:id/stop` to interrupt active AI run before hub emergency stop (implementation now uses `abortSession(...)`)
- active run aborts immediately instead of only writing DB status

3. Preserved `apps/server/src/lib/agents/orchestrator.ts` unchanged and added compatibility export:
- `createToolSet(sessionId)` now exported from `apps/server/src/lib/tools/index.ts` to keep legacy agent compile path valid.

4. Validation:
- `apps/server` typecheck passes (`bun run typecheck` in `apps/server`)
- ultracite checks/fixes applied to touched server files

## 18) Reference Material Used
- AI SDK docs (local):
  - `docs/04-ai-sdk-ui/03-chatbot-resume-streams.mdx`
  - `docs/04-ai-sdk-ui/50-stream-protocol.mdx`
  - `docs/03-agents/04-loop-control.mdx`
  - `docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`
- Skills:
  - `/.agents/skills/ai-sdk/SKILL.md`
  - `/.agents/skills/ai-elements/SKILL.md`
  - `/.agents/skills/hono/SKILL.md`
  - `/.agents/skills/vercel-react-best-practices/SKILL.md`
- External repos to align with during implementation:
  - `https://github.com/vercel-labs/ai-sdk-persistence-db`
  - `https://github.com/vercel/ai/tree/main/examples/next/app/chat/%5BchatId%5D`
  - `https://github.com/vercel/ai-chatbot`

## 18.1 Cleanup / Scrap Matrix (What to Remove vs Keep)
### Remove (when new chat stream path is live)
1. `apps/server/src/lib/stream-store.ts`
- reason: in-memory only; replaced by Redis-backed resumable streams.

2. Custom SSE contract in `apps/server/src/routes/sessions.ts` (`session_started`, `step`, `session_result`, ...)
- reason: superseded by AI SDK UI message stream protocol.

3. Custom SSE parser logic in `apps/web/src/lib/api.ts` and session page stream parser glue
- reason: superseded by `useChat` + `DefaultChatTransport`.

### Keep (for now)
1. `apps/server/src/lib/agents/orchestrator.ts`
- kept intentionally (user request); compile-compatible via `createToolSet`.

2. `apps/server/src/routes/sessions.ts`
- keep as compatibility shim while `v1/chat` endpoints are introduced.

3. Robot tool layer in `apps/server/src/lib/tools/*`
- keep and reuse for both manual loop and future UI-stream route.

### Refactor Next
1. Split `apps/server/src/services/orchestrator.ts` into:
- `loop-runner.ts` (manual loop engine)
- `step-parser.ts` (tool/result extraction)
- `step-context.ts` (image prompt assembly)

2. Move session-stop state (`AbortController` map) into dedicated runtime module:
- easier testing
- avoids monolithic orchestrator file growth

## 18.2 Emergency Stop Design (Authoritative)
1. Emergency stop must do three things, in order:
- abort the active AI generation (`abortSession` via `AbortController`)
- send physical stop to hub (`hub.emergencyStop`)
- persist session status to `stopped`

2. Current status:
- implemented in `POST /v1/sessions/:id/stop` and manual loop interrupt path.

3. Remaining hardening:
- make stop idempotent and return distinct statuses (`already_stopped`, `stop_requested`)
- add telemetry event for every stop request and completion
- ensure new resumable chat endpoints share same stop controller path

## 18.3 Manual Loop Guidance (From AI SDK Docs)
1. Full manual loop pattern:
- call `streamText` in a while-loop
- append `result.response.messages` to history
- inspect `finishReason`
- when `finishReason === 'tool-calls'`, execute tools manually and append `tool-result` messages
- terminate when finish reason is no longer `tool-calls` or custom budget/iteration cap is reached

2. Why this matters for this project:
- enables deterministic robot safety hooks between model steps
- allows explicit DB checkpoints on every tool call/result
- supports custom retry and fallback behavior per tool error

3. Current implementation status:
- implemented partial manual control (explicit per-step loop + single-step generation + DB persistence + emergency-stop interrupt)
- next step to become fully manual: remove `execute` from tool definitions in loop mode and dispatch tool calls in orchestrator reducer.

## 20) Latest Cleanup Applied (March 2, 2026)
1. Removed depth-map wiring from the active path:
- deleted `apps/server/src/services/depth.ts` (unused)
- removed depth references from robot context/examples prompts

2. Replaced custom stop-request plumbing:
- removed `requestSessionStop` route usage
- added `abortSession(sessionId)` in `services/orchestrator.ts`
- `runSession` now passes `abortSignal` to `streamText`, and handles aborts as graceful `stopped`

3. Simplified step event contract to avoid invalid UI types:
- server step event emits only AI SDK tool-call fields (`toolName`, `toolCallId`, `input`)
- web API/types updated to match server payload
- session UI now renders per-tool detail components from `input` only (no `action`/`movementSnapshots` coupling)

4. Reduced tool execution payloads:
- removed `movementSnapshots` collection from `forward` / `backward` / `turn`
- removed synthetic `action` fields from tool outputs (`forward` / `backward` / `turn` / `stop`)

## 19) Concrete Reference Mapping (Cloned Locally)
All of these repos are cloned under `/home/node/boost/.refs`.

### 19.1 `ai-chatbot` patterns to mirror
1. `app/(chat)/api/chat/route.ts`
- Uses `createUIMessageStream` + `createUIMessageStreamResponse`.
- Uses `consumeSseStream` with `createResumableStreamContext` and Redis.
- Persists message parts on `onFinish`.
- Merges custom `data-*` parts into the stream (we should do this for robot step telemetry).

2. `components/chat.tsx`
- Uses `useChat` + `DefaultChatTransport`.
- Custom `prepareSendMessagesRequest` sends either last user message or full message sequence depending on tool approval flow.
- Integrates `resumeStream`.

3. `hooks/use-auto-resume.ts`
- Auto-resume logic: if latest initial message is user, call `resumeStream()` on mount.

4. `lib/db/schema.ts` + `lib/db/queries.ts`
- Dedicated `Stream` table and helpers (`createStreamId`, `getStreamIdsByChatId`).
- Message parts persisted as structured JSON (`parts`).

### 19.2 `ai-sdk-persistence-db` patterns to mirror
1. `app/chat/[id]/chat.tsx`
- Minimal `useChat` persistence transport shape.
- Sends only latest message and chat id; server rehydrates full context.
- Useful as the lean baseline before adding advanced tool/telemetry behavior.

### 19.3 `ai` repo examples/docs to mirror
1. `examples/next/app/api/chat/route.ts` and `examples/next/app/api/chat/[id]/stream/route.ts`
- Canonical resumable stream POST/GET flow.

2. `content/docs/04-ai-sdk-ui/03-chatbot-resume-streams.mdx`
- Canonical resumability architecture and lifecycle.

3. `content/docs/03-ai-sdk-core/40-middleware.mdx`
- Canonical middleware composition and `wrapLanguageModel` usage.
