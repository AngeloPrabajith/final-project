import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit-tested through the public service API with the database mocked — the
// shrinkage, confidence and trend logic runs unmodified on crafted samples.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    developer: { findUnique: vi.fn(), findMany: vi.fn() },
    task: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  applyAccuracyToCapacity,
  computeDeveloperAccuracy,
} from "@/services/estimation-accuracy.service";

const mockedDev = vi.mocked(prisma.developer.findUnique);
const mockedTasks = vi.mocked(prisma.task.findMany);

function sample(estimatedHours: number, actualHours: number, completedAt: string) {
  return { estimatedHours, actualHours, completedAt: new Date(completedAt) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedDev.mockResolvedValue({ id: "dev-1", name: "Test Dev" } as never);
});

describe("estimation-accuracy factor — pseudo-count shrinkage toward 1.0", () => {
  // Handbook §4 / predictive-layer.md design decision 1: one overshot task
  // must not savage a new hire's modelled capacity.
  it("lands near 1.0 for a single task overshot by 50% (n=1, k=9)", async () => {
    mockedTasks.mockResolvedValue([sample(10, 15, "2026-08-01")] as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    // (15 + 9×10) / (10 + 9×10) = 105/100
    expect(acc.factor).toBe(1.05);
    expect(acc.rawFactor).toBe(1.5);
    expect(acc.sampleSize).toBe(1);
  });

  it("equals the raw Σactual/Σestimated ratio once n reaches 10 (k=0)", async () => {
    mockedTasks.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => sample(10, 12, `2026-07-${String(i + 1).padStart(2, "0")}`)) as never
    );
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.factor).toBe(1.2);
    expect(acc.factor).toBe(acc.rawFactor);
  });

  it("returns a neutral 1.0 factor with no samples at all", async () => {
    mockedTasks.mockResolvedValue([] as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.factor).toBe(1);
    expect(acc.sampleSize).toBe(0);
    expect(acc.confidence).toBe("low");
  });
});

describe("confidence bands at n<5 and n<15", () => {
  const nSamples = (n: number) =>
    Array.from({ length: n }, (_, i) => sample(10, 11, `2026-06-${String((i % 28) + 1).padStart(2, "0")}`));

  it.each([
    [4, "low"],
    [5, "medium"],
    [14, "medium"],
    [15, "high"],
  ])("classifies n=%i as %s confidence", async (n, expected) => {
    mockedTasks.mockResolvedValue(nSamples(n) as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.confidence).toBe(expected);
  });
});

describe("trend detection — halves compared by distance from 1.0, 0.05 movement rule", () => {
  it("reports no trend below eight samples", async () => {
    mockedTasks.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => sample(10, 13, `2026-07-0${i + 1}`)) as never
    );
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.trend).toBeUndefined();
  });

  it("labels a developer improving when the later half sits closer to 1.0", async () => {
    const early = Array.from({ length: 4 }, (_, i) => sample(10, 13, `2026-06-0${i + 1}`)); // raw 1.3
    const late = Array.from({ length: 4 }, (_, i) => sample(10, 10.5, `2026-07-0${i + 1}`)); // raw 1.05
    mockedTasks.mockResolvedValue([...early, ...late] as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.trend).toBe("improving");
  });

  it("labels a developer degrading when the later half drifts away from 1.0", async () => {
    const early = Array.from({ length: 4 }, (_, i) => sample(10, 10.2, `2026-06-0${i + 1}`)); // raw 1.02
    const late = Array.from({ length: 4 }, (_, i) => sample(10, 13.5, `2026-07-0${i + 1}`)); // raw 1.35
    mockedTasks.mockResolvedValue([...early, ...late] as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.trend).toBe("degrading");
  });

  it("labels movement within ±0.05 as stable", async () => {
    const early = Array.from({ length: 4 }, (_, i) => sample(10, 12, `2026-06-0${i + 1}`)); // raw 1.2
    const late = Array.from({ length: 4 }, (_, i) => sample(10, 12.2, `2026-07-0${i + 1}`)); // raw 1.22
    mockedTasks.mockResolvedValue([...early, ...late] as never);
    const acc = await computeDeveloperAccuracy("dev-1");
    expect(acc.trend).toBe("stable");
  });
});

describe("sampling window — rolling 90 days, asOf-anchored (no leakage)", () => {
  it("queries completions from exactly 90 days before the anchor up to the anchor", async () => {
    mockedTasks.mockResolvedValue([] as never);
    const asOf = new Date("2026-05-01T00:00:00Z");
    await computeDeveloperAccuracy("dev-1", { asOf });

    const where = mockedTasks.mock.calls[0][0]?.where as {
      completedAt: { gte: Date; lt: Date };
    };
    const expectedSince = new Date(asOf);
    expectedSince.setDate(expectedSince.getDate() - 90);
    expect(where.completedAt.lt).toEqual(asOf);
    expect(where.completedAt.gte).toEqual(expectedSince);
  });

  // Handbook §4: the retroactive evaluation depends on `asOf` excluding every
  // completion at or after the anchor — enforced here at the query boundary.
  it("excludes completions at or after asOf via a strict less-than bound", async () => {
    mockedTasks.mockResolvedValue([] as never);
    const asOf = new Date("2026-05-01T00:00:00Z");
    await computeDeveloperAccuracy("dev-1", { asOf });
    const where = mockedTasks.mock.calls[0][0]?.where as {
      completedAt: { gte: Date; lt: Date };
    };
    expect(where.completedAt.lt.getTime()).toBe(asOf.getTime());
    expect("lte" in where.completedAt).toBe(false);
  });
});

describe("applying the factor to capacity", () => {
  it("divides effective capacity by the factor (an under-estimator has less usable capacity)", () => {
    expect(applyAccuracyToCapacity(22.4, 1.28)).toBeCloseTo(17.5, 10);
  });

  it("returns capacity unchanged for a zero, negative or missing factor (never breaks the base engine)", () => {
    expect(applyAccuracyToCapacity(50, 0)).toBe(50);
    expect(applyAccuracyToCapacity(50, -1)).toBe(50);
    expect(applyAccuracyToCapacity(50, NaN)).toBe(50);
  });
});
