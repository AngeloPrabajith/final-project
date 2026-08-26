# Final Report Handbook — Capacity-Aware Sprint Planning System

**Purpose of this document:** complete, self-contained reference for writing the CS6P05NM final report. It records everything built, why it was built that way, the exact state of the demo data, and what every screenshot shows. All numbers marked *(verified live)* were read from the running system on 2026-08 against the current seed.

---

## 1. Project identity

| | |
|---|---|
| Module | CS6P05NM Final Year Project, London Metropolitan University |
| Student | Vithanage Angelo Prabajith Perera, 25024547 |
| Supervisor | Prof. Ruvan Abeysekara |
| Title | **Capacity-Aware Sprint Planning System with Predictive Overload Detection** |
| Working name | "Cadence" (appears in the app sidebar with the tagline "Capacity intelligence") |
| Stack | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma 7 (driver adapters, client generated into `src/generated/prisma`) · PostgreSQL 16 (Docker) · TanStack Query · Tailwind v4 + shadcn/Base UI · Recharts · dnd-kit · JWT (jsonwebtoken + bcryptjs) |

### Title evolution (important narrative for the report)

- **Proposal (Dec 2025):** "Sprint & Capacity Management Software" — a broader workload/task tracker.
- **Interim report (Jan 2026):** scope refined **on supervisor recommendation** to add "predictive and analytical elements that enhance its academic and technical depth." The contribution is explicitly *not* "another Jira" but **explicit capacity modelling + predictive overload detection**.
- **Supervision (Aug 2026):** supervisor requested **separate logins and screens per user type** (developer / project manager / client) — delivered as the role-based access build.

### The research gap (quote from interim report)

> "There remains a gap between theoretical capacity-aware planning models and their practical implementation within everyday development workflows."

Existing tools (Jira, ClickUp, Azure DevOps) track task status and workflow. They assume stable availability, do not model competing projects, context switching, or unplanned work, and surface capacity risk *after* a sprint has started. This system closes that gap in a working implementation.

### The four thesis pillars (every feature defends one)

1. **Explicit capacity modelling** — buffer, meeting load, cross-sprint allocation, context-switch penalty.
2. **Predictive overload detection** — a forward-looking probability, not just real-time flags.
3. **Ad-hoc / unplanned work handling** — simulator, ad-hoc history signal in the forecast.
4. **Decision support over raw tracking** — health score, rebalancing suggestions, role-appropriate disclosure.

---

## 2. System overview

Single Next.js application: API route handlers under `/api/*` (all server-enforced JWT + role authorisation), client pages under an `(authenticated)` route group. PostgreSQL via Prisma. One command runs everything:

```bash
npm run demo   # Docker Postgres → prisma migrate deploy → seed → dev server on :3000
```

Other commands: `npm run db:seed` (re-pivot demo data around today), `npm run check:authz` (48-check authorisation suite — reseed after, it mutates one task).

### Data model (Prisma schema, 8 models)

- **User** — login identity: `id, name, email (unique), password (bcrypt), role (string, default "developer")`.
- **Developer** — capacity entity: `name, weeklyCapacityHours, meetingHoursPerWeek (default 0), githubUsername?, userId? (unique, FK → User, SetNull)`. The nullable unique `userId` is the join between login identity and capacity entity — these were unrelated tables until the RBAC build.
- **ProjectClient** — join table scoping client users to projects: `(userId, projectId)` unique, cascade both ways.
- **Project** — `name, description`.
- **Sprint** — `name, startDate, endDate, projectId, capacityBuffer (default 0.2), retrospectiveNotes?`.
- **Task** — `title, description?, estimatedHours, actualHours?, completedAt?, type ("planned"|"adhoc"), status (8 states), priority (low/medium/high/critical), assignedDeveloperId?, sprintId`.
- **CapacityRecord** — per (developer, sprint) snapshot: `assignedHours, capacityHours, overloadRisk` (unique pair; upserted by the capacity engine on each computation).
- **DeveloperActivity** — per-day commit/PR/review counts, `source ("seed"|"github"|"mock")`, `(source, externalRef)` unique for webhook dedup. Seeded with 383 rows of mock data; Phase 2 swaps in a live GitHub client with **no downstream change**.

Task workflow: 8 statuses in one source of truth (`src/lib/task-statuses.ts`): Backlog → To Do → In Progress → Paused → QA → UAT → Ready for Prod → **Released to Prod** (`done`). Only `done` is terminal for capacity/accuracy; a Paused task still consumes capacity (deliberate — it's still assigned).

---

## 3. The capacity engine (pillar 1)

### The multiplier chain

```
netWeeklyHours   = max(0, weeklyCapacityHours − meetingHoursPerWeek)
capacityHours    = netWeeklyHours × sprintWeeks
effective        = capacityHours × (1 − capacityBuffer) × allocationFactor × contextSwitchFactor
utilisation      = assignedHours (non-done tasks only) / effective × 100
overload         = assignedHours > effective
```

- **Buffer** (0–40%, default 20%, per sprint, slider in sprint form) — planning slack; mirrors real teams planning to ~80%.
- **Meeting load** — `Developer.meetingHoursPerWeek` subtracted *before* the buffer so meetings aren't double-discounted. Phase 2: replace static field with Google Calendar OAuth.
- **Allocation factor** — a developer assigned to N *other* concurrent sprints (overlapping date windows, ≥1 assigned task) gets `1/(N+1)` per sprint, floored at 0.25. Equal split, chosen over hours-weighted split because the weighted version is circular (assigned hours depend on capacity, which would depend on allocation).
- **Context-switch factor** — `1 − 0.20 × max(0, N − 1)`, floored at 0.5. Two concurrent sprints incur no penalty; a third costs 20%, etc. The 20% figure is a literature-supported heuristic (Cohn 2005; Sutherland; Weinberg) — acknowledged in write-up as a rule-of-thumb, not a meta-analysis result.
- **Why these don't double-count:** buffer = global slack; meetings = time literally consumed; multi-project = capacity diluted by competing commitments; accuracy factor (below) = estimation bias. A single-sprint, no-meeting, accurate developer sees all multipliers settle to ≈1 and only the buffer applies.

### Worked example — Angelo in Sprint 1 *(verified live; use this in the report)*

40h/wk − 12h meetings = 28h × 2 weeks = 56h × 0.8 (buffer) = 44.8h × **0.5** (allocation, 1 other concurrent sprint; context-switch = 1.0 at N=1) = **22.4h effective**. Assigned 90h → **402% utilisation, overloaded**. The same 22.4h effective applies in his other sprint (Sprint 3) where 14h assigned → 63%.

### Derived analytics

- **Sprint health score (0–100):** start 100; −30 per overloaded developer; −10 per at-risk (≥80%); −5 if average utilisation > 85%. Status: <40 overloaded, <70 at-risk, else healthy. Comes with a plain-English `recommendation` string that **names developers** (relevant for redaction, §6).
- **Burndown:** expected progress (calendar-days elapsed %) vs actual (done-hours %). Ahead / on-track / behind / at-risk at +10/−5/−20 deltas.
- **Rebalancing suggestions:** for each overloaded developer, find their lowest-priority moveable task and a recipient with enough slack; show projected utilisation for both; one-click **Apply** reassigns. One suggestion per overloaded developer.
- **Ad-hoc simulator:** what-if — pick developer + hypothetical hours → before/after utilisation and whether it would cause overload, without creating a task.
- **Side effect to know:** `computeSprintCapacity` **upserts CapacityRecord on read**. Client-facing paths deliberately bypass it (pure `computeBurndown` instead) so a client page view never writes.

---

## 4. The predictive layer (pillar 2)

### Per-developer estimation-accuracy factor

`factor = Σactual / Σestimated` over completed tasks in a rolling 90-day window, with **pseudo-count Bayesian shrinkage toward 1.0** for small samples:

```
k = max(0, 10 − n);  avg = Σestimated / n
factor = (Σactual + k·avg) / (Σestimated + k·avg)
```

At n≥10 this degenerates to the raw ratio; at n=1 it's ≈1.0 (9 parts prior, 1 part observation). Prevents a new hire's single overshot task from savaging their modelled capacity. Confidence bands: n<5 low (badge hidden), n<15 medium, else high. Trend: when n≥8, split window in half by `completedAt`; if distance-from-1.0 shrinks by >0.05 → "improving", grows → "degrading".

Factor >1 = under-estimator (work takes longer than estimated); <1 = over-estimator. Data comes from the **actual-hours prompt**: when any task transitions to Done (table dropdown or Kanban drag), a dialog asks "how long did it actually take?", pre-filled with the estimate, with a **Skip** button (skipping is never a failure — the row is just excluded from the accuracy window).

### Sprint failure forecast — five-signal weighted model

| Signal | Max pts | Live Sprint 1 value *(verified)* |
|---|---:|---|
| Team utilisation (accuracy-adjusted peak) | 40 | **40/40** — "Angelo Perera, Nomal Ariyarathna, Saajid Jiffrey over adjusted capacity" |
| Ad-hoc history (fraction of last 2 sprints' hours) | 20 | 3/20 — 7% ad-hoc |
| Velocity trend (last 3 sprints' completion rate) | 15 | 3/15 — 94% |
| Days remaining gap (remaining hours vs time left at team pace) | 15 | 4/15 — "206h remaining needs ~11 days; 9 left" |
| Estimation accuracy (team-weighted deviation, asymmetric — under-estimators penalised more) | 10 | 3/10 — under-estimates by 12% |

Raw points (53 here) squashed via `probability = 100 × (1 − e^(−raw/40))` → **73%**. Bands: <25 low, <50 moderate, <75 high, else critical. The exponential squish was chosen over a logistic because raw = 0 must map to 0% (a pristine sprint should not read "50% likely to fail").

The utilisation signal uses **adjusted** capacity: `effective ÷ accuracyFactor` per developer — so a chronic under-estimator's 90h of assigned work is judged against less usable capacity. Every forecast ships its contributor breakdown (points + plain-English detail line) — **explainable, not black-box**; this is a deliberate viva defence (§10).

### Forecast evaluation (`/evaluation` page) — the strongest report artefact

For every completed sprint, the forecast is **recomputed retroactively** with `asOf = sprint.startDate`: accuracy samples filtered to `completedAt < asOf`, velocity/ad-hoc lookups to `endDate < asOf`, tasks completed after `asOf` treated as still pending, and no CapacityRecord writes. No leakage by construction; a model parameter change re-runs the entire evaluation in one request (vs stored predictions, which would freeze bugs into history).

Outcome classification by actual completion rate: ≥90% met, 70–90% partial, <70% missed. Calibration counters: **hits** (predicted high/critical AND slipped), **false alarms** (predicted high/critical, met anyway), **missed alarms** (predicted low/moderate, missed).

**Live evaluation table** *(verified — this is what the screenshot shows)*:

| Sprint | Predicted | Band | Actual completion | Outcome |
|---|---:|---|---:|---|
| Sprint -3 · Site speed foundations | 0% | low | 100% | met |
| Sprint -2 · ADA remediation wave 1 | 44% | moderate | 100% | met |
| Sprint -1 · Checkout & promotions | 59% | high | 89% | partial |
| Sprint 0 · Performance hardening | 65% | high | 66% | missed |

**2 hits, 0 false alarms, 0 missed alarms → 100% alarm precision** on 4 sprints. The chart is a ComposedChart: predicted-failure bars (left axis) against actual-completion line (right axis) — a well-calibrated model shows inverse correlation, which this does.

---

## 5. Role-based access (supervision build)

### The three roles and what each sees

| | **Manager** | **Developer** | **Client** |
|---|---|---|---|
| Lands on | `/dashboard` | `/my-work` | `/portfolio` |
| Nav | Dashboard, Projects tree, Developers, Capacity, Forecast Evaluation, Team & Access | My Work only | Delivery only |
| Sees | Everything | **Own** tasks, own utilisation, own factor, own multiplier chain. Teammates absent from API responses, not hidden by UI | Assigned projects only: progress %, burndown, velocity, softened confidence band. **Zero developer names anywhere** |
| Can | Full CRUD, link accounts, assign clients to projects | Update status + log actual hours on own tasks (server-enforced field allow-list: `status, actualHours, completedAt`) | Read only |

### Identity model

`User.role` is a plain string normalised through `normaliseRole()` (`src/lib/roles.ts`): legacy `admin`/`user` → `manager` (kept so pre-change tokens and written-down logins keep working); unknown → `client` (**fail closed**). Not a Prisma enum: the enum migration fails on legacy rows and cannot express aliasing. `Developer.userId` (nullable, unique) links login to capacity entity; an account with no link can read nothing until a manager links it. `ProjectClient` rows grant client access; no rows = empty portfolio (**deny by default**).

### Enforcement architecture

- **`src/lib/authorize.ts`** — per-request `AuthContext {role, developerId, projectIds}` resolved from DB (deliberately *not* embedded in the JWT — it would go stale on re-link; token lifetime is 8h). Helpers: `requireAuth`, `requireManager`, `requireDeveloperIdentity`, `assertProjectAccess`, `assertSprintAccess`, `assertTaskOwnership`, `withRoute`. All 16 pre-existing route files migrated off the old boolean auth gate; several endpoints return **role-shaped payloads** (same URL, different response per role — e.g. `/api/dashboard` returns a discriminated union `kind: "manager" | "developer" | "client"`).
- **`src/lib/redact.ts`** — **whitelist-only** redaction: response shapes are *built*, never stripped, so a newly added DB field cannot leak by default. `CLIENT_*_KEYS` arrays exist for key-set testing.
- **Route guards** (`src/lib/route-access.ts` + layout) are cosmetic; **the API is the security boundary**.
- **Query-param anti-widening:** `?sprintId=` / `?projectId=` are ANDed with server-derived scope, never substituted — a developer passing a peer's sprint id still gets only their own rows.

### Three non-obvious leak vectors (worth a paragraph in the report)

1. **`Sprint.retrospectiveNotes`** — manager-authored free text that names and evaluates individuals (seed contains "Angelo's estimates are systematically low"). Stripped wholesale from all non-manager responses.
2. **Service-built strings** — `SprintHealth.recommendation` and forecast contributor `detail` interpolate developer names inside sentences; they cannot be field-redacted and are withheld wholesale (client gets only `{band, label}`).
3. **CapacityRecord write-on-read** — client paths bypass the engine entirely (pure burndown), so a client's page view never mutates history.

### Verification: `npm run check:authz` — 48 checks, 48 passing *(verified)*

Curl-based suite (`scripts/authz-check.sh`) with three token contexts (manager / developer / client). Covers: status-code matrix, ownership attacks (PUT a peer's task → 403; reassign own task to a peer via field allow-list → 403), scope attacks (client reading an unassigned project → 403; developer widening `?sprintId=` → still own rows), deny-by-default (zero-assignment client sees empty, not everything), and a **negative content scan**: every client-facing response body is grepped for developer first names (`Angelo|Nomal|Kusalni|Abdulaziz|Saajid`) and sensitive keys (`utilizationPercent`, `retrospectiveNotes`, `estimates`, …). Presentable as a dissertation appendix.

---

## 6. Complete inventory

### Pages (13, under `src/app/(authenticated)/`)

| Route | Role | Contents |
|---|---|---|
| `/` | all | Dispatcher — redirects by role |
| `/dashboard` | manager | Stats cards, capacity summary chart, at-risk sprints, active sprints |
| `/projects`, `/projects/[id]` | manager | Project CRUD; sprint grid; velocity chart |
| `/sprints/[id]` | manager | Health badge, burndown, **ForecastCard**, per-developer capacity cards (factor badge, meetings line, multi-project line), rebalancing suggestions, task table ⇄ 8-column Kanban toggle, retrospective notes (1s-debounce autosave) |
| `/capacity` | manager | Sprint picker, capacity chart, workload table, ad-hoc simulator, cross-sprint heatmap (all devs × all sprints) |
| `/developers` | manager | Developer CRUD + estimation-factor column (factor, trend arrow, n, confidence) |
| `/evaluation` | manager | Calibration chart + per-sprint table (§4) |
| `/admin/users` | manager | All accounts: role select, developer-link select, client project multi-select. Guards: unlink-before-link (unique constraint), refuse demoting the last manager |
| `/my-work` | developer | Own capacity card per in-flight sprint, **"why your capacity is split"** multiplier-chain breakdown, own accuracy card, own task list (assignee column replaced by sprint; status changes + actual-hours prompt work) |
| `/portfolio`, `/portfolio/[projectId]` | client | Project progress cards (completion %, confidence label); drill-in: burndown, velocity chart, sprint list. Imports only PII-free components — safety auditable from the import list |
| `/settings` | all | Theme, profile, sprint defaults, notification toggle |

### API (22 route files)

Auth: `POST /api/auth/login`, `POST /api/auth/register` (role pinned server-side to `developer`; never read from body). Session: `GET /api/me` → `{user, role, developerId, projectIds}`. Admin: `GET|POST /api/admin/users`, `PUT /api/admin/users/[id]`. Domain: projects / sprints / tasks / developers CRUD (writes manager-only), `GET /api/projects/[id]/velocity`, `GET /api/sprints/[id]/capacity` (role-shaped), `GET /api/sprints/[id]/forecast` (manager full; client `{band,label}`; developer 403), `GET /api/developers/accuracy` (+ per-id, self-readable by that developer), `GET /api/evaluation/forecast` (manager), `GET /api/portfolio/[projectId]` (client delivery view), `POST /api/activity/ingest` (manager; upsert by `(source, externalRef)` — Phase 2 GitHub webhook target).

---

## 7. Test data — provenance, structure, exact numbers

### Provenance (say this honestly in the report)

Task titles, project names, and team names are **drawn from Digiform's live Jira** (digiformservices.atlassian.net) so screenshots show authentic agency work rather than lorem-ipsum. Curation rules applied: excluded anything client-embarrassing (fraud/abuse tickets) or naming uninvolved real people; the client-user accounts remain fictional. **All quantitative data (hours, statuses, dates, factors) is engineered seed data** designed to exercise every mechanism — the personas are real names attached to *constructed* workloads, and the "criticised" persona (overloaded, under-estimating, named in retro notes) is deliberately **Angelo himself**, not a colleague. Real people used: Angelo Perera (dev, the author), Nomal Ariyarathna (dev), Kusalni Perera (dev), Abdulaziz Roshan (dev), Saajid Jiffrey (dev). Daisy Cuevas is the real client and Barbara Lee the real PM — **not** used as developer personas. Retro-note wording about colleagues is pronoun-free.

### Logins (all passwords `password123`)

| Email | Role | Persona / purpose |
|---|---|---|
| `admin@sprintplanner.com` | manager | "Admin User" — full access |
| `lead@sprintplanner.com` | manager | "Team Lead" — second manager |
| `angelo@sprintplanner.com` | developer | **Overloaded, ×1.28 under-estimator (n=15, high conf), 12h/wk meetings, 2 concurrent sprints — the headline demo** |
| `nomal@sprintplanner.com` | developer | Accurate, ×1.02 (n=13), cross-sprint |
| `kusalni@sprintplanner.com` | developer | Over-estimator ×0.81 (n=14) |
| `abdulaziz@sprintplanner.com` | developer | New hire, ×1.01 (n=1, **low confidence** — shrinkage demo) |
| `saajid@sprintplanner.com` | developer | Improving trend, ×1.16 (n=12) |
| `newdev@sprintplanner.com` | developer | **No developer profile linked** — fail-closed empty state |
| `client-ecom@sprintplanner.com` | client | NOYZ Storefront only (the at-risk project) |
| `client-mobile@sprintplanner.com` | client | Fleur du Mal + Only Human (many-to-many demo) |
| `client-new@sprintplanner.com` | client | **Zero projects** — deny-by-default empty state |

### Projects & sprints (dates pivot around seed day: current sprints run day −5 → +9)

- **NOYZ Storefront** — Shopify Plus storefront. 4 historic sprints (Site speed foundations, ADA remediation wave 1, Checkout & promotions, Performance hardening — 14-day blocks walking back) + **Sprint 1 · PDP experience** (current, engineered overloaded).
- **Fleur du Mal E-Commerce** — **Sprint 2 · Email & integrations** (current, healthy).
- **Only Human · Concurrent stretch** — **Sprint 3 · Only Human launch stretch** (current, overlaps Sprint 1; Angelo and Nomal are on both → multi-project factor engages).

84 tasks (65 historic with engineered `actualHours` driving the factors; 19 current), 16 capacity records, 383 activity rows. Historic spillover counts are tuned to produce the met/met/partial/missed evaluation distribution. Sample real ticket titles visible in screenshots: *PDP FAQ module*, *Checkout upsells (Checkout Extensibility)*, *Klaviyo auto-suppression rules*, *Mini cart UX improvements*, *Urgent: PDP hero video not playing*, *Launchpad scheduled product drops*, *Alt-text audit — banner imagery*, *Extend cache lifetimes for repeat visitors*.

### ⚠️ Data freshness

The seed pivots dates around the day it runs. Current sprints stay in-flight ~9 days after seeding; accuracy samples stay in the 90-day window for ~3 months. **Reseed (`npm run db:seed`) immediately before any screenshot session**, and never after hand-entering demo data (the seed wipes every table).

---

## 8. Screenshot run-sheet with expected values *(all verified live)*

**Manager (`admin@`):**
1. **Dashboard** — 3 projects, 3 active sprints, 5 developers, **3 overloaded**, 3 at-risk sprints listed.
2. **Sprint 1 · PDP experience** — health score **0 (overloaded)**; burndown **at-risk** (expected ~43%, actual 0% at day ~6 of 14); **ForecastCard: 73% · High** — headline "73% chance this sprint misses commitment — rebalance recommended", contributor bars 40/3/3/4/3; Angelo's capacity card: 90h active / 22.4h effective (402%), ×1.28 badge, "12h/wk meetings", "Shared with 1 other sprint · ×0.50 multi-project"; rebalancing suggestions panel visible.
3. Same sprint, **Kanban** — 8 columns, real ticket titles, priority-coloured cards.
4. **Capacity** — heatmap all devs × 7 sprints; ad-hoc simulator.
5. **Developers** — factor column: Angelo ×1.28 ("under-estimates by 28%", n=15), Kusalni ×0.81, Abdulaziz n=1 low-confidence, Saajid ×1.16 improving.
6. **Evaluation** — the §4 table + chart; "100% alarm precision" header.
7. **Team & Access** — 11 accounts, role/link/project controls, "Unlinked Newcomer" in amber.

**Developer (`angelo@`):** **My Work** — 8 open tasks / 132h; Sprint 1 at 402% (over), Sprint 3 at 63%; the multiplier-chain card reconciling 40 → 28 → 56 → 44.8 → **22.4h**; own ×1.28 accuracy card; task list with Sprint column instead of Assignee, no edit/delete. Optionally `newdev@` for the unlinked empty state.

**Client (`client-ecom@`):** **Delivery** — one card: "NOYZ Storefront · 54% complete · **Delivery at risk**" (band only, no percentage-of-failure, no names); drill-in shows burndown + velocity + sprint list. Optionally `client-new@` — empty portfolio (deny by default).

---

## 9. Verification artefacts available for the report

- `npm test` — **Vitest suite, 134 tests across 14 files, all passing.** Unit tests cover the pure planning logic (multi-project factors, capacity chain incl. the 22.4h/402% worked example, health score, burndown deltas, shrinkage + confidence + trend, all five forecast signals + squish + bands, role normalisation, redaction key-sets, task workflow, rebalancing). Integration tests run against a dedicated `sprint_planner_test` database (migrated + reseeded per run) and pin the evaluation story (low/met, moderate/met, high/partial, high/missed; 2 hits / 0 false alarms / 0 missed alarms), the no-leakage rules (retroactive forecast writes no CapacityRecord, nothing counts as done before `asOf`), CapacityRecord upsert idempotence, the meetings clamp, simulator purity, and the register role-pinning. `npm run test:report` regenerates `docs/test-report.md` (per-test pass/fail table + coverage — ~75% line coverage over `src/services` + `src/lib`), formatted for the Testing chapter.
- `npm run check:authz` — **48/48 passing**; includes negative content scans and ownership/scope attack cases. Print the PASS table as an appendix. Complementary to the Vitest suite: authz covers the HTTP boundary, Vitest covers the logic beneath it.
- `npx tsc --noEmit` — clean.
- `/evaluation` — quantitative calibration of the forecast (2 hits, 0 false alarms, 0 missed alarms on 4 retroactive sprints).
- Design docs already written (reuse for methodology chapters): `docs/predictive-layer.md` (shrinkage derivation, signal weights, squish rationale, why-not-ML), `docs/forecast-evaluation.md` (retroactive methodology, leakage prevention, calibration metric definitions, limitations).

---

## 10. Design decisions and their defences (viva preparation)

1. **Why a weighted five-signal model, not ML?** (a) Defensibility — every point is inspectable, "why 40 for utilisation?" has a principled answer; (b) sample size — a handful of sprints cannot train a classifier without overfitting; (c) the comparison narrative ("Jira reports what happened; this predicts what will") holds better with a transparent model. Future work: fit a logistic regression over the same five features once real data accumulates and compare learned vs hand-chosen weights.
2. **Why pseudo-count shrinkage, not a full Bayesian prior or a linear ramp?** Middle ground: principled, explainable in one formula, one tunable parameter (`SHRINKAGE_TARGET_N = 10`).
3. **Why exponential squish, not logistic?** raw=0 must give 0% probability; a logistic sits at 50% at zero and needs an intercept correction.
4. **Why retroactive evaluation, not stored forecasts?** No leakage by construction; reproducible after any model change; no new schema. Trade-off (recompute cost) negligible at demo scale.
5. **Why equal-split allocation, not hours-weighted?** The weighted version is circular — assigned hours depend on capacity, which would depend on allocation.
6. **Seed circularity ("you validated against data you engineered"):** the seed defines *ground truth* (spillover volumes, per-persona estimation behaviour) but never touches the forecast's inputs directly — the model still has to derive risk from utilisation/velocity/ad-hoc signals without being told outcomes. Frame as **synthetic validation of mechanism, not empirical calibration**; empirical calibration needs 20+ real sprints and is explicitly Phase 2. Claiming less here buys credibility.
7. **Why is RBAC in a capacity thesis?** Don't claim RBAC itself as the contribution. The developer's My Work view is the first screen showing one person's *total* cross-sprint commitment — the exact multi-project case the interim names as unaddressed (pillar 1). Role-differentiated disclosure is the same capacity model surfaced at the altitude each stakeholder can act on (pillar 4). The login plumbing is supporting engineering.
8. **Why role as string + normaliser, not a DB enum?** Enum migration fails on legacy rows; enums can't express aliasing; the live 8h JWTs carry the role as a string anyway. Unknown roles fail closed to `client`.
9. **Why per-request authz context, not JWT claims?** `developerId`/`projectIds` go stale the moment a manager re-links an account; the token is not revocable. One extra indexed query per request.
10. **Why separate client routes instead of a redacted shared page?** A page whose safety is provable from its import list beats conditional rendering that leaks on the next edit.
11. **Why whitelist redaction?** A blacklist silently leaks every newly added field; building shapes fails safe. Key-set assertions make shape drift a test failure.

## 11. Honest limitations (for the evaluation/limitations chapter)

- **Evaluation sample size:** 4 seeded sprints validates mechanism, not statistics. Real validation needs 20+ sprints.
- **Static thresholds:** outcome bands (90/70), forecast bands, and signal weights are hand-set; defensible but not fitted.
- **JWT revocation:** 8h tokens, no server-side revocation — a demoted user keeps stale access up to 8h. Proper fix (tokenVersion column) is documented future work.
- **No automated unit-test suite** beyond the 48-check authz script and the type system; testing chapter should present the authz suite + typecheck as the verification strategy and name this as a trade-off.
- **Context-switch 20% figure** is a literature heuristic, not derived.
- **Forecast recomputed per page load** (no caching) — fine at demo scale.
- **Phase 2 (declared future work, integration points already built):** live GitHub ingestion → `POST /api/activity/ingest`; Google Calendar OAuth → replaces `meetingHoursPerWeek`; forecast caching; per-project calibration.

## 12. Literature (as used in framing)

Cohn (2005) *Agile Estimating and Planning*; Ghimire & Charters (2022) *Software* 1(3) 188–205; Marchwicka & Marchwicki (2023) SSRN *Adaptive Sprint Planning Based on Risk Management*; Nazir et al. (2022) *IT and Management* 23, 315–330; Zander & Meboldt (2024) SEFI Proceedings; Rubin (2012) *Essential Scrum*; Beck (2000) *XP Explained*. (Full citations in the interim report, `docs/`.)

## 13. Key implementation files (for citing code in the report)

| File | What it holds |
|---|---|
| `src/services/overload-detection.ts` | Capacity chain, health score, burndown, simulator (multiplier order ~lines 84–130) |
| `src/services/multi-project-capacity.service.ts` | Allocation + context-switch factors (pure functions) |
| `src/services/estimation-accuracy.service.ts` | Shrinkage, confidence, trend; `asOf` support |
| `src/services/sprint-forecast.service.ts` | Five signals, squish, adjusted analyses; retroactive `buildCapacityAnalyses` |
| `src/services/forecast-evaluation.service.ts` | Retroactive evaluation + calibration counters |
| `src/lib/authorize.ts` / `redact.ts` / `roles.ts` / `route-access.ts` | AuthContext, whitelist redaction, role vocabulary, route map |
| `src/lib/task-statuses.ts` | 8-state workflow, single source of truth |
| `prisma/schema.prisma` / `prisma/seed.ts` | Data model; engineered personas + Jira-derived content |
| `scripts/authz-check.sh` | 48-check authorisation suite |
| `src/app/(authenticated)/my-work/page.tsx`, `portfolio/` | The role-differentiated views |

---

*Repo note: version control began 2026-08-27 with a "Pre-test-suite baseline" commit followed by the test-suite commit — history from here on is per-change.*
