# Forecast Evaluation — Methodology

**Module:** CS6P05NM Final Year Project · London Metropolitan University
**Author:** Vithanage Angelo Prabajith Perera (25024547)
**Date:** 2026-05-08

This document records the evaluation methodology for Cadence's sprint-failure-probability forecast. It accompanies [docs/predictive-layer.md](predictive-layer.md), which defines the model itself.

## What we measure

For every completed sprint in the system, we ask: *given only the data that existed at this sprint's start, what would the forecast have predicted, and how does that compare to the actual outcome?*

This is implemented in [src/services/forecast-evaluation.service.ts](../src/services/forecast-evaluation.service.ts) and exposed at `/evaluation`.

## Why retroactive recomputation, not stored predictions

Two viable approaches exist:

1. **Persist forecasts** at sprint creation time and compare them against eventual outcomes.
2. **Recompute forecasts retroactively** for completed sprints, filtering all input data by an `asOf` date set to the sprint's start.

We chose (2) for three reasons:

- **No leakage by construction.** The retroactive computation can only use data that existed before the sprint started; the implementation enforces this by filtering by `completedAt < asOf` in the accuracy service and `endDate < asOf` in the velocity / ad-hoc lookups. With persisted predictions, a bug in the original computation would corrupt the entire history.
- **Reproducibility.** A reviewer (or future-me) can change a model parameter and rerun the entire evaluation in one request. With persisted predictions, every model change requires waiting for new sprints to complete.
- **No new schema needed.** Persisting predictions would mean a `ForecastSnapshot` table and write-on-create logic in the sprint service. Retroactive recomputation needs only a single `asOf?: Date` parameter on the existing forecast service.

The trade-off is small additional compute per evaluation request. At demo scale (4-10 historic sprints) this is negligible.

## What "asOf" actually filters

The `asOf` parameter (defaults to `new Date()` for live forecasts) flows through:

- **`computeAllAccuracies({ asOf })`** — accuracy samples filtered to `completedAt >= asOf − 90d AND completedAt < asOf`.
- **`buildCapacityAnalyses(sprintId, asOf)`** — a new local function in `sprint-forecast.service.ts` that mirrors `computeSprintCapacity` but treats a task as "done" only if `status === "done" AND completedAt < asOf`. Crucially, it skips the `CapacityRecord` upsert so retroactive evaluation never mutates production history.
- **`velocityTrendPoints(projectId, sprintId, asOf)`** — past-sprint lookup filtered to `endDate < asOf`.
- **`adhocHistoryPoints(projectId, sprintId, asOf)`** — same filter as velocity.
- **`daysRemainingPoints(sprint, tasks, teamWeeklyHours, asOf)`** — uses `asOf` as the "now" anchor; tasks completed after `asOf` are treated as still pending.

The multi-project factor is computed against current sprint dates because sprint dates are stable once created. (A retroactive evaluation against a later-deleted sprint would not see it, which is the desired behaviour.)

## Outcome classification

Each completed sprint is graded by its actual completion rate at the end:

```
actualCompletionRate = sum(estimatedHours WHERE status = "done") / sum(all estimatedHours)
```

Banding:

| Outcome | Threshold | Interpretation |
|---|---|---|
| `met` | `≥ 90%` | Sprint commitment substantially achieved |
| `partial` | `70%–90%` | Sprint slipped but most work shipped |
| `missed` | `< 70%` | Sprint commitment not honoured |

The 90/70 thresholds are project-defined and worth defending on the day — they're calibrated against typical agile retrospective language ("met / nearly met / missed") rather than scientifically derived.

## Calibration metrics

The evaluation summary returns four counts:

- **Hits** — sprints where the forecast predicted high or critical risk AND the outcome was partial or missed. *Correct alarms.*
- **False alarms** — sprints where the forecast predicted high or critical risk AND the outcome was met. *Cried wolf.*
- **Missed alarms** — sprints where the forecast predicted low or moderate risk AND the outcome was missed. *Slept through the fire.*
- **Total** — total evaluated sprints.

A reviewer who wants a single number can take **alarm precision** = `hits / (hits + false alarms)` (zero-handled), shown in the page header.

We deliberately avoid presenting a single accuracy number — the asymmetric cost of false alarms vs. missed alarms is a methodology discussion in its own right (calibration vs. discrimination, ROC curves, etc.). The four-counter view forces the reviewer to engage with the trade-off rather than reduce it to one digit.

## How to read the chart

`/evaluation` shows a `ComposedChart`:

- **X-axis:** sprint name in chronological order.
- **Y-axis (left):** *predicted failure %*. Bar series.
- **Y-axis (right):** *actual completion %*. Line series.

A well-calibrated forecast looks like an inverse correlation: when the bar is high, the line is low. The seed produces this shape — Sprint 0 has the highest predicted failure (≈65%) and the lowest actual completion (≈66%, classified missed); Sprint -3 has the lowest predicted failure (≈0%) and the highest actual completion (100%, met).

## Limitations and "Future Work" framing

- **Sample size.** The seed produces 4 historic sprints. Real validation requires 20+ sprints per project to be statistically meaningful. This is a Phase 2 evaluation extension, not a defect.
- **Outcome classification is binary-ish.** Met/partial/missed loses information. A future revision could use the raw completion rate as a continuous target and report mean absolute error against the predicted probability.
- **Static thresholds.** The 90/70 banding is hand-set. A future evaluation could fit thresholds to maximise alarm precision for a given recall, treating the model as a binary classifier.
- **No confidence intervals on individual predictions.** Each retroactive forecast is a point estimate. Bootstrapping the input samples could give per-prediction uncertainty bands; deferred.
- **Project-specific calibration.** All four signals share weights across projects. If two projects have very different ad-hoc volume profiles, a per-project calibration would be more honest. Out of scope this round.

## Links

- Live page: `/evaluation` (sidebar entry "Forecast Evaluation").
- API: `GET /api/evaluation/forecast`.
- Type: `ForecastEvaluationSummary` in [src/types/index.ts](../src/types/index.ts).
- Implementation: [src/services/forecast-evaluation.service.ts](../src/services/forecast-evaluation.service.ts).
- Underlying model: [docs/predictive-layer.md](predictive-layer.md).
