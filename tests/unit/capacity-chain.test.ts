import { describe, expect, it } from "vitest";
import {
  calculateCapacity,
  calculateAssignedHours,
  detectOverload,
  getOverloadPercentage,
  simulateTaskAddition,
} from "@/services/overload-detection";
import {
  computeAllocationFactor,
  computeContextSwitchFactor,
} from "@/services/multi-project-capacity.service";
import type { CapacityAnalysis } from "@/types";

/**
 * The capacity chain (handbook §3):
 *   net = max(0, weekly − meetings)
 *   capacity = net × sprintWeeks
 *   effective = capacity × (1 − buffer) × allocation × contextSwitch
 * These tests compose the chain from the engine's own exported steps; the
 * end-to-end chain including the inline clamp and rounding is asserted against
 * the seeded database in tests/integration/capacity-records.int.test.ts.
 */
describe("capacity chain — handbook worked example (Angelo in Sprint 1)", () => {
  const weekly = 40;
  const meetings = 12;
  const sprintWeeks = 2;
  const buffer = 0.2;
  const otherConcurrentSprints = 1;

  it("reproduces 40h/wk − 12h meetings × 2 weeks = 56h nominal capacity", () => {
    const net = Math.max(0, weekly - meetings);
    expect(calculateCapacity(net, sprintWeeks)).toBe(56);
  });

  it("reduces 56h to 22.4h effective through buffer ×0.8 and multi-project ×0.5", () => {
    const capacity = calculateCapacity(Math.max(0, weekly - meetings), sprintWeeks);
    const multi =
      computeAllocationFactor(otherConcurrentSprints) *
      computeContextSwitchFactor(otherConcurrentSprints); // 0.5 × 1.0
    const effective = Math.round(capacity * (1 - buffer) * multi * 10) / 10;
    expect(effective).toBe(22.4);
  });

  it("flags 90 assigned hours against 22.4h effective as 402% utilisation and overloaded", () => {
    expect(getOverloadPercentage(90, 22.4)).toBe(402);
    expect(detectOverload(90, 22.4)).toBe(true);
  });
});

describe("capacity chain — edges", () => {
  it("keeps the full capacity when the buffer is 0", () => {
    const effective = calculateCapacity(30, 2) * (1 - 0) * 1;
    expect(effective).toBe(60);
  });

  it("keeps 60% of capacity at the maximum 0.4 buffer", () => {
    const effective = calculateCapacity(30, 2) * (1 - 0.4) * 1;
    expect(effective).toBeCloseTo(36, 10);
  });

  it("reports 100% utilisation, not a division error, when effective capacity is zero but work is assigned", () => {
    // Handbook §3: meetings exceeding weekly hours clamp net capacity to 0;
    // the percentage must stay meaningful rather than dividing by zero.
    expect(getOverloadPercentage(5, 0)).toBe(100);
    expect(getOverloadPercentage(0, 0)).toBe(0);
  });

  it("does not flag a developer sitting exactly at effective capacity", () => {
    expect(detectOverload(22.4, 22.4)).toBe(false);
    expect(detectOverload(22.5, 22.4)).toBe(true);
  });

  it("sums assigned hours across a task list", () => {
    expect(
      calculateAssignedHours([{ estimatedHours: 20 }, { estimatedHours: 30 }, { estimatedHours: 25 }, { estimatedHours: 15 }])
    ).toBe(90);
    expect(calculateAssignedHours([])).toBe(0);
  });
});

describe("ad-hoc simulation — pure before/after arithmetic", () => {
  const before: CapacityAnalysis = {
    developerId: "d1",
    developerName: "Nomal Ariyarathna",
    assignedHours: 20,
    completedHours: 0,
    capacityHours: 58,
    effectiveCapacityHours: 46.4,
    utilizationPercent: 43,
    overloadRisk: false,
  };

  it("adds the hypothetical hours to assigned work and recomputes utilisation", () => {
    const result = simulateTaskAddition(before, 10);
    expect(result.after.assignedHours).toBe(30);
    expect(result.after.utilizationPercent).toBe(Math.round((30 / 46.4) * 100));
    expect(result.wouldCauseOverload).toBe(false);
  });

  it("reports wouldCauseOverload only when the addition crosses the line", () => {
    const tips = simulateTaskAddition(before, 27); // 47 > 46.4
    expect(tips.after.overloadRisk).toBe(true);
    expect(tips.wouldCauseOverload).toBe(true);

    const alreadyOver = simulateTaskAddition(
      { ...before, assignedHours: 50, overloadRisk: true },
      5
    );
    // Already overloaded before the addition → the addition is not the cause.
    expect(alreadyOver.wouldCauseOverload).toBe(false);
  });

  it("leaves the before snapshot untouched", () => {
    simulateTaskAddition(before, 10);
    expect(before.assignedHours).toBe(20);
  });
});
