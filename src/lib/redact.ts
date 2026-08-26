import type {
  CapacityAnalysis,
  ClientProject,
  ClientSprint,
  ClientTask,
  DeliveryConfidence,
  ForecastRiskBand,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/types";

/**
 * Redaction helpers for role-scoped API responses.
 *
 * Every function here **builds the allowed shape** rather than deleting fields
 * from the source object. That is the whole point: `CapacityAnalysis` has 13
 * fields and a Prisma `Task` arrives with a nested `assignedDeveloper`, so a
 * blacklist silently starts leaking the moment anyone adds a field. A
 * whitelist fails safe — a new field is invisible until someone consciously
 * adds it here.
 *
 * The exported `*_KEYS` arrays exist so a test can assert the exact key set
 * and fail when the shape drifts.
 */

export const CLIENT_TASK_KEYS = [
  "id",
  "title",
  "status",
  "priority",
  "type",
  "estimatedHours",
  "sprintId",
] as const;

export const CLIENT_SPRINT_KEYS = [
  "id",
  "name",
  "startDate",
  "endDate",
  "projectId",
  "projectName",
  "tasks",
] as const;

interface TaskLike {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  estimatedHours: number;
  sprintId: string;
}

interface SprintLike {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  projectId: string;
  project?: { name: string } | null;
  tasks?: TaskLike[];
}

const iso = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString();

/**
 * Strips assignee, actual hours, completion timestamps and description.
 * A client sees *what* is planned, never *who* is doing it or how long it
 * really took.
 */
export function redactTaskForClient(task: TaskLike): ClientTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    type: task.type as TaskType,
    estimatedHours: task.estimatedHours,
    sprintId: task.sprintId,
  };
}

/**
 * Strips `retrospectiveNotes` and `capacityBuffer`.
 *
 * `retrospectiveNotes` is the least obvious leak in this codebase: it is free
 * text written by managers and the seeded values read like
 * "Kusalni finished ahead of schedule (again). Need to calibrate those estimates."
 * — individually identifying and evaluative. It must never reach a client.
 */
export function redactSprintForClient(sprint: SprintLike): ClientSprint {
  return {
    id: sprint.id,
    name: sprint.name,
    startDate: iso(sprint.startDate),
    endDate: iso(sprint.endDate),
    projectId: sprint.projectId,
    projectName: sprint.project?.name ?? null,
    tasks: (sprint.tasks ?? []).map(redactTaskForClient),
  };
}

export const CLIENT_PROJECT_KEYS = [
  "id",
  "name",
  "description",
  "createdAt",
  "sprints",
] as const;

interface ProjectLike {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  sprints?: SprintLike[];
}

/**
 * Strips nothing at the top level — a project's name and description are
 * fine — but rebuilds the nested `sprints` array from the sprint whitelist.
 *
 * This is the fix for a bug that shipped briefly during development: the
 * project *detail* route redacted sprints, while the project *list* route
 * returned `include: { sprints: true }` untouched, leaking
 * `retrospectiveNotes` to clients. Both routes now share this one function,
 * so the whitelist can only be got wrong in a single place.
 */
export function redactProjectForClient(project: ProjectLike): ClientProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: iso(project.createdAt),
    sprints: (project.sprints ?? []).map(redactSprintForClient),
  };
}

const CONFIDENCE_LABEL: Record<ForecastRiskBand, string> = {
  low: "On track",
  moderate: "On track — minor risk",
  high: "Delivery at risk",
  critical: "Delivery at significant risk",
};

/**
 * Collapse a full `SprintForecast` to a band and a plain-English label.
 *
 * Deliberately drops the probability percentage and the contributor list:
 * `SprintForecast.headline` reads "74% chance this sprint misses commitment —
 * rebalance recommended", and each contributor's `detail` string is built by
 * the forecast service with developer names interpolated into it. Those cannot
 * be redacted field-by-field, so they are withheld wholesale.
 */
export function deliveryConfidenceFor(
  band: ForecastRiskBand
): DeliveryConfidence {
  return { band, label: CONFIDENCE_LABEL[band] };
}

/**
 * Narrow a sprint's capacity analyses to a single developer.
 * Returns null when that developer has no work in the sprint — callers should
 * render an empty state rather than falling back to the full list.
 */
export function personalCapacity(
  analyses: CapacityAnalysis[],
  developerId: string
): CapacityAnalysis | null {
  return analyses.find((a) => a.developerId === developerId) ?? null;
}

/**
 * Fields a developer may change on their own task. Anything else — most
 * importantly `assignedDeveloperId`, which would let them hand work to a peer
 * or steal it — is rejected outright rather than silently ignored, so the
 * caller gets a 403 instead of a confusing no-op.
 */
export const DEVELOPER_TASK_UPDATE_FIELDS = [
  "status",
  "actualHours",
  "completedAt",
] as const;

/**
 * Returns the keys a developer isn't allowed to set. Kept pure — the caller
 * decides the HTTP consequence — so this module never depends on the request
 * layer and stays trivially unit-testable.
 */
export function disallowedDeveloperTaskFields(
  body: Record<string, unknown>
): string[] {
  const allowed = new Set<string>(DEVELOPER_TASK_UPDATE_FIELDS);
  return Object.keys(body).filter((k) => !allowed.has(k));
}
