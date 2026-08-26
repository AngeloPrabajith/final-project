# Test Report — Capacity-Aware Sprint Planning System

**Generated:** 2026-08-27 · `npm run test:report`

**Result: 134/134 tests passing** across 14 files (0 failed).

Unit tests exercise the pure planning logic (capacity chain, multi-project factors, shrinkage, forecast signals, redaction whitelists); integration tests run against a dedicated PostgreSQL test database (`sprint_planner_test`), migrated and reseeded from `prisma/seed.ts` before every run. The HTTP-level authorisation boundary is covered separately by the 48-check suite in `scripts/authz-check.sh` (`npm run check:authz`), which exercises the running API with manager / developer / client tokens, including negative content scans of client responses for developer names.

## tests/integration/capacity-records.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| capacity engine against the seeded database › reproduces the handbook worked example end to end: Angelo at 22.4h effective and 402% in Sprint 1 | pass | 140 |
| capacity engine against the seeded database › includes paused tasks in assigned hours — pausing does not release capacity | pass | 21 |
| capacity engine against the seeded database › excludes done tasks from assigned hours — a fully completed sprint shows zero active load | pass | 21 |
| capacity engine against the seeded database › upserts exactly one CapacityRecord per (developer, sprint) and stays idempotent across recomputes | pass | 32 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › computes an asOf-anchored forecast without writing a single CapacityRecord | pass | 37 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › treats tasks completed after asOf as still pending — nothing is 'done' at sprint start | pass | 30 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › computes burndown for the client path with zero database writes | pass | 2 |
| meeting-hours clamp on a scratch fixture › clamps net capacity to zero when meeting hours exceed weekly hours, and still reports meaningfully | pass | 4 |

## tests/integration/forecast-evaluation.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| retroactive forecast evaluation on the four historic NOYZ sprints › classifies the four historic sprints as low/met, moderate/met, high/partial and high/missed | pass | 191 |
| retroactive forecast evaluation on the four historic NOYZ sprints › reports 2 correct alarms, 0 false alarms and 0 missed alarms (100% alarm precision) | pass | 42 |
| retroactive forecast evaluation on the four historic NOYZ sprints › orders evaluations chronologically and names a top contributor for each | pass | 41 |

## tests/integration/register-role.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| registration endpoint — role pinned server-side › creates a developer even when the request body claims to be a manager | pass | 240 |
| registration endpoint — role pinned server-side › leaves the new account unlinked to any developer profile (fail-closed until a manager links it) | pass | 6 |
| registration endpoint — role pinned server-side › rejects a duplicate email with 409 | pass | 2 |
| registration endpoint — role pinned server-side › rejects a submission missing required fields with 400 | pass | 0 |

## tests/integration/simulator-rebalancing.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| ad-hoc simulator against the seeded database › adds hypothetical hours to the developer's live analysis and reconciles with the chain | pass | 172 |
| ad-hoc simulator against the seeded database › is a pure what-if — no task row is ever created | pass | 32 |
| rebalancing suggestions against the overloaded seeded sprint › emits at most one suggestion per overloaded developer, each reconciling with the capacity chain | pass | 19 |

## tests/unit/burndown.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| burndown classification at the +10 / −5 / −20 deltas › computes expected progress from calendar days elapsed | pass | 2 |
| burndown classification at the +10 / −5 / −20 deltas › classifies ahead when actual leads expected by more than 10 points | pass | 0 |
| burndown classification at the +10 / −5 / −20 deltas › classifies on-track down to exactly −5 | pass | 0 |
| burndown classification at the +10 / −5 / −20 deltas › classifies behind between −5 and −20 | pass | 0 |
| burndown classification at the +10 / −5 / −20 deltas › classifies at-risk beyond −20 | pass | 0 |
| burndown classification at the +10 / −5 / −20 deltas › treats a sprint with no estimated work as on-track with zeroed progress | pass | 0 |
| burndown classification at the +10 / −5 / −20 deltas › clamps days passed to the sprint window | pass | 0 |

## tests/unit/capacity-chain.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| capacity chain — handbook worked example (Angelo in Sprint 1) › reproduces 40h/wk − 12h meetings × 2 weeks = 56h nominal capacity | pass | 1 |
| capacity chain — handbook worked example (Angelo in Sprint 1) › reduces 56h to 22.4h effective through buffer ×0.8 and multi-project ×0.5 | pass | 0 |
| capacity chain — handbook worked example (Angelo in Sprint 1) › flags 90 assigned hours against 22.4h effective as 402% utilisation and overloaded | pass | 0 |
| capacity chain — edges › keeps the full capacity when the buffer is 0 | pass | 0 |
| capacity chain — edges › keeps 60% of capacity at the maximum 0.4 buffer | pass | 0 |
| capacity chain — edges › reports 100% utilisation, not a division error, when effective capacity is zero but work is assigned | pass | 0 |
| capacity chain — edges › does not flag a developer sitting exactly at effective capacity | pass | 0 |
| capacity chain — edges › sums assigned hours across a task list | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › adds the hypothetical hours to assigned work and recomputes utilisation | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › reports wouldCauseOverload only when the addition crosses the line | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › leaves the before snapshot untouched | pass | 0 |

## tests/unit/estimation-accuracy.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| estimation-accuracy factor — pseudo-count shrinkage toward 1.0 › lands near 1.0 for a single task overshot by 50% (n=1, k=9) | pass | 2 |
| estimation-accuracy factor — pseudo-count shrinkage toward 1.0 › equals the raw Σactual/Σestimated ratio once n reaches 10 (k=0) | pass | 0 |
| estimation-accuracy factor — pseudo-count shrinkage toward 1.0 › returns a neutral 1.0 factor with no samples at all | pass | 0 |
| confidence bands at n<5 and n<15 › classifies n=4 as low confidence | pass | 0 |
| confidence bands at n<5 and n<15 › classifies n=5 as medium confidence | pass | 0 |
| confidence bands at n<5 and n<15 › classifies n=14 as medium confidence | pass | 0 |
| confidence bands at n<5 and n<15 › classifies n=15 as high confidence | pass | 0 |
| trend detection — halves compared by distance from 1.0, 0.05 movement rule › reports no trend below eight samples | pass | 0 |
| trend detection — halves compared by distance from 1.0, 0.05 movement rule › labels a developer improving when the later half sits closer to 1.0 | pass | 0 |
| trend detection — halves compared by distance from 1.0, 0.05 movement rule › labels a developer degrading when the later half drifts away from 1.0 | pass | 0 |
| trend detection — halves compared by distance from 1.0, 0.05 movement rule › labels movement within ±0.05 as stable | pass | 0 |
| sampling window — rolling 90 days, asOf-anchored (no leakage) › queries completions from exactly 90 days before the anchor up to the anchor | pass | 0 |
| sampling window — rolling 90 days, asOf-anchored (no leakage) › excludes completions at or after asOf via a strict less-than bound | pass | 0 |
| applying the factor to capacity › divides effective capacity by the factor (an under-estimator has less usable capacity) | pass | 0 |
| applying the factor to capacity › returns capacity unchanged for a zero, negative or missing factor (never breaks the base engine) | pass | 0 |

## tests/unit/multi-project-capacity.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| allocation factor — 1/(N+1) equal split across concurrent sprints › gives full capacity to a developer on a single sprint (N=0) | pass | 1 |
| allocation factor — 1/(N+1) equal split across concurrent sprints › halves capacity when one other concurrent sprint exists (N=1) | pass | 0 |
| allocation factor — 1/(N+1) equal split across concurrent sprints › splits capacity three ways at N=2 | pass | 0 |
| allocation factor — 1/(N+1) equal split across concurrent sprints › splits capacity four ways at N=3 | pass | 0 |
| allocation factor — 1/(N+1) equal split across concurrent sprints › floors the allocation factor at 0.25 when a developer is on five or more concurrent sprints | pass | 0 |
| allocation factor — 1/(N+1) equal split across concurrent sprints › treats a negative count defensively as zero | pass | 0 |
| context-switch factor — 20% loss per context past the first extra › applies no penalty for a single sprint (N=0) | pass | 0 |
| context-switch factor — 20% loss per context past the first extra › applies no penalty for exactly two concurrent sprints (N=1) | pass | 0 |
| context-switch factor — 20% loss per context past the first extra › costs 20% at three concurrent sprints (N=2) | pass | 0 |
| context-switch factor — 20% loss per context past the first extra › costs 40% at four concurrent sprints (N=3) | pass | 0 |
| context-switch factor — 20% loss per context past the first extra › floors the context-switch factor at 0.5 however many sprints are stacked | pass | 0 |

## tests/unit/rebalancing.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| rebalancing suggestions — move low-priority work off overloaded developers › returns nothing when nobody is overloaded | pass | 1 |
| rebalancing suggestions — move low-priority work off overloaded developers › returns nothing when nobody has headroom to receive work | pass | 0 |
| rebalancing suggestions — move low-priority work off overloaded developers › prefers moving the LOWEST-priority task first | pass | 1 |
| rebalancing suggestions — move low-priority work off overloaded developers › never suggests moving a completed task | pass | 0 |
| rebalancing suggestions — move low-priority work off overloaded developers › emits at most one suggestion per overloaded developer | pass | 0 |
| rebalancing suggestions — move low-priority work off overloaded developers › only offers recipients who can absorb the task within effective capacity | pass | 0 |
| rebalancing suggestions — move low-priority work off overloaded developers › projects both developers' post-move utilisation with the capacity-chain arithmetic | pass | 0 |

## tests/unit/redact.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| whitelist redaction — client shapes are BUILT, never stripped › produces exactly the CLIENT_TASK_KEYS set for a client task | pass | 1 |
| whitelist redaction — client shapes are BUILT, never stripped › produces exactly the CLIENT_SPRINT_KEYS set for a client sprint | pass | 0 |
| whitelist redaction — client shapes are BUILT, never stripped › produces exactly the CLIENT_PROJECT_KEYS set for a client project | pass | 0 |
| whitelist redaction — client shapes are BUILT, never stripped › drops the assignee, actual hours, completion timestamp and description from tasks | pass | 0 |
| whitelist redaction — client shapes are BUILT, never stripped › drops retrospectiveNotes and capacityBuffer from sprints | pass | 0 |
| whitelist redaction — client shapes are BUILT, never stripped › redacts the nested sprint and task arrays recursively through a project | pass | 0 |
| whitelist redaction — client shapes are BUILT, never stripped › never emits a developer name, utilisation figure or recommendation string anywhere in a client shape | pass | 0 |
| delivery confidence — band only, never the probability › labels the low band as On track | pass | 0 |
| delivery confidence — band only, never the probability › labels the moderate band as On track — minor risk | pass | 0 |
| delivery confidence — band only, never the probability › labels the high band as Delivery at risk | pass | 0 |
| delivery confidence — band only, never the probability › labels the critical band as Delivery at significant risk | pass | 0 |
| developer task-update field allow-list › permits exactly status, actualHours and completedAt | pass | 0 |
| developer task-update field allow-list › rejects an attempt to reassign a task to a peer | pass | 0 |
| developer task-update field allow-list › rejects estimate tampering and any unknown field | pass | 0 |
| personal capacity narrowing › returns only the requested developer's analysis | pass | 0 |
| personal capacity narrowing › returns null rather than falling back to the full list when the developer has no work | pass | 0 |

## tests/unit/roles.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| role normalisation — plain string + aliases instead of a DB enum › maps the legacy admin role to manager | pass | 1 |
| role normalisation — plain string + aliases instead of a DB enum › maps the legacy user role to manager | pass | 0 |
| role normalisation — plain string + aliases instead of a DB enum › maps lead to manager and dev to developer | pass | 0 |
| role normalisation — plain string + aliases instead of a DB enum › accepts the canonical three unchanged | pass | 0 |
| role normalisation — plain string + aliases instead of a DB enum › is case-insensitive and trims whitespace | pass | 0 |
| role normalisation — plain string + aliases instead of a DB enum › fails closed: unknown, empty, null and undefined all collapse to client | pass | 0 |
| post-login landing per role › routes manager to /dashboard, developer to /my-work, client to /portfolio | pass | 0 |

## tests/unit/sprint-forecast-signals.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps zero raw points to exactly 0% probability | pass | 2 |
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps 53 raw points to 73% (the live Sprint 1 figure) | pass | 0 |
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps 40 raw points to 63% and saturates gracefully at high raw scores | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 0% low as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 24% low as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 25% moderate as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 49% moderate as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 50% high as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 74% high as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 75% critical as undefined | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 100% critical as undefined | pass | 0 |
| signal 1: team utilisation (max 40) — factor-adjusted peak › awards zero points when every developer sits below 80% | pass | 0 |
| signal 1: team utilisation (max 40) — factor-adjusted peak › caps at 40 points at 120% utilisation and beyond | pass | 0 |
| signal 1: team utilisation (max 40) — factor-adjusted peak › scores the PEAK developer, not the average | pass | 0 |
| signal 1: team utilisation (max 40) — factor-adjusted peak › returns zero with no developers assigned | pass | 0 |
| signal 5: estimation accuracy (max 10) — asymmetric penalty › caps at 10 points for a heavily under-estimating team | pass | 0 |
| signal 5: estimation accuracy (max 10) — asymmetric penalty › penalises over-estimators far more gently, capped at 4 | pass | 0 |
| signal 5: estimation accuracy (max 10) — asymmetric penalty › awards zero for a perfectly calibrated team | pass | 0 |
| signal 5: estimation accuracy (max 10) — asymmetric penalty › weights the team factor by assigned hours | pass | 0 |
| signal 4: days remaining (max 15) — remaining work vs time left › caps at 15 when the gap exceeds 30% of the sprint length | pass | 0 |
| signal 4: days remaining (max 15) — remaining work vs time left › awards zero when the remaining work fits the remaining days | pass | 0 |
| signal 4: days remaining (max 15) — remaining work vs time left › ignores completed tasks in the remaining-hours total | pass | 0 |
| signal 4: days remaining (max 15) — remaining work vs time left › scores zero before the sprint starts and after it ends | pass | 0 |
| signal 3: velocity trend (max 15) — stepwise on past completion rate › caps at 15 when the historic completion rate falls below 70% | pass | 0 |
| signal 3: velocity trend (max 15) — stepwise on past completion rate › awards zero for a ≥95% completion history | pass | 0 |
| signal 3: velocity trend (max 15) — stepwise on past completion rate › awards zero with no historic sprints on the project | pass | 0 |
| signal 3: velocity trend (max 15) — stepwise on past completion rate › only looks at sprints that ended before the asOf anchor | pass | 0 |
| signal 2: ad-hoc history (max 20) — stepwise on unplanned fraction › caps at 20 when ad-hoc work reaches 30% of recent sprint hours | pass | 0 |
| signal 2: ad-hoc history (max 20) — stepwise on unplanned fraction › awards zero when unplanned work stays under 5% | pass | 0 |
| signal 2: ad-hoc history (max 20) — stepwise on unplanned fraction › awards zero with no historic data | pass | 0 |

## tests/unit/sprint-health.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| sprint health score — 100 baseline with per-developer penalties › scores an empty sprint 100 and healthy | pass | 1 |
| sprint health score — 100 baseline with per-developer penalties › scores a comfortable team 100 with no penalties | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › subtracts 30 for each overloaded developer | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › subtracts 10 for each at-risk developer at or above 80% | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › subtracts 5 when average utilisation exceeds 85% | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › classifies at-risk below 70 and overloaded below 40 (band boundaries) | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › never scores below zero | pass | 0 |
| sprint health score — 100 baseline with per-developer penalties › interpolates developer names into the recommendation string (the reason clients never receive it) | pass | 0 |

## tests/unit/task-statuses.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| task workflow — single source of truth for the eight states › defines exactly eight statuses in Kanban column order | pass | 1 |
| task workflow — single source of truth for the eight states › treats only done as terminal for capacity and estimation-accuracy purposes | pass | 0 |
| task workflow — single source of truth for the eight states › shows every column by default | pass | 1 |
| task workflow — single source of truth for the eight states › labels done as Released to Prod | pass | 0 |

## Coverage (src/services + src/lib)

| | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| **Total** | 73.03% | 60.04% | 69.44% | 75.52% |
| src/lib/auth.ts | 20% | 16.66% | 33.33% | 21.42% |
| src/lib/authorize.ts | 0% | 0% | 0% | 0% |
| src/lib/redact.ts | 100% | 60% | 100% | 100% |
| src/lib/roles.ts | 100% | 100% | 100% | 100% |
| src/lib/route-access.ts | 0% | 0% | 0% | 0% |
| src/lib/task-statuses.ts | 100% | 50% | 100% | 100% |
| src/services/capacity.service.ts | 29.41% | 16.66% | 66.66% | 28.57% |
| src/services/developer.service.ts | 0% | 100% | 0% | 0% |
| src/services/estimation-accuracy.service.ts | 97.14% | 93.33% | 100% | 100% |
| src/services/forecast-evaluation.service.ts | 88.88% | 80% | 100% | 93.54% |
| src/services/multi-project-capacity.service.ts | 100% | 100% | 100% | 100% |
| src/services/overload-detection.ts | 96.93% | 91.52% | 100% | 98.78% |
| src/services/project.service.ts | 0% | 0% | 0% | 0% |
| src/services/rebalancing.service.ts | 100% | 77.27% | 100% | 100% |
| src/services/sprint-forecast.service.ts | 90.81% | 75.78% | 100% | 96.29% |
| src/services/sprint.service.ts | 18.75% | 3.57% | 16.66% | 23.07% |
| src/services/task.service.ts | 0% | 0% | 0% | 0% |

Coverage is scoped to the analytical core (`src/services/**`, `src/lib/**`); React components and API route handlers are exercised by the authz suite and manual browser verification rather than unit coverage.
