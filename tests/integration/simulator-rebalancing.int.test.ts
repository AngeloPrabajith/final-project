import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { simulateAdHocTask } from "@/services/capacity.service";
import { computeSprintCapacity } from "@/services/overload-detection";
import { computeSuggestions } from "@/services/rebalancing.service";
import type { Task } from "@/types";

async function sprintIdByName(name: string): Promise<string> {
  const sprint = await prisma.sprint.findFirst({ where: { name } });
  if (!sprint) throw new Error(`seeded sprint not found: ${name}`);
  return sprint.id;
}

describe("ad-hoc simulator against the seeded database", () => {
  it("adds hypothetical hours to the developer's live analysis and reconciles with the chain", async () => {
    const sprintId = await sprintIdByName("Sprint 2 · Email & integrations");
    const analyses = await computeSprintCapacity(sprintId);
    const target = analyses[0];

    const result = await simulateAdHocTask(sprintId, target.developerId, 6);

    expect(result.before.assignedHours).toBe(target.assignedHours);
    expect(result.after.assignedHours).toBe(target.assignedHours + 6);
    expect(result.after.utilizationPercent).toBe(
      Math.round(((target.assignedHours + 6) / target.effectiveCapacityHours) * 100)
    );
  });

  it("is a pure what-if: no task row is ever created", async () => {
    const sprintId = await sprintIdByName("Sprint 2 · Email & integrations");
    const analyses = await computeSprintCapacity(sprintId);
    const before = await prisma.task.count();
    await simulateAdHocTask(sprintId, analyses[0].developerId, 12);
    const after = await prisma.task.count();
    expect(after).toBe(before);
  });

  it("judges a developer not yet on the sprint against the full capacity chain", async () => {
    // Abdulaziz: 25h/wk, 8h meetings, no Sprint 1 tasks, but assigned in the
    // concurrent Sprint 2, so taking ad-hoc work here makes him one of two:
    //   (25 − 8) × 2wk = 34h × 0.8 buffer = 27.2h × 0.5 multi-project = 13.6h
    const sprintId = await sprintIdByName("Sprint 1 · PDP experience");
    const dev = await prisma.developer.findFirstOrThrow({
      where: { name: "Abdulaziz Roshan" },
    });
    // Precondition: this exercises the no-live-analysis fallback path.
    expect(
      await prisma.task.count({ where: { sprintId, assignedDeveloperId: dev.id } })
    ).toBe(0);

    const result = await simulateAdHocTask(sprintId, dev.id, 20);

    expect(result.before).toMatchObject({
      assignedHours: 0,
      capacityHours: 34,
      effectiveCapacityHours: 13.6,
      meetingHoursPerWeek: 8,
      multiProjectFactor: 0.5,
      concurrentSprintCount: 1,
      overlappingSprintNames: ["Sprint 2 · Email & integrations"],
    });
    // 20h is 147% of 13.6h; judged against raw 25h × 2wk = 50h it read as 40%.
    expect(result.after.utilizationPercent).toBe(147);
    expect(result.wouldCauseOverload).toBe(true);
  });
});

describe("rebalancing suggestions against the overloaded seeded sprint", () => {
  it("emits at most one suggestion per overloaded developer, each reconciling with the capacity chain", async () => {
    const sprintId = await sprintIdByName("Sprint 1 · PDP experience");
    const capacity = await computeSprintCapacity(sprintId);
    const tasks = (await prisma.task.findMany({
      where: { sprintId },
    })) as unknown as Task[];

    const suggestions = computeSuggestions(capacity, tasks);
    const overloaded = capacity.filter((c) => c.overloadRisk);
    expect(overloaded.length).toBeGreaterThan(0); // the seed engineers this sprint overloaded

    // At most one suggestion per overloaded developer (panel-conciseness rule).
    const fromCounts = new Map<string, number>();
    for (const s of suggestions) {
      fromCounts.set(s.fromDev, (fromCounts.get(s.fromDev) ?? 0) + 1);
    }
    for (const [, count] of fromCounts) expect(count).toBe(1);
    expect(suggestions.length).toBeLessThanOrEqual(overloaded.length);

    // Every projected utilisation must reconcile with the chain arithmetic.
    const byName = new Map(capacity.map((c) => [c.developerName, c]));
    for (const s of suggestions) {
      const from = byName.get(s.fromDev)!;
      const to = byName.get(s.toDev)!;
      expect(s.fromUtilAfter).toBe(
        Math.round(((from.assignedHours - s.taskHours) / from.effectiveCapacityHours) * 100)
      );
      expect(s.toUtilAfter).toBe(
        Math.round(((to.assignedHours + s.taskHours) / to.effectiveCapacityHours) * 100)
      );
      // A recipient must genuinely have the headroom the algorithm promised.
      expect(to.effectiveCapacityHours - to.assignedHours).toBeGreaterThanOrEqual(s.taskHours);
      expect(to.overloadRisk).toBe(false);
    }
  });
});
