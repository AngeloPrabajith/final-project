# CLAUDE.md

This file is loaded into Claude Code's context for every session in this repo. Its job is to keep the project's **academic thesis** front-of-mind, not to repeat what `README.md` already says.

## What this project actually is

**CS6P05NM Final Year Project** — London Metropolitan University, supervised by Prof. Ruvan Abeysekara.

Title: **Capacity-Aware Sprint Planning System with Predictive Overload Detection.**

The original proposal (Dec 2025) was broader — "Sprint & Capacity Management Software," more of a workload/task tracker. The interim report (Jan 2026) **refined the scope on supervisor recommendation**: the academic contribution is no longer "another Jira" but **explicit capacity modelling + predictive overload detection**. Every design and feature decision from this point on should defend that thesis.

> Quote from the interim report:
> "The project … refines it by introducing predictive and analytical elements that enhance its academic and technical depth as recommended."

## The research gap the project targets

> "There remains a gap between theoretical capacity-aware planning models and their practical implementation within everyday development workflows."

Existing tools (Jira, ClickUp, Azure DevOps) do task status and workflow. They assume stable availability, don't actively model competing projects, context switching, or unplanned work, and surface capacity-related risks *after* a sprint has started. This project's role is to close that gap in a working system grounded in the agile-planning literature (Cohn 2005; Ghimire & Charters 2022; Marchwicka & Marchwicki 2023; Nazir et al. 2022; Zander & Meboldt 2024).

## What "academic value" means for scoping decisions

When choosing what to build next, prefer features that deepen one of these four pillars. Features that are just UX polish on top of a task tracker do **not** advance the thesis.

1. **Explicit capacity modelling** — weeklyCapacity × sprintWeeks × (1 − buffer), excluding done tasks. Already done. Extensions: cross-sprint allocation (a developer on 3 parallel sprints does not have full capacity in each), context-switching cost, per-developer effective-capacity factor learned from history.
2. **Predictive overload detection** — *ahead* of the problem, not after it. Current code is mostly real-time detection (`detectOverload`, `computeSprintHealth`). True prediction would use historical signals (velocity trend, estimation accuracy, typical ad-hoc volume) to produce a forward-looking risk score.
3. **Ad-hoc / unplanned work handling** — the literature repeatedly names this as the gap. The ad-hoc simulator and rebalancing suggestions are a start; a stronger contribution would model typical ad-hoc volume per team and auto-reserve capacity for it.
4. **Decision support over raw tracking** — health score, burndown, rebalancing suggestions all exist. Next layer: actionable recommendations with quantified expected impact ("move these 3 tasks to reduce overload probability from 74% to 22%").

## Build state (as of 2026-04-24)

The README is accurate and fully implemented: CRUD for projects/sprints/tasks/developers, JWT auth on all non-auth routes, capacity engine with buffer and done-task exclusion, sprint health score, burndown, rebalancing suggestions, retrospective notes, Kanban + Table view, velocity chart, heatmap, dark mode, settings, dashboard.

**Predictive layer landed (artefact-proposal build, 2026-04-24):**
- Per-developer estimation-accuracy factor with Bayesian shrinkage. Surfaced as a badge on capacity cards and a column on `/developers`.
- Sprint forecast — weighted five-signal model producing a probability + contributor breakdown, shown on every sprint detail page via the `ForecastCard`.
- Actual-hours prompt on any transition to Done (both table dropdown and Kanban drag), skippable.
- `DeveloperActivity` schema + seed (mock data, ready for Phase 2 GitHub ingestion).
- Activity ingest endpoint + upsert-by-externalRef.

**Multi-project capacity + evaluation + meeting load (artefact-stage build, 2026-05-08):**
- **Cross-sprint allocation factor** — a developer assigned to N concurrent sprints has each sprint's capacity scaled by `1 / (N + 1)` (floored at 0.25). Closes the "multi-project environments" gap the interim names.
- **Context-switch penalty** — additional `1 - 0.20 × (N - 1)` multiplier (floored 0.5), citing Cohn / Sutherland / Weinberg on context-switch productivity loss.
- **`Developer.meetingHoursPerWeek`** — subtracted from weekly hours before the buffer multiplier. Phase 2 will replace the static field with live Google Calendar OAuth.
- **`/evaluation`** page — recomputes forecasts retroactively for completed sprints using only data that existed at sprint start, compares predicted probability against actual completion rate. Strongest evaluation artefact for the final write-up.
- Seed rebuilt: 5 personas, 3 projects (added Mobile App for the concurrent stretch), 4 historic + 3 dynamic-date current sprints, spillover tasks tuned to give one met / one partial / one missed historic outcome the forecast catches.

**Role-based access + role-differentiated views (supervision build, 2026-08-08):**
Supervisor asked for separate logins and screens per user type. Three roles: `manager`, `developer`, `client`.
- **`Developer.userId`** (nullable, unique, `SetNull`) finally joins the login identity to the capacity entity — these were unrelated tables until now, which is why "a developer sees their own workload" was impossible before. **`ProjectClient`** join scopes clients to projects.
- **Server-enforced authorisation.** [src/lib/authorize.ts](src/lib/authorize.ts) resolves `{role, developerId, projectIds}` per request (deliberately *not* in the JWT — it would go stale on re-link). All 16 pre-existing routes migrated off the bare `authenticateRequest` boolean gate; `grep '= authenticateRequest' src/app/api` is now zero because nothing uses it.
- **Whitelist-only redaction** in [src/lib/redact.ts](src/lib/redact.ts) — shapes are built, never stripped, so a new field can't leak by default.
- **Developer "My Work"** ([src/app/(authenticated)/my-work/](src/app/(authenticated)/my-work/page.tsx)) — the first view of one person's *total* cross-sprint commitment, showing every multiplier in the chain. This is the part that advances pillar 1; the rest is plumbing.
- **Client "Delivery"** ([src/app/(authenticated)/portfolio/](src/app/(authenticated)/portfolio/page.tsx)) — separate routes rather than a redacted `/projects/[id]`, so the page's safety is auditable from its import list.
- **`npm run check:authz`** — 48-check verification suite ([scripts/authz-check.sh](scripts/authz-check.sh)), including a content scan of every client response for developer names. Presentable as a dissertation appendix.
- Role vocabulary is a plain string normalised through [src/lib/roles.ts](src/lib/roles.ts), not a Prisma enum — the enum migration fails on legacy `admin`/`user` rows and can't express aliasing. Unknown roles fail closed to `client`.

The interim report's "Further Work" code side is complete. What remains:

- **Final report write-up.** All implementation and evaluation artefacts now exist.
- **Phase 2 features (post-panel):** live GitHub API client + activity widget; real Google Calendar OAuth replacing the static `meetingHoursPerWeek` field; forecast caching.

## Access control — where things live

- **Role vocabulary** — [src/lib/roles.ts](src/lib/roles.ts). `normaliseRole` accepts legacy `admin`/`user` (both → `manager`) so 8-hour tokens minted pre-change keep working; unknown → `client` (fail closed). `landingPathFor` drives post-login routing.
- **Authorisation** — [src/lib/authorize.ts](src/lib/authorize.ts): `requireAuth`, `requireManager`, `requireDeveloperIdentity`, `assertProjectAccess`, `assertSprintAccess`, `assertTaskOwnership`, `withRoute`.
- **Redaction** — [src/lib/redact.ts](src/lib/redact.ts). Whitelist-only. `CLIENT_*_KEYS` arrays exist so a test can key-set assert against shape drift.
- **Route guards (cosmetic)** — [src/lib/route-access.ts](src/lib/route-access.ts) + the layout. Not a security boundary; the API is.
- **Three traps worth remembering:** (1) `Sprint.retrospectiveNotes` is manager-authored free text that names and evaluates individuals — the least obvious leak in the codebase; (2) `SprintHealth.recommendation` and `ForecastContributor.detail` interpolate developer names inside service-built strings, so they must be withheld wholesale rather than filtered; (3) `computeSprintCapacity` upserts `CapacityRecord` on read — pass `{ persist: false }` on any client-facing path.
- **Query-param widening** is the highest-risk bug class here: `?sprintId=` and `?projectId=` are ANDed with server-derived scope inside the services, never substituted.

## Predictive layer — where things live

- **Estimation accuracy** — [src/services/estimation-accuracy.service.ts](src/services/estimation-accuracy.service.ts) (Bayesian shrinkage; supports `asOf` for retroactive evaluation). API: [src/app/api/developers/accuracy/route.ts](src/app/api/developers/accuracy/route.ts), [src/app/api/developers/[id]/accuracy/route.ts](src/app/api/developers/[id]/accuracy/route.ts).
- **Sprint forecast** — [src/services/sprint-forecast.service.ts](src/services/sprint-forecast.service.ts) (5-signal weighted model + exponential squish; supports `asOf` for retroactive evaluation; runs `buildCapacityAnalyses` locally when retroactive so it never mutates `CapacityRecord`). API: [src/app/api/sprints/[id]/forecast/route.ts](src/app/api/sprints/[id]/forecast/route.ts).
- **Multi-project capacity** — [src/services/multi-project-capacity.service.ts](src/services/multi-project-capacity.service.ts) (cross-sprint allocation + context-switch penalty, pure functions). Helper: `findOverlappingSprintsForDeveloper` in [src/services/sprint.service.ts](src/services/sprint.service.ts). The factor is multiplied into `effectiveCapacityHours` inside [src/services/overload-detection.ts](src/services/overload-detection.ts), with a fall-through to `1.0` so the base engine is never broken.
- **Forecast evaluation** — [src/services/forecast-evaluation.service.ts](src/services/forecast-evaluation.service.ts), API [src/app/api/evaluation/forecast/route.ts](src/app/api/evaluation/forecast/route.ts), page [src/app/(authenticated)/evaluation/page.tsx](src/app/(authenticated)/evaluation/page.tsx). Computes retroactive forecasts using only data available before each historic sprint's start — defensible against leakage.
- **Capacity engine integration point** — [src/services/overload-detection.ts](src/services/overload-detection.ts) lines ~84-130. Order of multipliers: meetings subtracted from weekly hours → multiplied by sprint weeks → buffer multiplier → multi-project factor.
- **Meeting hours** — `Developer.meetingHoursPerWeek` (default 0). Subtracted from weekly hours up front. UI in [src/app/(authenticated)/developers/page.tsx](src/app/(authenticated)/developers/page.tsx). Phase 2 swap-in: live Google Calendar OAuth.
- **Activity ingest** — [src/app/api/activity/ingest/route.ts](src/app/api/activity/ingest/route.ts) (upsert by `(source, externalRef)`). Ready for Phase 2 GitHub webhook.
- **Hooks** — `useAllAccuracies`, `useDeveloperAccuracy` in [src/hooks/use-developers.ts](src/hooks/use-developers.ts); `useForecast`, `useForecastEvaluation` in [src/hooks/use-sprints.ts](src/hooks/use-sprints.ts); task mutations invalidate `["forecast"]`, `["accuracy"]`, `["evaluation"]`.
- **UI components** — [src/components/sprints/forecast-card.tsx](src/components/sprints/forecast-card.tsx), [src/components/tasks/actual-hours-prompt.tsx](src/components/tasks/actual-hours-prompt.tsx).
- **Seed** — [prisma/seed.ts](prisma/seed.ts). `PERSONAS` array drives estimation-accuracy demo; `meetingHoursPerWeek` per persona; `spilloverCount` in historic sprints tunes the evaluation outcome distribution. Sprint dates pivot around today.
- **Design notes** — [docs/predictive-layer.md](docs/predictive-layer.md) (shrinkage, weights, squish), [docs/forecast-evaluation.md](docs/forecast-evaluation.md) (retroactive methodology, calibration metrics).

## Working directives for Claude

- **Do not treat this like a generic CRUD app.** Every new feature should be framed in terms of which academic pillar it advances. If you cannot explain that for a proposed feature, say so and push back.
- **Do not suggest features that already exist.** The README is current; check it before recommending. (Previously-listed "gaps" from March 2026 — priority, capacity buffer, done-task exclusion, auth, burndown, heatmap, Kanban — are all shipped.)
- **Prefer depth over breadth.** One well-evaluated predictive mechanism with written-up rationale beats five shallow features.
- **Keep the write-up in mind.** Features that produce interesting evaluation artefacts (charts, metrics, comparative results against the no-capacity-modelling baseline) are worth more than features that are merely useful.
- **Respect supervisor feedback pattern.** The supervisor pushed Angelo toward "predictive and analytical depth" once already. Err on the side of analytical, not ergonomic.

## Candidate unique features (ranked by academic value)

These are the directions Angelo and Claude should evaluate together. Not a backlog — a shortlist to discuss and pick from.

1. **Cross-sprint developer allocation.** A developer on parallel sprints currently looks fully available in each. Model their *total* weekly commitment across concurrent sprints; split effective capacity proportionally. Directly addresses the "multi-project environments" language in the interim.
2. **Historical estimation-accuracy factor per developer.** Track estimated vs actual (completion-weighted) per completed sprint; derive a personal velocity factor; feed it into future capacity predictions. Gives the engine its first truly *predictive* signal.
3. **Sprint success probability score.** Not binary overload or a static 0–100 health number — a probability derived from capacity utilisation + velocity trend + days remaining + historical ad-hoc volume. Could be a simple logistic / weighted model; doesn't need ML.
4. **Ad-hoc reservation model.** Compute average ad-hoc hours per sprint from history; auto-recommend a per-sprint ad-hoc reserve; flag sprints planned without reserve as higher-risk.
5. **Multi-project weekly heatmap showing actual overlap.** Current heatmap is per-sprint utilisation. Add a calendar-week view summing commitments across *all* active sprints a developer is on. Makes cross-sprint overload visible.
6. **Context-switch penalty.** Apply a configurable penalty when a developer is on >N sprints concurrently (literature supports ~20% productivity loss per additional context). Surfaces as reduced effective capacity.
7. **Sprint risk timeline.** Replay `CapacityRecord` history across a sprint to show when/how risk materialised — useful evaluation artefact.
8. **Scenario harness + evaluation page.** Seed predefined team configurations, record outcomes, compare with-vs-without capacity modelling. Directly feeds the final report's evaluation section.

## Referenced literature (use for write-up framing)

- Cohn, M. (2005) *Agile Estimating and Planning.*
- Ghimire, D. & Charters, S. (2022) 'The impact of Agile development practices on project outcomes', *Software* 1(3), 188–205.
- Marchwicka, E. & Marchwicki, T. (2023) *Adaptive Sprint Planning Based on Risk Management.* SSRN.
- Nazir, S. et al. (2022) 'Adapting agile development practices for hyper-agile environments', *Information Technology and Management* 23, 315–330.
- Zander, M.O. & Meboldt, M. (2024) 'Navigating the unknown…', SEFI Conference Proceedings.
- Rubin, K.S. (2012) *Essential Scrum.*
- Beck, K. (2000) *Extreme Programming Explained.*

## Source docs

Authoritative — read if in doubt about intent.

- [docs/LMU Final Project Proposal - Angelo Perera 25024547 (1).md](docs/LMU%20Final%20Project%20Proposal%20-%20Angelo%20Perera%2025024547%20%281%29.md)
- [docs/25024547 - Interim Report Submission - CS6P05NM - Angelo Perera (6).md](docs/25024547%20-%20Interim%20Report%20Submission%20-%20CS6P05NM%20-%20Angelo%20Perera%20%286%29.md)
- [README.md](README.md) — currently accurate description of the implemented system
