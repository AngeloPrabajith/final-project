import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBurndown } from "@/services/overload-detection";

/**
 * Burndown classification (handbook §3): delta = actual − expected progress;
 * ahead > +10, on-track ≥ −5, behind ≥ −20, at-risk < −20.
 * computeBurndown anchors "now" to the wall clock, so the clock is frozen at
 * day 7 of a 14-day sprint → expected progress 50%.
 */
describe("burndown classification at the +10 / −5 / −20 deltas", () => {
  const start = new Date("2026-06-01T00:00:00Z");
  const end = new Date("2026-06-15T00:00:00Z");
  const sprint = { startDate: start, endDate: end };

  const tasks = (doneHours: number, totalHours = 100) => [
    { estimatedHours: doneHours, status: "done" },
    { estimatedHours: totalHours - doneHours, status: "todo" },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:00Z")); // day 7 of 14
  });
  afterEach(() => vi.useRealTimers());

  it("computes expected progress from calendar days elapsed", () => {
    const b = computeBurndown(sprint, tasks(0));
    expect(b.daysTotal).toBe(14);
    expect(b.daysPassed).toBe(7);
    expect(b.expectedProgress).toBe(50);
  });

  it("classifies ahead when actual leads expected by more than 10 points", () => {
    expect(computeBurndown(sprint, tasks(65)).status).toBe("ahead"); // +15
    expect(computeBurndown(sprint, tasks(60)).status).toBe("on-track"); // +10 boundary: not > 10
  });

  it("classifies on-track down to exactly −5", () => {
    expect(computeBurndown(sprint, tasks(50)).status).toBe("on-track"); // 0
    expect(computeBurndown(sprint, tasks(45)).status).toBe("on-track"); // −5 boundary
  });

  it("classifies behind between −5 and −20", () => {
    expect(computeBurndown(sprint, tasks(44)).status).toBe("behind"); // −6
    expect(computeBurndown(sprint, tasks(30)).status).toBe("behind"); // −20 boundary: not < −20
  });

  it("classifies at-risk beyond −20", () => {
    expect(computeBurndown(sprint, tasks(29)).status).toBe("at-risk"); // −21
    expect(computeBurndown(sprint, tasks(0)).status).toBe("at-risk"); // −50
  });

  it("treats a sprint with no estimated work as on-track with zeroed progress", () => {
    const b = computeBurndown(sprint, []);
    expect(b.expectedProgress).toBe(0);
    expect(b.actualProgress).toBe(0);
    expect(b.status).toBe("on-track");
  });

  it("clamps days passed to the sprint window", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z")); // well past the end
    const b = computeBurndown(sprint, tasks(50));
    expect(b.daysPassed).toBe(14);
  });
});
