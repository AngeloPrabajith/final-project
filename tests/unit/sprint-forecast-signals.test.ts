import { beforeEach, describe, expect, it, vi } from "vitest";

// velocityTrendPoints / adhocHistoryPoints query past sprints; everything else
// under test is pure. The mock lets each signal run unmodified on crafted rows.
vi.mock("@/lib/prisma", () => ({
  prisma: { sprint: { findMany: vi.fn(), findUnique: vi.fn() }, developer: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  adhocHistoryPoints,
  daysRemainingPoints,
  estimationAccuracyPoints,
  getRiskBand,
  squashToProbability,
  utilisationPoints,
  velocityTrendPoints,
} from "@/services/sprint-forecast.service";
import type { AdjustedCapacityAnalysis } from "@/types";

const mockedSprints = vi.mocked(prisma.sprint.findMany);

function adjusted(
  name: string,
  adjustedUtilizationPercent: number,
  assignedHours = 40
): AdjustedCapacityAnalysis {
  return {
    developerId: name.toLowerCase(),
    developerName: name,
    assignedHours,
    completedHours: 0,
    capacityHours: 56,
    effectiveCapacityHours: 44.8,
    utilizationPercent: adjustedUtilizationPercent,
    overloadRisk: adjustedUtilizationPercent > 100,
    accuracyFactor: 1,
    adjustedEffectiveCapacityHours: 44.8,
    adjustedUtilizationPercent,
    adjustedOverloadRisk: adjustedUtilizationPercent > 100,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("exponential squish — probability = 100 × (1 − e^(−raw/40))", () => {
  // predictive-layer.md design decision 2: a pristine sprint must read 0%,
  // which a standard logistic (50% at raw=0) cannot deliver.
  it("maps zero raw points to exactly 0% probability", () => {
    expect(squashToProbability(0)).toBe(0);
  });

  it("maps 53 raw points to 73% (the live Sprint 1 figure)", () => {
    expect(squashToProbability(53)).toBe(73);
  });

  it("maps 40 raw points to 63% and saturates gracefully at high raw scores", () => {
    expect(squashToProbability(40)).toBe(63);
    expect(squashToProbability(80)).toBe(86);
    expect(squashToProbability(1000)).toBeLessThanOrEqual(100);
  });
});

describe("risk bands at 25 / 50 / 75", () => {
  it.each([
    [0, "low"],
    [24, "low"],
    [25, "moderate"],
    [49, "moderate"],
    [50, "high"],
    [74, "high"],
    [75, "critical"],
    [100, "critical"],
  ])("classifies %i%% as %s", (p, band) => {
    expect(getRiskBand(p)).toBe(band);
  });
});

describe("signal 1: team utilisation (max 40) — factor-adjusted peak", () => {
  it("awards zero points when every developer sits below 80%", () => {
    expect(utilisationPoints([adjusted("A", 79)]).points).toBe(0);
  });

  it("caps at 40 points at 120% utilisation and beyond", () => {
    expect(utilisationPoints([adjusted("A", 120)]).points).toBe(40);
    expect(utilisationPoints([adjusted("A", 402)]).points).toBe(40);
  });

  it("scores the PEAK developer, not the average", () => {
    const res = utilisationPoints([adjusted("Calm", 50), adjusted("Swamped", 130)]);
    expect(res.points).toBe(40);
    expect(res.detail).toContain("Swamped");
  });

  it("returns zero with no developers assigned", () => {
    expect(utilisationPoints([]).points).toBe(0);
  });
});

describe("signal 5: estimation accuracy (max 10) — asymmetric penalty", () => {
  it("caps at 10 points for a heavily under-estimating team", () => {
    const team = [{ ...adjusted("A", 50), accuracyFactor: 1.5 }];
    expect(estimationAccuracyPoints(team).points).toBe(10); // 0.5 dev × 25 = 12.5 → cap
  });

  it("penalises over-estimators far more gently, capped at 4", () => {
    const team = [{ ...adjusted("A", 50), accuracyFactor: 0.4 }];
    expect(estimationAccuracyPoints(team).points).toBe(4); // 0.6 × 8 = 4.8 → cap 4
  });

  it("awards zero for a perfectly calibrated team", () => {
    expect(estimationAccuracyPoints([adjusted("A", 50)]).points).toBe(0);
  });

  it("weights the team factor by assigned hours", () => {
    const team = [
      { ...adjusted("Busy", 50, 90), accuracyFactor: 1.3 },
      { ...adjusted("Idle", 50, 1), accuracyFactor: 1.0 },
    ];
    // weighted factor ≈ (1.3×90 + 1.0×1)/91 ≈ 1.297 → 0.297×25 ≈ 7.4 → 7
    expect(estimationAccuracyPoints(team).points).toBe(7);
  });
});

describe("signal 4: days remaining (max 15) — remaining work vs time left", () => {
  const sprint = {
    startDate: new Date("2026-06-01T00:00:00Z"),
    endDate: new Date("2026-06-15T00:00:00Z"),
  };
  const midSprint = new Date("2026-06-08T00:00:00Z");

  it("caps at 15 when the gap exceeds 30% of the sprint length", () => {
    // 200h remaining, team 35h/wk → 5h/day → needs 40 days, 7 left → gap 33 > 4.2
    const res = daysRemainingPoints(sprint, [{ estimatedHours: 200, status: "todo" }], 35, midSprint);
    expect(res.points).toBe(15);
  });

  it("awards zero when the remaining work fits the remaining days", () => {
    const res = daysRemainingPoints(sprint, [{ estimatedHours: 10, status: "todo" }], 70, midSprint);
    expect(res.points).toBe(0);
  });

  it("ignores completed tasks in the remaining-hours total", () => {
    const res = daysRemainingPoints(
      sprint,
      [
        { estimatedHours: 300, status: "done" },
        { estimatedHours: 10, status: "todo" },
      ],
      70,
      midSprint
    );
    expect(res.points).toBe(0);
  });

  it("scores zero before the sprint starts and after it ends", () => {
    expect(
      daysRemainingPoints(sprint, [{ estimatedHours: 500, status: "todo" }], 35, new Date("2026-05-01")).points
    ).toBe(0);
    expect(
      daysRemainingPoints(sprint, [{ estimatedHours: 500, status: "todo" }], 35, new Date("2026-07-01")).points
    ).toBe(0);
  });
});

describe("signal 3: velocity trend (max 15) — stepwise on past completion rate", () => {
  const asOf = new Date("2026-08-01T00:00:00Z");

  const pastSprint = (done: number, total: number) => ({
    tasks: [
      { estimatedHours: done, status: "done" },
      { estimatedHours: total - done, status: "todo" },
    ],
  });

  it("caps at 15 when the historic completion rate falls below 70%", async () => {
    mockedSprints.mockResolvedValue([pastSprint(60, 100)] as never);
    expect((await velocityTrendPoints("p1", "s1", asOf)).points).toBe(15);
  });

  it("awards zero for a ≥95% completion history", async () => {
    mockedSprints.mockResolvedValue([pastSprint(96, 100)] as never);
    expect((await velocityTrendPoints("p1", "s1", asOf)).points).toBe(0);
  });

  it("awards zero with no historic sprints on the project", async () => {
    mockedSprints.mockResolvedValue([] as never);
    expect((await velocityTrendPoints("p1", "s1", asOf)).points).toBe(0);
  });

  it("only looks at sprints that ended before the asOf anchor", async () => {
    mockedSprints.mockResolvedValue([] as never);
    await velocityTrendPoints("p1", "s1", asOf);
    const where = mockedSprints.mock.calls[0][0]?.where as { endDate: { lt: Date } };
    expect(where.endDate.lt).toEqual(asOf);
  });
});

describe("signal 2: ad-hoc history (max 20) — stepwise on unplanned fraction", () => {
  const asOf = new Date("2026-08-01T00:00:00Z");

  const mix = (adhocHours: number, plannedHours: number) => [
    {
      tasks: [
        { estimatedHours: adhocHours, type: "adhoc" },
        { estimatedHours: plannedHours, type: "planned" },
      ],
    },
  ];

  it("caps at 20 when ad-hoc work reaches 30% of recent sprint hours", async () => {
    mockedSprints.mockResolvedValue(mix(30, 70) as never);
    expect((await adhocHistoryPoints("p1", "s1", asOf)).points).toBe(20);
  });

  it("awards zero when unplanned work stays under 5%", async () => {
    mockedSprints.mockResolvedValue(mix(4, 96) as never);
    expect((await adhocHistoryPoints("p1", "s1", asOf)).points).toBe(0);
  });

  it("awards zero with no historic data", async () => {
    mockedSprints.mockResolvedValue([] as never);
    expect((await adhocHistoryPoints("p1", "s1", asOf)).points).toBe(0);
  });
});
