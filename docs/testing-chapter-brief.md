# Testing Chapter Brief — Automated Test Suite (addendum to the Final Report Handbook)

**Purpose:** self-contained summary of the automated test suite added on 2026-08-27, written for the chat drafting the final report. It extends `docs/final-report-handbook.md` (§9 has a one-paragraph version; this is the full picture). The machine-generated per-test results live in `docs/test-report.md` — regenerate with `npm run test:report`.

---

## 1. Headline numbers

| Artefact | Result |
|---|---|
| **Vitest suite** | **134 tests, 14 files, all passing** (~6s wall clock) |
| Unit tests | 10 files — pure planning logic, no database |
| Integration tests | 4 files — real PostgreSQL test database, reseeded every run |
| Coverage (scoped to `src/services` + `src/lib`) | **75.5% lines / 73.0% statements** overall; **100%** on `redact.ts`, `roles.ts` and the analytical services |
| Type safety | `npx tsc --noEmit` clean (strict TypeScript across app + tests) |
| Complementary suite | `scripts/authz-check.sh` — 48 HTTP-level authorisation checks, 48 passing (pre-existing; NOT part of Vitest — presented as the security layer of the strategy) |
| Version control | Repo history now exists: `12825b7` "Pre-test-suite baseline" → `fdd2fc1` "Add Vitest unit and integration suite" |

Commands: `npm test` · `npm run test:coverage` · `npm run test:report` (writes `docs/test-report.md`: dated pass/fail table per test with full sentence names, plus a coverage table — designed to be pasted into the Testing chapter or an appendix).

## 2. The testing strategy (use this as the chapter's framing)

Four layers, each catching what the previous cannot:

1. **Static types** — strict TypeScript over the whole codebase; `tsc --noEmit` is a standing gate.
2. **Unit tests** (Vitest, no DB) — the analytical core as pure functions: every formula in the dissertation is executable and asserted, including its boundary values. Where a function needs data (accuracy sampling, velocity/ad-hoc history), the Prisma client is mocked so the *logic* runs unmodified on crafted samples.
3. **Integration tests** (Vitest + PostgreSQL) — the same engines run against a real seeded database, pinning the end-to-end numbers the report quotes and the persistence rules (what writes, what must never write).
4. **HTTP authorisation suite** (`npm run check:authz`, curl-based, 48 checks) — the role boundary exercised over the wire with real JWTs for all three roles, including ownership/scope attack cases and negative content scans (client responses grepped for developer names). This layer was built with the RBAC feature and predates the Vitest suite.

Manual browser verification per role (screenshot walkthroughs) sits on top. This layering is a defensible answer to "how did you test it?" — each layer has a reason to exist and a class of defect only it catches.

## 3. Test isolation design (worth a paragraph in the chapter)

- Tests run against a **dedicated database `sprint_planner_test`**, never the demo DB. A Vitest setup file overwrites `DATABASE_URL` *before any module import*, so the Prisma client physically cannot connect to development data during tests.
- A **global setup** provisions the test DB idempotently (CREATE DATABASE, `prisma migrate deploy`, full reseed from `prisma/seed.ts`) before every run — so every run starts from the identical engineered dataset, and the suite is one command from cold.
- The seed pivots sprint dates around "today"; the assertions are written date-relative, so the suite is **deterministic regardless of the day it runs** (proven: identical results on consecutive days).
- Tests that mutate create **scratch fixtures placed 100 days in the future** (so they can never overlap the seeded in-flight sprints and disturb multi-project factors) and delete them after. Test files run sequentially to keep the shared seeded state race-free.
- Time-dependent logic (burndown) is tested under **fake timers** frozen at day 7 of a 14-day sprint.

## 4. What the unit tests prove (10 files)

Named as readable sentences, e.g. `it("floors the allocation factor at 0.25 when a developer is on five or more concurrent sprints")`. Tests that encode a design decision carry a one-line comment citing the handbook section.

| File | Proves |
|---|---|
| `multi-project-capacity.test.ts` | Allocation `1/(N+1)` at N=0..3 with the 0.25 floor; context-switch `1 − 0.20×max(0,N−1)` with the 0.5 floor; **two concurrent sprints incur no switch penalty** (the literature-derived baseline) |
| `capacity-chain.test.ts` | The handbook worked example composed from the engine's own exported steps: 40h − 12h meetings × 2wk = 56h → ×0.8 buffer ×0.5 multi-project = **22.4h → 402% overloaded**; buffer edges 0/0.4; zero-capacity division guard (100%, not NaN); exact-boundary overload (22.4 vs 22.5); simulator arithmetic incl. `wouldCauseOverload` only when the addition *causes* it |
| `sprint-health.test.ts` | 100 baseline; −30/overloaded, −10/at-risk (≥80%), −5 when avg >85%; **band boundaries pinned at exactly 40 and 70**; floor at 0; the recommendation string interpolates developer names (documenting *why* clients never receive it) |
| `burndown.test.ts` | Classification at the exact +10 / −5 / −20 deltas (each boundary tested on both sides); zero-work sprint; day clamping past sprint end |
| `estimation-accuracy.test.ts` | Shrinkage `k = max(0,10−n)`: n=1 with a 50% overshoot lands at **1.05** (not 1.5); n=10 equals the raw ratio; neutral 1.0 with no samples; confidence bands at n=4/5/14/15; trend requires n≥8 and the ±0.05 movement rule (improving/degrading/stable each); the 90-day window and **strict `completedAt < asOf`** bound asserted at the query boundary (the no-leakage guarantee); `applyAccuracyToCapacity` divides (22.4/1.28 → 17.5) and never breaks the engine on factor ≤ 0 |
| `sprint-forecast-signals.test.ts` | Squish `100×(1−e^(−raw/40))`: **0 → 0%** (the reason a logistic was rejected), 53 → 73% (the live Sprint 1 figure), saturation ≤100; bands pinned at 25/50/75; each of the five signals at its cap (40/20/15/15/10) and at zero; utilisation scores the **peak** developer, not the average; accuracy signal weighted by assigned hours and asymmetric (under-estimators cap 10, over-estimators cap 4); days-remaining ignores done tasks and scores 0 outside the sprint window; velocity/ad-hoc history filtered to `endDate < asOf` |
| `roles.test.ts` | `admin`/`user`/`lead` → manager (legacy-token continuity), `dev` → developer; case/trim handling; **unknown/empty/null fail closed to client**; landing paths per role |
| `redact.test.ts` | **Key-set assertions**: client task/sprint/project shapes contain *exactly* the `CLIENT_*_KEYS` sets — this test fails the moment anyone adds a schema field without deciding whether clients may see it; a maximal Prisma-shaped fixture (nested assignee, actualHours, retrospectiveNotes) proves the whitelist drops every sensitive field, recursively through project → sprint → task; serialised output contains no developer name, no utilisation figure, no retro text; delivery confidence carries `{band, label}` and nothing else; the developer field allow-list rejects `assignedDeveloperId` (task-stealing) and estimate tampering |
| `task-statuses.test.ts` | Exactly 8 statuses in Kanban order; **only `done` is terminal** — a paused task still consumes capacity |
| `rebalancing.test.ts` | Moves the lowest-priority task first; never a done task; at most one suggestion per overloaded developer; recipients must genuinely absorb the hours within effective capacity; projected utilisations reconcile with the chain arithmetic |

## 5. What the integration tests prove (4 files, real DB)

| File | Proves |
|---|---|
| `forecast-evaluation.int.test.ts` | The dissertation's calibration story is pinned: the four historic sprints evaluate to exactly **low/met, moderate/met, high/partial, high/missed** with **2 hits, 0 false alarms, 0 missed alarms** (100% alarm precision), chronologically ordered, each with a named top contributor |
| `capacity-records.int.test.ts` | The worked example end-to-end from the seeded DB (Angelo: 56h capacity, 22.4h effective, 90h assigned, 402%, ×0.5 factor, overlapping sprint named); paused tasks counted, done tasks excluded (a fully completed sprint shows zero active load); `computeSprintCapacity` upserts **exactly one CapacityRecord per (developer, sprint)** and is idempotent across recomputes; **retroactive forecasts write zero CapacityRecords** and see zero completed hours at `asOf = startDate` while the live view of the same sprint sees them (the leakage-prevention proof); client burndown path does not touch the DB; meeting hours exceeding weekly hours clamp capacity to 0 (scratch fixture) |
| `simulator-rebalancing.int.test.ts` | Ad-hoc simulator reconciles with the chain and **creates no task row**; rebalancing on the genuinely overloaded seeded sprint emits ≤1 suggestion per overloaded developer, every projection reconciling with the chain, every recipient with real headroom |
| `register-role.int.test.ts` | The register endpoint creates `role: "developer"` **even when the body claims `role: "manager"`** (privilege-escalation attempt), leaves the account unlinked (fail-closed), 409 on duplicate email, 400 on missing fields |

## 6. Two disclosed enabling refactors (behaviour-preserving)

State these in the report rather than hiding them — they're defensible:

1. The five forecast signal functions (+ squish + band) in `sprint-forecast.service.ts` were module-private; they gained `export` keywords so each signal is testable in isolation. No logic changed.
2. The rebalancing algorithm `computeSuggestions` was extracted from the React component into `src/services/rebalancing.service.ts` (the component now imports it). Same code, now testable without rendering — and it corrects an architecture smell (an algorithm living in a UI file).

No production behaviour changed; the full suite plus `tsc` plus the 48-check authz suite all pass on the refactored code. **No genuine bugs were found** — every documented formula and boundary held against the implementation, which is itself a reportable result (the handbook's documented behaviour and the code agree).

## 7. Honest limitations (for the Testing chapter's critical reflection)

- **React components and page routes have no unit coverage** — they are exercised by the HTTP authz suite and manual browser walkthroughs. Coverage is deliberately scoped to the analytical core; say so rather than quoting a misleading whole-repo number.
- **`src/lib/authorize.ts` shows 0% unit coverage** — deliberate: it is covered end-to-end by the 48 HTTP checks, which test it more honestly (real JWTs, real 401/403s) than a mocked unit test would.
- **No end-to-end browser automation** (Playwright etc.) — considered and rejected for scope; the role walkthroughs are manual.
- The evaluation assertions pin the *seeded* calibration story — mechanism validation, not statistical validation (ties into handbook §10.6's seed-circularity defence).

## 8. Quotable specimen test names

> "floors the allocation factor at 0.25 when a developer is on five or more concurrent sprints"
> "lands near 1.0 for a single task overshot by 50% (n=1, k=9)"
> "maps zero raw points to exactly 0% probability"
> "fails closed: unknown, empty, null and undefined all collapse to client"
> "produces exactly the CLIENT_TASK_KEYS set for a client task"
> "treats tasks completed after asOf as still pending — nothing is 'done' at sprint start"
> "creates a developer even when the request body claims to be a manager"
> "reproduces the handbook worked example end to end: Angelo at 22.4h effective and 402% in Sprint 1"
