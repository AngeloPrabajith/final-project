import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  computeBurndown,
  computeSprintCapacity,
} from "@/services/overload-detection";
import { computeSprintForecast } from "@/services/sprint-forecast.service";

async function sprintByName(name: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { name },
    include: { tasks: true },
  });
  if (!sprint) throw new Error(`seeded sprint not found: ${name}`);
  return sprint;
}

describe("capacity engine against the seeded database", () => {
  it("reproduces the handbook worked example end to end: Angelo at 22.4h effective and 402% in Sprint 1", async () => {
    const sprint = await sprintByName("Sprint 1 · PDP experience");
    const analyses = await computeSprintCapacity(sprint.id);
    const angelo = analyses.find((a) => a.developerName === "Angelo Perera");

    expect(angelo).toBeDefined();
    expect(angelo!.capacityHours).toBe(56); // (40 − 12) × 2 weeks
    expect(angelo!.effectiveCapacityHours).toBe(22.4); // × 0.8 buffer × 0.5 multi-project
    expect(angelo!.assignedHours).toBe(90);
    expect(angelo!.utilizationPercent).toBe(402);
    expect(angelo!.overloadRisk).toBe(true);
    expect(angelo!.meetingHoursPerWeek).toBe(12);
    expect(angelo!.multiProjectFactor).toBe(0.5);
    expect(angelo!.overlappingSprintNames).toContain("Sprint 3 · Only Human launch stretch");
  });

  it("includes paused tasks in assigned hours — pausing does not release capacity", async () => {
    const sprint = await sprintByName("Sprint 1 · PDP experience");
    const analyses = await computeSprintCapacity(sprint.id);
    const angelo = analyses.find((a) => a.developerName === "Angelo Perera")!;

    const angeloTasks = sprint.tasks.filter(
      (t) => t.assignedDeveloperId === angelo.developerId && t.status !== "done"
    );
    expect(angeloTasks.some((t) => t.status === "paused")).toBe(true);
    expect(angeloTasks.reduce((s, t) => s + t.estimatedHours, 0)).toBe(angelo.assignedHours);
  });

  it("excludes done tasks from assigned hours — a fully completed sprint shows zero active load", async () => {
    const sprint = await sprintByName("Sprint -3 · Site speed foundations");
    const analyses = await computeSprintCapacity(sprint.id);
    expect(analyses.length).toBeGreaterThan(0);
    for (const a of analyses) {
      expect(a.assignedHours).toBe(0);
      expect(a.completedHours).toBeGreaterThan(0);
    }
  });

  it("upserts exactly one CapacityRecord per (developer, sprint) and stays idempotent across recomputes", async () => {
    const sprint = await sprintByName("Sprint 1 · PDP experience");
    const analyses = await computeSprintCapacity(sprint.id);
    const first = await prisma.capacityRecord.findMany({ where: { sprintId: sprint.id } });
    await computeSprintCapacity(sprint.id);
    const second = await prisma.capacityRecord.findMany({ where: { sprintId: sprint.id } });

    expect(first).toHaveLength(analyses.length);
    expect(second).toHaveLength(analyses.length);
    const pairs = new Set(second.map((r) => `${r.developerId}:${r.sprintId}`));
    expect(pairs.size).toBe(second.length); // no duplicate pairs
  });
});

describe("retroactive forecasting never rewrites history (handbook §4 leakage rules)", () => {
  it("computes an asOf-anchored forecast without writing a single CapacityRecord", async () => {
    const sprint = await sprintByName("Sprint 0 · Performance hardening");
    const before = await prisma.capacityRecord.count();
    await computeSprintForecast(sprint.id, { asOf: sprint.startDate });
    const after = await prisma.capacityRecord.count();
    expect(after).toBe(before);
  });

  it("treats tasks completed after asOf as still pending — nothing is 'done' at sprint start", async () => {
    const sprint = await sprintByName("Sprint 0 · Performance hardening");

    const retro = await computeSprintForecast(sprint.id, { asOf: sprint.startDate });
    for (const a of retro.adjustedAnalyses) {
      expect(a.completedHours).toBe(0); // no task finished before the sprint began
      expect(a.assignedHours).toBeGreaterThan(0); // …so all of it counts as active
    }

    // The live view of the same (now finished) sprint sees the completions —
    // proving the asOf filter, not the data, made the difference.
    const live = await computeSprintForecast(sprint.id);
    const liveCompleted = live.adjustedAnalyses.reduce((s, a) => s + a.completedHours, 0);
    expect(liveCompleted).toBeGreaterThan(0);
  });

  it("computes burndown for the client path with zero database writes", async () => {
    // Handbook §5 leak trap 3: client routes must bypass the record-writing
    // engine; computeBurndown is the pure substitute they use.
    const sprint = await sprintByName("Sprint 2 · Email & integrations");
    const before = await prisma.capacityRecord.count();
    const burndown = computeBurndown(
      { startDate: sprint.startDate, endDate: sprint.endDate },
      sprint.tasks.map((t) => ({ estimatedHours: t.estimatedHours, status: t.status }))
    );
    const after = await prisma.capacityRecord.count();
    expect(after).toBe(before);
    expect(burndown.totalHours).toBeGreaterThan(0);
  });
});

describe("meeting-hours clamp on a scratch fixture", () => {
  let projectId: string;
  let developerId: string;
  let sprintId: string;

  beforeAll(async () => {
    // Placed 100 days out so it can never overlap the seeded in-flight sprints
    // and disturb their multi-project factors.
    const project = await prisma.project.create({
      data: { name: "ZZ Scratch — meetings clamp" },
    });
    projectId = project.id;
    const developer = await prisma.developer.create({
      data: { name: "ZZ Meeting-Bound", weeklyCapacityHours: 10, meetingHoursPerWeek: 60 },
    });
    developerId = developer.id;
    const start = new Date();
    start.setDate(start.getDate() + 100);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const sprint = await prisma.sprint.create({
      data: { name: "ZZ Scratch sprint", startDate: start, endDate: end, projectId },
    });
    sprintId = sprint.id;
    await prisma.task.create({
      data: {
        title: "ZZ scratch task",
        estimatedHours: 5,
        sprintId,
        assignedDeveloperId: developerId,
      },
    });
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }); // cascades sprint + task
    await prisma.developer.delete({ where: { id: developerId } });
  });

  it("clamps net capacity to zero when meeting hours exceed weekly hours, and still reports meaningfully", async () => {
    const analyses = await computeSprintCapacity(sprintId);
    const clamped = analyses.find((a) => a.developerId === developerId);
    expect(clamped).toBeDefined();
    expect(clamped!.capacityHours).toBe(0); // max(0, 10 − 60) × 2 weeks
    expect(clamped!.effectiveCapacityHours).toBe(0);
    expect(clamped!.utilizationPercent).toBe(100); // assigned > 0 against zero capacity
    expect(clamped!.overloadRisk).toBe(true);
  });
});
