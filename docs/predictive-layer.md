# Predictive Layer — Design Notes

**Module:** CS6P05NM Final Year Project · London Metropolitan University
**Author:** Vithanage Angelo Prabajith Perera (25024547)
**Date:** 2026-04-24

This document records the rationale behind the predictive layer added to the capacity-aware sprint planner. It is companion evidence to the interim report and the final write-up — the design choices documented here are defensible in viva without re-deriving them from the code.

## Why this layer exists

The interim report renamed the project from *"Sprint & Capacity Management Software"* to *"Capacity-Aware Sprint Planning System with **Predictive** Overload Detection"* on supervisor recommendation, in order to introduce "predictive and analytical elements that enhance academic and technical depth." At the time of the interim, however, the codebase implemented only real-time detection — `computeSprintCapacity`, `computeSprintHealth`, and `computeBurndown` all evaluate the *current* state of a sprint, not a forecast.

The predictive layer closes that gap. It introduces:

1. A per-developer **estimation-accuracy factor** learned from completed tasks over a rolling 90-day window, with Bayesian shrinkage for small samples.
2. A per-sprint **failure-probability forecast** built from a weighted five-signal model and mapped through an exponential squish function into a 0–100% probability with a `low / moderate / high / critical` band.
3. An abstraction (`DeveloperActivity`) that accepts either seeded mock data (today) or live GitHub activity (planned Phase 2) without any downstream change.

The layer is positioned not as a replacement for sprint-planning tools such as Jira or Tempo, but as a **capacity-intelligence layer** that augments them with predictive signals grounded in developer behaviour — a framing the literature review supports (Cohn 2005; Ghimire & Charters 2022; Marchwicka & Marchwicki 2023) and that differentiates the work from commercial offerings.

## Design decision 1: Bayesian shrinkage for the accuracy factor

**Problem.** If a new hire has completed one task and overshot by 50%, their raw factor is 1.5. Applying that naively to future capacity would shrink their usable capacity by a third — a harsh penalty from a single data point.

**Choice.** Pseudo-count shrinkage toward 1.0. With `n` samples, `avg = sum(estimated) / n`, and a target pseudo-sample size of 10:

```
k = max(0, 10 − n)
factor = (sumActual + k × avg) / (sumEstimated + k × avg)
```

At `n = 10+` the formula degenerates to `sumActual / sumEstimated` — the true historical ratio. At `n = 1`, the formula mixes 9 parts "no prior evidence" (ratio 1.0) with 1 part observed, producing a factor very close to 1.0. Pulling toward 1.0 is the principled prior because the population-level expectation is that estimates track reality.

**Alternatives considered.**
- Linear ramp `factor = lerp(1.0, rawFactor, min(n / 10, 1))` is simpler but discards the continuous nature of uncertainty.
- Bayesian posterior with a full beta/gamma prior is overkill for a sprint-planning demo and harder to explain in viva.
- Giving up and applying `factor` directly at any `n` is tempting but produces exactly the cold-start problem the shrinkage prevents.

Pseudo-count shrinkage is the middle ground: academically defensible, easy to explain, and has a clear tuning parameter (`SHRINKAGE_TARGET_N`) that a reviewer can interrogate.

**Confidence bands.** `n < 5` → `low`, `n < 15` → `medium`, else `high`. These map to UI decisions — chip hidden for `low`, shown with neutral tone for `medium`, shown with coloured tone if `|factor − 1| ≥ 0.15` for `high`.

**Trend detection.** When `n ≥ 8`, the window is split in half by `completedAt`; the factor is recomputed on each half; a change in distance-from-1.0 greater than 0.05 is labelled `improving` (later half closer to 1) or `degrading`. Only surfaced when the sample supports it.

## Design decision 2: a weighted signal model for the sprint forecast

**Problem.** A single "is it overloaded?" boolean is insufficient. A sprint can be within capacity but facing high ad-hoc pressure, a flaky velocity trend, or not enough days left to finish remaining work. The forecast should capture all of these in a single explainable number.

**Choice.** Five independent signals, each mapped to a piecewise point function, summed, then squashed into a probability.

| Signal | Max pts | Function (informal) |
|---|---:|---|
| Team utilisation (factor-adjusted) | 40 | 0 pts below 80%, ramp to 25 at 100%, linear to 40 at 120%+ |
| Ad-hoc history | 20 | Stepwise on fraction of past 2 sprints that were ad-hoc |
| Velocity trend | 15 | Stepwise on 3-sprint completion rate; <70% → 15, >95% → 0 |
| Days remaining gap | 15 | Non-zero only when remaining hours exceed remaining days × team daily capacity |
| Estimation accuracy | 10 | Asymmetric: under-estimators (factor > 1) penalised more than over-estimators |

**Weighting rationale.** Utilisation dominates because overload in the present is the strongest signal of failure. Ad-hoc history comes next because the literature consistently names unplanned work as the primary disruption to sprint predictability. Velocity and days-remaining are second-tier — informative but indirect. Estimation accuracy is the smallest contributor on its own because it already feeds utilisation via the factor (so it's partly already accounted for); the standalone 10 points capture team-wide bias that utilisation doesn't see.

**Squish.** Raw points in `[0, 100]` are transformed via:

```
probability = 100 × (1 − exp(−raw / 40))
```

This choice matters:
- `raw = 0 → probability = 0%`. A pristine sprint should not read "50% likely to fail."
- `raw = 40 → 63%` — a sprint where any single domain is fully bad already looks high risk.
- Saturates gracefully around `raw ≥ 80`, avoiding "more than 100%" weirdness if the point functions are tightened later.

**Alternative considered.** Standard logistic `1 / (1 + exp(−(raw − 50) / 10))`. Sits at 50% when `raw = 0`, which is wrong for an empty sprint. The exponential squish has the correct behaviour at the zero boundary without requiring an intercept correction.

**Bands.** `<25` low, `<50` moderate, `<75` high, else critical. Band thresholds were chosen so seeded demo data consistently produces "high" for the engineered-overload sprint and "low" for the healthy sprint — a sanity check rather than a post-hoc calibration.

**Explainability.** Every forecast is accompanied by a contributor list with `{ label, points, maxPoints, detail }`. The UI renders these as progress bars with plain-English detail strings, so the forecast is inspectable, not black-box. This matters in a research context where the model must be defensible.

## Design decision 3: a shared activity table for seed and future GitHub data

**Problem.** For the artefact demo we need the system to look populated and the concept to be visible. For Phase 2 we want a path to ingest real GitHub activity. Two separate paths would mean rewriting downstream consumers when we switch.

**Choice.** One `DeveloperActivity` table with a `source` column (`"seed" | "github" | "mock"`) and an optional `externalRef` for dedup. An upsert keyed on `(source, externalRef)` makes webhook ingestion idempotent. Seed writes `source = "seed"` with `externalRef = null`; Phase 2 writes `source = "github"` with the GitHub event ID as `externalRef`.

Daily aggregation (one row per developer per day) rather than per-event is deliberate — the analytics only need daily commit / PR / review counts, and per-day rows keep seed small (≤ 5 × 90 = 450 rows per reseed) and queries cheap.

## Why not ML?

Several sections could be replaced with a learned model — logistic regression on sprint features, even a small neural net. This was considered and declined for three reasons:

1. **Defensibility.** The five-signal model is inspectable and interrogable. A reviewer can ask "why 40 points for utilisation?" and get a principled answer. A learned model invites "why did the model predict that?" with no ground-truth labels to verify the answer against.
2. **Sample size.** A final-year project produces a handful of seeded sprints and a handful of real ones if someone uses the tool. That is nowhere near enough to train even a small classifier without severe overfitting.
3. **Comparative framing.** The write-up has a clear comparison: "Jira reports on what happened; this system predicts what will happen via five explicit signals including per-developer estimation history, context no commercial tool uses." That narrative holds with a transparent weighted model and would be weakened by a black-box classifier.

A future revision — post-thesis, with actual operational data — could fit a logistic regression over the same five features and compare the empirical weights against the hand-chosen ones as an evaluation artefact.

## Fallback and compatibility rules

- `applyAccuracyToCapacity(cap, factor)` returns `cap` unchanged whenever `factor <= 0`. This ensures a missing or zero factor *never* breaks the existing capacity engine.
- Adjusted utilisation is computed separately from raw utilisation and shown alongside, not instead of, the original number. Existing charts, dashboards, and the health-score engine continue to use the raw numbers.
- The actual-hours prompt has a `Skip` button. Declining it is never a failure mode — the task is marked done without `actualHours`, and the accuracy service filters those rows out of its window. Users who never engage with the prompt keep a functioning forecast (it just loses one signal).

## What this layer does NOT do yet

These are deliberate Phase 2 items, not oversights:

- **Live GitHub ingestion.** The abstraction is in place; the live client is not.
- **Cross-sprint allocation.** A developer on two concurrent sprints still appears as having full capacity in each. This is the next-highest-value predictive feature by academic upside and is called out in `CLAUDE.md`.
- **Context-switch penalty.** Literature supports ~20% loss per additional concurrent project. Not yet modelled.
- **Forecast caching.** Every sprint page load recomputes. Fine at demo scale; would cache on `CapacityRecord` or in-memory in production.
- **Evaluation page.** Comparing forecast predictions against sprint outcomes is deferred until the demo produces enough concluded sprints to compare.

## Multi-project extension (added 2026-05-08)

Three additions modify the effective-capacity formula. Order of multipliers, applied left-to-right:

```
netWeeklyHours = max(0, weeklyCapacityHours − meetingHoursPerWeek)
capacityHours = netWeeklyHours × sprintWeeks
effective     = capacityHours × (1 − capacityBuffer) × multiProjectFactor
```

`multiProjectFactor = allocationFactor × contextSwitchFactor`.

### Allocation factor

A developer assigned to N other concurrent sprints has each sprint's nominal capacity scaled by `1 / (N + 1)` — equal split across the sprints they share. Floored at 0.25 so a developer on five concurrent projects is not modelled as having effectively zero capacity per sprint.

Why equal split rather than weighted by assigned hours: the weighted version is *circular* — assigned hours depend on the capacity, which depends on the allocation. Equal split is the simpler, monotonic, defensible choice.

### Context-switch factor

`1 − 0.20 × max(0, N − 1)`, floored at 0.5. Two concurrent sprints incur no penalty (one extra context is the baseline), three concurrent sprints incur 20%, four 40%, five floored at 50%.

The 20%-per-extra-context number is industry rule-of-thumb (Cohn's *Agile Estimating and Planning*, Sutherland's *Scrum*, Weinberg's classic on context-switching). It is not formally derived from a meta-analysis; we acknowledge this in the writeup as a literature-supported heuristic.

### Meeting load

`Developer.meetingHoursPerWeek` (default 0) is subtracted from `weeklyCapacityHours` *before* the buffer multiplier — so meetings are not double-discounted by the buffer. Phase 2 will replace this static field with live Google Calendar OAuth fetching per-week meeting hours; the engine integration point doesn't change.

### Why these aren't double-counted

A reviewer might worry that buffer + meetings + multi-project + accuracy stack up to penalise the same dev four times. They model genuinely different phenomena:

- **Buffer** — global planning slack against unknowns
- **Meetings** — time literally consumed by non-coding obligations
- **Multi-project factor** — capacity diluted by competing commitments
- **Accuracy factor** — systematic estimation bias

A team of developers who don't have meetings, work on one sprint, and estimate accurately would see all four multipliers settle to ≈1.0 and only the buffer would apply. The seed exposes the pathological case (Angelo — heavy meetings, three concurrent sprints, chronic under-estimator) precisely to show how the multipliers compose.

## References used in framing

- Cohn, M. (2005) *Agile Estimating and Planning.* Pearson Education.
- Ghimire, D. & Charters, S. (2022) 'The impact of Agile development practices on project outcomes', *Software* 1(3), 188–205.
- Marchwicka, E. & Marchwicki, T. (2023) *Adaptive Sprint Planning Based on Risk Management.* SSRN.
- Nazir, S. et al. (2022) 'Adapting agile development practices for hyper-agile environments', *Information Technology and Management* 23, 315–330.
- Zander, M.O. & Meboldt, M. (2024) 'Navigating the unknown…', SEFI Conference Proceedings.
