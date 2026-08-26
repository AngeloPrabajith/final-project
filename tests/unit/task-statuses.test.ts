import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIBLE_STATUS_IDS,
  isTerminalStatus,
  statusLabel,
  TASK_STATUSES,
} from "@/lib/task-statuses";

describe("task workflow — single source of truth for the eight states", () => {
  it("defines exactly eight statuses in Kanban column order", () => {
    expect(TASK_STATUSES.map((s) => s.id)).toEqual([
      "backlog",
      "todo",
      "inprogress",
      "paused",
      "qa",
      "uat",
      "readyforprod",
      "done",
    ]);
  });

  // Handbook §2: only `done` releases capacity — a paused task is still
  // assigned to the developer and still consumes their capacity.
  it("treats only done as terminal for capacity and estimation-accuracy purposes", () => {
    expect(isTerminalStatus("done")).toBe(true);
    for (const s of TASK_STATUSES.filter((s) => s.id !== "done")) {
      expect(isTerminalStatus(s.id)).toBe(false);
    }
  });

  it("shows every column by default", () => {
    expect(DEFAULT_VISIBLE_STATUS_IDS).toHaveLength(8);
  });

  it("labels done as Released to Prod", () => {
    expect(statusLabel("done")).toBe("Released to Prod");
  });
});
