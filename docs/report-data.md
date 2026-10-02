# Report data: Cadence

**Collected:** 2026-10-02. Steps: fresh `npm run db:seed`, then `npm run test:report`, then live API calls to `http://localhost:3000`, logged in as the seeded manager (`admin@sprintplanner.com`). No source code was modified.

The demo seed sets sprint dates relative to the day it runs, so the calendar dates below are for a 2026-10-02 run. The hours, percentages, points and outcomes do not depend on the run date.

---

## 1. Coverage (Table 5.3)

Source: `docs/test-report.md`, regenerated 2026-10-02.

**138/138 tests passing across 14 test files (0 failed)**: 10 unit files and 4 integration files.

| Module | Lines covered (%) |
|---|---:|
| `src/services/overload-detection.ts` | 98.78 |
| `src/services/estimation-accuracy.service.ts` | 100 |
| `src/services/sprint-forecast.service.ts` | 96.68 |
| `src/services/forecast-evaluation.service.ts` | 93.54 |
| `src/services/rebalancing.service.ts` | 100 |
| `src/services/multi-project-capacity.service.ts` | 100 |
| `src/lib/redact.ts` | 100 |
| `src/lib/roles.ts` | 100 |
| `src/lib/task-statuses.ts` | 100 |
| `src/lib/authorize.ts` | 0 |
| **Total** | **76.8** |

- The **Total** covers only `src/services/**` and `src/lib/**` (17 files). It is not a whole-repository figure.
- `authorize.ts` has 0% unit coverage on purpose. It is tested over HTTP by the 48-check authorisation suite in Appendix B, using real tokens for each role.

---

## 2. Forecast evaluation (Table 5.4)

Source: `GET /api/evaluation/forecast`, called with a manager token and no query parameters. Rows are in chronological order (sprint end date, ascending), which is also the order the API returns. Each forecast is recomputed as it would have looked on that sprint's start date, so the model only sees data that existed at planning time.

| Sprint | Project | Predicted failure probability (%) | Band | Actual completion rate (%) | Outcome | Classification | Top contributing signal |
|---|---|---:|---|---:|---|---|---|
| Sprint -3 · Site speed foundations | NOYZ Storefront | 0 | low | 100 | met | correct no alarm | None (all signals 0)¹ |
| Sprint -2 · ADA remediation wave 1 | Aurora Living E-Commerce | 44 | moderate | 100 | met | correct no alarm | Team utilisation (22/40 pts) |
| Sprint -1 · Checkout & promotions | NOYZ Storefront | 59 | high | 89 | partial | hit | Team utilisation (32/40 pts) |
| Sprint 0 · Performance hardening | Aurora Living E-Commerce | 65 | high | 66 | missed | hit | Team utilisation (40/40 pts) |

**hitCount = 2 · falseAlarmCount = 0 · missedAlarmCount = 0** (totalSprints = 4)

- **Alarm precision** is hits ÷ (hits + false alarms) = 2/2 = 100%.
- **Both sprints that fell short were flagged.** Sprint -1 was partial and Sprint 0 was missed; both were predicted in the high band.

¹ For Sprint -3, every contributor scored 0 points. The API picks the top contributor by sorting on points and taking the first, so it returns `{"key":"utilisation","label":"Team utilisation","points":0}`. That is a tie-break, not a real driver.

**Supporting figures, from the same response:**

| Sprint | Dates (this run) | Estimated hours committed | Estimated hours completed |
|---|---|---:|---:|
| Sprint -3 · Site speed foundations | 2026-07-19 to 2026-08-01 | 130 | 130 |
| Sprint -2 · ADA remediation wave 1 | 2026-08-02 to 2026-08-15 | 149 | 149 |
| Sprint -1 · Checkout & promotions | 2026-08-16 to 2026-08-29 | 153 | 136 |
| Sprint 0 · Performance hardening | 2026-08-30 to 2026-09-12 | 203 | 133 |

**How the column names map to the real API fields:**

| Column above | API field | Notes |
|---|---|---|
| Sprint | `sprintName` | |
| Project | `projectName` | |
| Predicted failure probability | `predictedProbability` | Whole-number percentage |
| Band | `predictedBand` | `low` below 25, `moderate` below 50, `high` below 75, otherwise `critical` |
| Actual completion rate | `actualCompletionRate` | A fraction from 0 to 1 (completed estimated hours ÷ total estimated hours). Multiplied by 100 above. |
| Outcome | `outcome` | `met` at 0.90 or above, `partial` from 0.70 to 0.90, `missed` below 0.70 |
| Classification | not returned by the API | Derived using the counting rules in `forecast-evaluation.service.ts`, where an "alarm" means a band of high or critical:<br>• **hit**: alarm, and the outcome was not met<br>• **false alarm**: alarm, and the outcome was met<br>• **missed alarm**: no alarm, and the outcome was missed<br>• **correct no alarm**: anything else |
| Top contributing signal | `topContributor` | An object `{key, label, points}` for the signal with the most points |

---

## 3. Live Sprint 1 forecast

Sources:
- `GET /api/sprints/{id}/forecast` for **Sprint 1 · PDP experience** (NOYZ Storefront)
- the sprint day, from `GET /api/sprints/{id}/capacity` → `burndown`

**Probability: 70% · band: high.** The API fields are `probabilityPercent` and `riskBand`. The raw points total 48, and 100 × (1 − e^(−48/40)) = 69.9, which rounds to 70.

Headline returned: "70% chance this sprint misses commitment - rebalance recommended."

| Signal (key) | Points | Max | Detail returned |
|---|---:|---:|---|
| Team utilisation (`utilisation`) | 40 | 40 | Angelo Perera, Nomal Ariyarathna, Saajid Jiffrey over adjusted capacity. Peak Angelo Perera 206%. |
| Ad-hoc history (`adhocHistory`) | 3 | 20 | Ad-hoc work made up 7% of recent sprint hours. |
| Velocity trend (`velocityTrend`) | 3 | 15 | Recent 2-sprint completion rate: 94%. |
| Days remaining (`daysRemaining`) | 0 | 15 | On pace: 113h left with 9 days remaining. |
| Estimation accuracy (`estimationAccuracy`) | 2 | 10 | Team tends to under-estimate by 7% on average. |
| **Total** | **48** | **100** | |

**Today is Day 5 of 14.** The capacity endpoint returns `burndown.daysPassed = 5` and `daysTotal = 14`, and the sprint dashboard's burndown indicator displays the same "Day 5 of 14". On this run the sprint covers 2026-09-27 to 2026-10-11. The forecast endpoint itself does not return a day field.

**Supporting detail: per-developer adjusted analysis, from the same forecast response.**

| Developer | Assigned (h) | Effective capacity (h) | Utilisation | Multi-project factor | Accuracy factor | Accuracy-adjusted capacity (h) | Accuracy-adjusted utilisation |
|---|---:|---:|---:|---:|---:|---:|---:|
| Angelo Perera | 36 | 22.4 | 161% | ×0.5 | 1.28 | 17.5 | 206% |
| Nomal Ariyarathna | 16 | 12.4 | 129% | ×0.267 | 1.02 | 12.2 | 132% |
| Kusalni Perera | 35 | 41.6 | 84% | ×1.0 | 0.81 | 51.4 | 68% |
| Saajid Jiffrey | 26 | 24.0 | 108% | ×0.5 | 1.16 | 20.7 | 126% |

---

## 4. Appendix B: authorisation check output

Command: `npm run check:authz`, run against the dev server and the freshly seeded database. Exit code 0. ANSI colour codes have been stripped.

```text
> final-project@0.1.0 check:authz
> bash scripts/authz-check.sh


Cadence — role-based access control checks
Base: http://localhost:3000

1. Unauthenticated requests are refused
  PASS no token → /api/projects                                 401
  PASS no token → /api/dashboard                                401
  PASS no token → /api/developers                               401
  PASS garbage token → /api/me                                  401

2. Manager retains full access (regression check)
  PASS manager → developers roster                              200
  PASS manager → team accuracy                                  200
  PASS manager → forecast evaluation                            200
  PASS manager → admin users                                    200
  PASS manager sees all projects                                  3 rows

3. Developer is confined to their own work
  PASS developer → developers roster                            403
  PASS developer → team accuracy                                403
  PASS developer → forecast evaluation                          403
  PASS developer → activity ingest                              403
  PASS developer → admin users                                  403
  PASS developer → sprint with no own work                      403
  PASS developer → sprint forecast                              403
  PASS developer → create task                                  403
  PASS developer → delete own task                              403
  PASS developer → update peer's task                           403
  PASS developer → reassign own task                            403
  PASS developer → set own task status                          200
  PASS developer sees 0 tasks in a sprint they're not on          0 rows

4. Unlinked developer account is denied by default
  PASS unlinked → tasks                                         403
  PASS unlinked → sprints                                       403
  PASS unlinked → own identity                                  200

5. Client is confined to granted projects
  PASS client → developers roster                               403
  PASS client → team accuracy                                   403
  PASS client → forecast evaluation                             403
  PASS client → unassigned project                              403
  PASS client → unassigned velocity                             403
  PASS client → granted project                                 200
  PASS client → create task                                     403
  PASS client → delete granted project                          403
  PASS client → capacity simulation                             403
  PASS client sees only granted projects                          1 rows

6. Client with no grants sees nothing (deny by default)
  PASS no-grant client → projects                               0 rows
  PASS no-grant client → sprints                                0 rows
  PASS no-grant client → tasks                                  0 rows

7. No per-developer data in any client-facing response
  PASS client /api/dashboard                                      clean
  PASS client /api/projects                                       clean
  PASS client /api/projects/[id]                                  clean
  PASS client /api/projects/[id]/velocity                         clean
  PASS client /api/sprints                                        clean
  PASS client /api/sprints/[id]                                   clean
  PASS client /api/sprints/[id]/capacity                          clean
  PASS client /api/sprints/[id]/forecast                          clean
  PASS client /api/tasks                                          clean
  PASS client /api/portfolio/[id]                                 clean

─────────────────────────────────────────────
  48 passed, 0 failed

Note: run `npm run db:seed` to reset the task status this script changed.
```

One check (a developer updating the status of their own task) changes one task in the database. The demo database was reseeded straight afterwards, as the script's closing note advises.

---

## 5. Appendix C: test results

Source: `docs/test-report.md`, generated 2026-10-02. The per-test durations (ms) differ slightly from run to run.

### tests/unit/capacity-chain.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| capacity chain — handbook worked example (Angelo in Sprint 1) › reproduces 40h/wk − 12h meetings × 2 weeks = 56h nominal capacity | pass | 1 |
| capacity chain — handbook worked example (Angelo in Sprint 1) › reduces 56h to 22.4h effective through buffer ×0.8 and multi-project ×0.5 | pass | 0 |
| capacity chain — handbook worked example (Angelo in Sprint 1) › flags 36 assigned hours against 22.4h effective as 161% utilisation and overloaded | pass | 0 |
| capacity chain — handbook worked example (Angelo in Sprint 1) › reads the same 36 hours as under half-loaded against nominal capacity | pass | 0 |
| buildCapacityAnalysis — the one chain every capacity path uses › reproduces the worked example end to end: 56h → 22.4h effective, 161%, overloaded | pass | 1 |
| buildCapacityAnalysis — the one chain every capacity path uses › clamps net capacity to zero when meetings exceed weekly hours | pass | 0 |
| capacity chain — edges › keeps the full capacity when the buffer is 0 | pass | 0 |
| capacity chain — edges › keeps 60% of capacity at the maximum 0.4 buffer | pass | 0 |
| capacity chain — edges › reports 100% utilisation, not a division error, when effective capacity is zero but work is assigned | pass | 0 |
| capacity chain — edges › does not flag a developer sitting exactly at effective capacity | pass | 0 |
| capacity chain — edges › sums assigned hours across a task list | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › adds the hypothetical hours to assigned work and recomputes utilisation | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › reports wouldCauseOverload only when the addition crosses the line | pass | 0 |
| ad-hoc simulation — pure before/after arithmetic › leaves the before snapshot untouched | pass | 0 |

### tests/unit/estimation-accuracy.test.ts ✅

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

### tests/unit/sprint-forecast-signals.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps zero raw points to exactly 0% probability | pass | 1 |
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps 48 raw points to 70% (the live Sprint 1 figure) | pass | 0 |
| exponential squish — probability = 100 × (1 − e^(−raw/40)) › maps 40 raw points to 63% and saturates gracefully at high raw scores | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 0 percent as low | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 24 percent as low | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 25 percent as moderate | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 49 percent as moderate | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 50 percent as high | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 74 percent as high | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 75 percent as critical | pass | 0 |
| risk bands at 25 / 50 / 75 › classifies 100 percent as critical | pass | 0 |
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

### tests/unit/redact.test.ts ✅

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
| delivery confidence — band only, never the probability › labels the moderate band as On track - minor risk | pass | 0 |
| delivery confidence — band only, never the probability › labels the high band as Delivery at risk | pass | 0 |
| delivery confidence — band only, never the probability › labels the critical band as Delivery at significant risk | pass | 0 |
| developer task-update field allow-list › permits exactly status, actualHours and completedAt | pass | 0 |
| developer task-update field allow-list › rejects an attempt to reassign a task to a peer | pass | 0 |
| developer task-update field allow-list › rejects estimate tampering and any unknown field | pass | 0 |
| personal capacity narrowing › returns only the requested developer's analysis | pass | 0 |
| personal capacity narrowing › returns null rather than falling back to the full list when the developer has no work | pass | 0 |

### tests/integration/capacity-records.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| capacity engine against the seeded database › reproduces the handbook worked example end to end: Angelo at 22.4h effective and 161% in Sprint 1 | pass | 258 |
| capacity engine against the seeded database › includes paused tasks in assigned hours — pausing does not release capacity | pass | 19 |
| capacity engine against the seeded database › excludes done tasks from assigned hours — a fully completed sprint shows zero active load | pass | 17 |
| capacity engine against the seeded database › upserts exactly one CapacityRecord per (developer, sprint) and stays idempotent across recomputes | pass | 21 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › computes an asOf-anchored forecast without writing a single CapacityRecord | pass | 38 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › treats tasks completed after asOf as still pending — nothing is 'done' at sprint start | pass | 31 |
| retroactive forecasting never rewrites history (handbook §4 leakage rules) › computes burndown for the client path with zero database writes | pass | 2 |
| meeting-hours clamp on a scratch fixture › clamps net capacity to zero when meeting hours exceed weekly hours, and still reports meaningfully | pass | 3 |

### tests/integration/forecast-evaluation.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| retroactive forecast evaluation on the four seeded historic sprints › classifies the four historic sprints as low/met, moderate/met, high/partial and high/missed | pass | 175 |
| retroactive forecast evaluation on the four seeded historic sprints › reports 2 correct alarms, 0 false alarms and 0 missed alarms (100% alarm precision) | pass | 41 |
| retroactive forecast evaluation on the four seeded historic sprints › orders evaluations chronologically and names a top contributor for each | pass | 39 |

### tests/integration/register-role.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| registration endpoint — role pinned server-side › creates a developer even when the request body claims to be a manager | pass | 179 |
| registration endpoint — role pinned server-side › leaves the new account unlinked to any developer profile (fail-closed until a manager links it) | pass | 7 |
| registration endpoint — role pinned server-side › rejects a duplicate email with 409 | pass | 2 |
| registration endpoint — role pinned server-side › rejects a submission missing required fields with 400 | pass | 0 |

### tests/integration/simulator-rebalancing.int.test.ts ✅

| Test | Result | ms |
|---|---|---:|
| ad-hoc simulator against the seeded database › adds hypothetical hours to the developer's live analysis and reconciles with the chain | pass | 131 |
| ad-hoc simulator against the seeded database › is a pure what-if — no task row is ever created | pass | 31 |
| ad-hoc simulator against the seeded database › judges a developer not yet on the sprint against the full capacity chain | pass | 27 |
| rebalancing suggestions against the overloaded seeded sprint › emits at most one suggestion per overloaded developer, each reconciling with the capacity chain | pass | 18 |

### Remaining test files

- tests/unit/burndown.test.ts: 7 tests, all passing
- tests/unit/multi-project-capacity.test.ts: 11 tests, all passing
- tests/unit/rebalancing.test.ts: 7 tests, all passing
- tests/unit/roles.test.ts: 7 tests, all passing
- tests/unit/sprint-health.test.ts: 8 tests, all passing
- tests/unit/task-statuses.test.ts: 4 tests, all passing

### Coverage (src/services + src/lib)

| | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| **Total** | 74.05% | 61.44% | 69.86% | 76.8% |
| src/lib/auth.ts | 20% | 16.66% | 33.33% | 21.42% |
| src/lib/authorize.ts | 0% | 0% | 0% | 0% |
| src/lib/redact.ts | 100% | 60% | 100% | 100% |
| src/lib/roles.ts | 100% | 100% | 100% | 100% |
| src/lib/route-access.ts | 0% | 0% | 0% | 0% |
| src/lib/task-statuses.ts | 100% | 50% | 100% | 100% |
| src/services/capacity.service.ts | 78.57% | 66.66% | 66.66% | 90.9% |
| src/services/developer.service.ts | 0% | 100% | 0% | 0% |
| src/services/estimation-accuracy.service.ts | 97.14% | 93.33% | 100% | 100% |
| src/services/forecast-evaluation.service.ts | 88.88% | 80% | 100% | 93.54% |
| src/services/multi-project-capacity.service.ts | 100% | 100% | 100% | 100% |
| src/services/overload-detection.ts | 96.93% | 93.22% | 100% | 98.78% |
| src/services/project.service.ts | 0% | 0% | 0% | 0% |
| src/services/rebalancing.service.ts | 100% | 77.27% | 100% | 100% |
| src/services/sprint-forecast.service.ts | 90.81% | 77.86% | 100% | 96.68% |
| src/services/sprint.service.ts | 18.75% | 3.57% | 16.66% | 23.07% |
| src/services/task.service.ts | 0% | 0% | 0% | 0% |

Coverage is scoped to the analytical core (`src/services/**`, `src/lib/**`); React components and API route handlers are exercised by the authz suite and manual browser verification rather than unit coverage.

---

## 6. Appendix D: demo seed (`prisma/seed.ts`)

### (a) Developers

The accuracy factors quoted below come from `GET /api/developers/accuracy` after reseeding. The seed sets each persona's target factor per historic sprint (`factorByHistoricIndex`) and adds per-task noise.

| Developer | Weekly capacity (h) | Meetings (h/week) | Scenario role |
|---|---:|---:|---|
| Angelo Perera | 40 | 12 | **Overloaded team lead.** Chronic under-estimator: historic targets of 1.22 to 1.30 give ×1.28 (n = 15, high confidence). Shared across two concurrent sprints (Sprint 1 and Sprint 3), giving a multi-project factor of ×0.5. Heaviest meeting load. Headline case: 36h assigned against 22.4h effective is 161% (206% after the accuracy adjustment). |
| Nomal Ariyarathna | 35 | 6 | **Accurate estimator** and the control persona: ×1.02 (n = 13, medium confidence). Shared across all three current sprints: allocation 1/3 × context-switch 0.8 = ×0.267. In Sprint 1, 16h against 12.4h effective is 129%. |
| Kusalni Perera | 30 | 4 | **Over-estimator ("sandbagger"):** ×0.81 (n = 14, medium confidence). On one sprint only, so keeps full capacity (×1.0). At 84% utilisation, Kusalni has headroom and is the rebalancing recipient in Sprint 1. |
| Abdulaziz Roshan | 25 | 8 | **New hire and low-sample case.** Active only in the most recent historic sprint, with one completed task: ×1.01 (n = 1, low confidence). Shrinkage pulls the factor towards 1.0. Carries an onboarding meeting load and is on Sprint 2 only. |
| Saajid Jiffrey | 35 | 5 | **Improving estimator.** Historic targets go 1.30 → 1.20 → 1.10 → 1.05, giving ×1.16 (n = 12, medium confidence, trend "improving"). Shared across Sprint 1 and Sprint 2 (×0.5). In Sprint 1, 26h against 24h effective is 108%. |

### (b) Sprint 1 · PDP experience (NOYZ Storefront): tasks at seed time

| Task | Estimated (h) | Priority | Type | Assignee | Status at seed time |
|---|---:|---|---|---|---|
| PDP FAQ module | 10 | high | planned | Angelo Perera | In Progress |
| Collection page one-card module | 12 | high | planned | Angelo Perera | To Do |
| Mini cart UX improvements | 6 | medium | planned | Angelo Perera | Backlog |
| Urgent: PDP hero video not playing | 8 | critical | adhoc | Angelo Perera | Paused |
| Checkout upsells (Checkout Extensibility) | 8 | high | planned | Nomal Ariyarathna | QA |
| Launchpad scheduled product drops | 8 | high | planned | Nomal Ariyarathna | To Do |
| Mobile collection page hover states | 20 | medium | planned | Kusalni Perera | UAT |
| Storefront search relevance tuning | 15 | medium | planned | Kusalni Perera | Ready for Prod |
| Homepage video module | 14 | low | planned | Saajid Jiffrey | To Do |
| Student discount integration | 12 | low | planned | Saajid Jiffrey | Backlog |
| **Total: 10 tasks** | **113** | | 9 planned, 1 ad-hoc | Angelo 36 · Nomal 16 · Kusalni 35 · Saajid 26 | 0 done |

Statuses are shown with their UI labels. The values stored in the database are `inprogress`, `todo`, `backlog`, `paused`, `qa`, `uat` and `readyforprod`.

**Date span and buffer:** the sprint starts 5 days before the day the seed runs and ends 9 days after it, a 14-day (2-week) sprint. On this run that is 2026-09-27 to 2026-10-11. The capacity buffer is 0.2 (20%).
