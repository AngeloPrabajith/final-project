import { describe, expect, it } from "vitest";
import { evaluateAllCompletedSprints } from "@/services/forecast-evaluation.service";

/**
 * The dissertation's headline evaluation artefact (handbook §4): every
 * completed sprint re-forecast using only data that existed at its start,
 * compared against what actually happened. The seed engineers one clean
 * success, one moderate near-miss, one partial and one miss — the assertions
 * pin the calibration story the report presents.
 */
describe("retroactive forecast evaluation on the four historic NOYZ sprints", () => {
  it("classifies the four historic sprints as low/met, moderate/met, high/partial and high/missed", async () => {
    const summary = await evaluateAllCompletedSprints();

    const byName = new Map(
      summary.evaluations.map((e) => [e.sprintName, e])
    );
    expect(summary.evaluations).toHaveLength(4);

    const expectations: Array<[string, string, string]> = [
      ["Sprint -3 · Site speed foundations", "low", "met"],
      ["Sprint -2 · ADA remediation wave 1", "moderate", "met"],
      ["Sprint -1 · Checkout & promotions", "high", "partial"],
      ["Sprint 0 · Performance hardening", "high", "missed"],
    ];
    for (const [name, band, outcome] of expectations) {
      const row = byName.get(name);
      expect(row, `missing evaluation for ${name}`).toBeDefined();
      expect(row!.predictedBand, `${name} band`).toBe(band);
      expect(row!.outcome, `${name} outcome`).toBe(outcome);
    }
  });

  it("reports 2 correct alarms, 0 false alarms and 0 missed alarms (100% alarm precision)", async () => {
    const summary = await evaluateAllCompletedSprints();
    expect(summary.hitCount).toBe(2);
    expect(summary.falseAlarmCount).toBe(0);
    expect(summary.missedAlarmCount).toBe(0);
    expect(summary.totalSprints).toBe(4);
  });

  it("orders evaluations chronologically and names a top contributor for each", async () => {
    const summary = await evaluateAllCompletedSprints();
    const starts = summary.evaluations.map((e) => new Date(e.startDate).getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (const e of summary.evaluations) {
      expect(e.topContributor.label.length).toBeGreaterThan(0);
    }
  });
});
