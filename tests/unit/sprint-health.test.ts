import { describe, expect, it } from "vitest";
import { computeSprintHealth } from "@/services/overload-detection";
import type { CapacityAnalysis } from "@/types";

function dev(
  name: string,
  utilizationPercent: number,
  overloadRisk = utilizationPercent > 100
): CapacityAnalysis {
  return {
    developerId: name.toLowerCase(),
    developerName: name,
    assignedHours: 0,
    completedHours: 0,
    capacityHours: 0,
    effectiveCapacityHours: 0,
    utilizationPercent,
    overloadRisk,
  };
}

describe("sprint health score — 100 baseline with per-developer penalties", () => {
  it("scores an empty sprint 100 and healthy", () => {
    const h = computeSprintHealth([]);
    expect(h.score).toBe(100);
    expect(h.status).toBe("healthy");
  });

  it("scores a comfortable team 100 with no penalties", () => {
    const h = computeSprintHealth([dev("A", 60), dev("B", 70)]);
    expect(h.score).toBe(100);
    expect(h.status).toBe("healthy");
  });

  it("subtracts 30 for each overloaded developer", () => {
    // one overloaded at 120%: −30, but avg 120 > 85 also costs 5 → 65
    const h = computeSprintHealth([dev("A", 120)]);
    expect(h.score).toBe(65);
    expect(h.overloadedDeveloperCount).toBe(1);
  });

  it("subtracts 10 for each at-risk developer at or above 80%", () => {
    const h = computeSprintHealth([dev("A", 80), dev("B", 50)]);
    expect(h.score).toBe(90); // avg 65, no avg penalty
    expect(h.atRiskDeveloperCount).toBe(1);
    expect(h.status).toBe("healthy");
  });

  it("subtracts 5 when average utilisation exceeds 85%", () => {
    // two at-risk (90, 90): −20; avg 90 > 85: −5 → 75
    const h = computeSprintHealth([dev("A", 90), dev("B", 90)]);
    expect(h.score).toBe(75);
  });

  it("classifies at-risk below 70 and overloaded below 40 (band boundaries)", () => {
    // exactly 70 → healthy (boundary is strict <70): one overloaded at 100%
    // …can't reach exactly 70 without avoiding the avg penalty; use overload at
    // utilisation ≤85 mixed with a low dev: (−30), avg (101+9)/2=55 → 70.
    const seventy = computeSprintHealth([dev("A", 101, true), dev("B", 9)]);
    expect(seventy.score).toBe(70);
    expect(seventy.status).toBe("healthy");

    const sixtyFive = computeSprintHealth([dev("A", 120)]);
    expect(sixtyFive.status).toBe("at-risk"); // 65 < 70

    // exactly 40 → at-risk (boundary is strict <40): two overloaded, low avg
    const forty = computeSprintHealth([dev("A", 101, true), dev("B", 101, true), dev("C", 10), dev("D", 10)]);
    expect(forty.score).toBe(40);
    expect(forty.status).toBe("at-risk");

    const deepOverload = computeSprintHealth([dev("A", 150), dev("B", 150), dev("C", 150)]);
    expect(deepOverload.score).toBe(5); // −90, avg 150 → −5
    expect(deepOverload.status).toBe("overloaded");
  });

  it("never scores below zero", () => {
    const h = computeSprintHealth([dev("A", 200), dev("B", 200), dev("C", 200), dev("D", 200)]);
    expect(h.score).toBe(0);
  });

  // Handbook §5 leak trap 2: the recommendation string names developers, which
  // is why non-manager responses withhold `health` wholesale.
  it("interpolates developer names into the recommendation string (the reason clients never receive it)", () => {
    const h = computeSprintHealth([dev("Angelo Perera", 150)]);
    expect(h.recommendation).toContain("Angelo Perera");
  });
});
