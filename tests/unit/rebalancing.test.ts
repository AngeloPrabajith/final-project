import { describe, expect, it } from "vitest";
import { computeSuggestions } from "@/services/rebalancing.service";
import type { CapacityAnalysis, Task } from "@/types";

function analysis(
  name: string,
  assignedHours: number,
  effectiveCapacityHours: number
): CapacityAnalysis {
  return {
    developerId: name.toLowerCase(),
    developerName: name,
    assignedHours,
    completedHours: 0,
    capacityHours: effectiveCapacityHours / 0.8,
    effectiveCapacityHours,
    utilizationPercent: Math.round((assignedHours / effectiveCapacityHours) * 100),
    overloadRisk: assignedHours > effectiveCapacityHours,
  };
}

function task(
  id: string,
  devName: string,
  estimatedHours: number,
  priority: string,
  status = "todo"
): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    estimatedHours,
    type: "planned",
    status,
    priority,
    assignedDeveloperId: devName.toLowerCase(),
    sprintId: "s1",
    createdAt: "2026-08-01",
  } as Task;
}

describe("rebalancing suggestions — move low-priority work off overloaded developers", () => {
  const overloadedDev = analysis("Swamped", 60, 40); // 150%
  const freeDev = analysis("Free", 10, 40); // 25%

  it("returns nothing when nobody is overloaded", () => {
    expect(computeSuggestions([freeDev], [task("t1", "Free", 5, "low")])).toEqual([]);
  });

  it("returns nothing when nobody has headroom to receive work", () => {
    const alsoFull = analysis("AlsoFull", 40, 40);
    expect(
      computeSuggestions([overloadedDev, alsoFull], [task("t1", "Swamped", 5, "low")])
    ).toEqual([]);
  });

  it("prefers moving the LOWEST-priority task first", () => {
    const suggestions = computeSuggestions(
      [overloadedDev, freeDev],
      [task("critical-task", "Swamped", 5, "critical"), task("low-task", "Swamped", 5, "low")]
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].taskId).toBe("low-task");
  });

  it("never suggests moving a completed task", () => {
    const suggestions = computeSuggestions(
      [overloadedDev, freeDev],
      [task("done-task", "Swamped", 5, "low", "done"), task("live-task", "Swamped", 5, "medium")]
    );
    expect(suggestions[0].taskId).toBe("live-task");
  });

  it("emits at most one suggestion per overloaded developer", () => {
    const secondOverloaded = analysis("AlsoSwamped", 55, 40);
    const suggestions = computeSuggestions(
      [overloadedDev, secondOverloaded, freeDev],
      [
        task("a1", "Swamped", 5, "low"),
        task("a2", "Swamped", 5, "low"),
        task("b1", "AlsoSwamped", 5, "low"),
        task("b2", "AlsoSwamped", 5, "low"),
      ]
    );
    expect(suggestions).toHaveLength(2); // one per overloaded dev, not four
    expect(new Set(suggestions.map((s) => s.fromDev)).size).toBe(2);
  });

  it("only offers recipients who can absorb the task within effective capacity", () => {
    const tight = analysis("Tight", 38, 40); // 2h headroom
    const suggestions = computeSuggestions(
      [overloadedDev, tight],
      [task("big", "Swamped", 5, "low")]
    );
    expect(suggestions).toEqual([]); // 5h does not fit in 2h headroom
  });

  it("projects both developers' post-move utilisation with the capacity-chain arithmetic", () => {
    const suggestions = computeSuggestions(
      [overloadedDev, freeDev],
      [task("t1", "Swamped", 8, "low")]
    );
    const s = suggestions[0];
    expect(s.fromUtilAfter).toBe(Math.round(((60 - 8) / 40) * 100)); // 130
    expect(s.toUtilAfter).toBe(Math.round(((10 + 8) / 40) * 100)); // 45
  });
});
