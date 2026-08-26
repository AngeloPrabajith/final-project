import { describe, expect, it } from "vitest";
import {
  CLIENT_PROJECT_KEYS,
  CLIENT_SPRINT_KEYS,
  CLIENT_TASK_KEYS,
  DEVELOPER_TASK_UPDATE_FIELDS,
  deliveryConfidenceFor,
  disallowedDeveloperTaskFields,
  personalCapacity,
  redactProjectForClient,
  redactSprintForClient,
  redactTaskForClient,
} from "@/lib/redact";
import type { CapacityAnalysis } from "@/types";

// A maximal task as Prisma returns it — nested assignee and every sensitive
// field present, so the key-set assertions prove the whitelist drops them.
const fullTask = {
  id: "t1",
  title: "Checkout upsells (Checkout Extensibility)",
  description: "secret internal notes",
  status: "inprogress",
  priority: "high",
  type: "planned",
  estimatedHours: 25,
  actualHours: 31,
  completedAt: new Date("2026-08-01"),
  assignedDeveloperId: "dev-1",
  assignedDeveloper: { id: "dev-1", name: "Angelo Perera", weeklyCapacityHours: 40 },
  sprintId: "s1",
  createdAt: new Date("2026-07-01"),
};

const fullSprint = {
  id: "s1",
  name: "Sprint 1 · PDP experience",
  startDate: new Date("2026-08-01"),
  endDate: new Date("2026-08-15"),
  projectId: "p1",
  project: { name: "NOYZ Storefront" },
  capacityBuffer: 0.2,
  retrospectiveNotes: "Angelo's estimates are systematically low.",
  tasks: [fullTask],
};

const fullProject = {
  id: "p1",
  name: "NOYZ Storefront",
  description: "Shopify Plus storefront",
  createdAt: new Date("2026-06-01"),
  sprints: [fullSprint],
};

describe("whitelist redaction — client shapes are BUILT, never stripped", () => {
  // Handbook §10.11: a key-set assertion fails the moment someone adds a field
  // to the model without deciding whether clients may see it.
  it("produces exactly the CLIENT_TASK_KEYS set for a client task", () => {
    const keys = Object.keys(redactTaskForClient(fullTask)).sort();
    expect(keys).toEqual([...CLIENT_TASK_KEYS].sort());
  });

  it("produces exactly the CLIENT_SPRINT_KEYS set for a client sprint", () => {
    const keys = Object.keys(redactSprintForClient(fullSprint)).sort();
    expect(keys).toEqual([...CLIENT_SPRINT_KEYS].sort());
  });

  it("produces exactly the CLIENT_PROJECT_KEYS set for a client project", () => {
    const keys = Object.keys(redactProjectForClient(fullProject)).sort();
    expect(keys).toEqual([...CLIENT_PROJECT_KEYS].sort());
  });

  it("drops the assignee, actual hours, completion timestamp and description from tasks", () => {
    const redacted = redactTaskForClient(fullTask) as unknown as Record<string, unknown>;
    for (const key of ["assignedDeveloper", "assignedDeveloperId", "actualHours", "completedAt", "description"]) {
      expect(redacted).not.toHaveProperty(key);
    }
  });

  // Handbook §5 leak trap 1: retrospectiveNotes is manager-authored free text
  // naming and evaluating individuals — the least obvious leak in the codebase.
  it("drops retrospectiveNotes and capacityBuffer from sprints", () => {
    const redacted = redactSprintForClient(fullSprint) as unknown as Record<string, unknown>;
    expect(redacted).not.toHaveProperty("retrospectiveNotes");
    expect(redacted).not.toHaveProperty("capacityBuffer");
  });

  it("redacts the nested sprint and task arrays recursively through a project", () => {
    const project = redactProjectForClient(fullProject);
    const sprint = project.sprints[0] as unknown as Record<string, unknown>;
    const task = (sprint.tasks as Record<string, unknown>[])[0];
    expect(sprint).not.toHaveProperty("retrospectiveNotes");
    expect(task).not.toHaveProperty("assignedDeveloper");
  });

  it("never emits a developer name, utilisation figure or recommendation string anywhere in a client shape", () => {
    const serialised = JSON.stringify([
      redactTaskForClient(fullTask),
      redactSprintForClient(fullSprint),
      redactProjectForClient(fullProject),
    ]);
    for (const banned of ["Angelo", "utilizationPercent", "recommendation", "retrospectiveNotes", "systematically low"]) {
      expect(serialised).not.toContain(banned);
    }
  });
});

describe("delivery confidence — band only, never the probability", () => {
  it.each([
    ["low", "On track"],
    ["moderate", "On track — minor risk"],
    ["high", "Delivery at risk"],
    ["critical", "Delivery at significant risk"],
  ] as const)("labels the %s band as %s", (band, label) => {
    const confidence = deliveryConfidenceFor(band);
    expect(confidence).toEqual({ band, label });
    // Handbook §5 leak trap 2: the full forecast's headline and contributor
    // details embed names and percentages; only these two fields may survive.
    expect(Object.keys(confidence).sort()).toEqual(["band", "label"]);
  });
});

describe("developer task-update field allow-list", () => {
  it("permits exactly status, actualHours and completedAt", () => {
    expect([...DEVELOPER_TASK_UPDATE_FIELDS].sort()).toEqual(
      ["actualHours", "completedAt", "status"]
    );
    expect(disallowedDeveloperTaskFields({ status: "done", actualHours: 5 })).toEqual([]);
  });

  it("rejects an attempt to reassign a task to a peer", () => {
    expect(disallowedDeveloperTaskFields({ status: "done", assignedDeveloperId: "peer" }))
      .toEqual(["assignedDeveloperId"]);
  });

  it("rejects estimate tampering and any unknown field", () => {
    expect(disallowedDeveloperTaskFields({ estimatedHours: 1, sneaky: true }).sort())
      .toEqual(["estimatedHours", "sneaky"]);
  });
});

describe("personal capacity narrowing", () => {
  const mine: CapacityAnalysis = {
    developerId: "me",
    developerName: "Me",
    assignedHours: 10,
    completedHours: 0,
    capacityHours: 56,
    effectiveCapacityHours: 44.8,
    utilizationPercent: 22,
    overloadRisk: false,
  };

  it("returns only the requested developer's analysis", () => {
    expect(personalCapacity([mine, { ...mine, developerId: "peer" }], "me")).toBe(mine);
  });

  it("returns null rather than falling back to the full list when the developer has no work", () => {
    expect(personalCapacity([mine], "someone-else")).toBeNull();
  });
});
