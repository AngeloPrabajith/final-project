import type { CapacityAnalysis, Task } from "@/types";

/**
 * Pure rebalancing-suggestion algorithm, extracted from
 * `components/sprints/rebalancing-suggestions.tsx` so it can be unit-tested
 * without rendering. The component imports it from here; behaviour is
 * unchanged.
 *
 * For each overloaded developer: take their non-done tasks lowest-priority
 * first, find the first recipient with enough remaining headroom, and emit at
 * most ONE suggestion per overloaded developer (keeps the panel concise).
 */

export interface Suggestion {
  taskId: string;
  taskTitle: string;
  taskHours: number;
  taskPriority: string;
  fromDev: string;
  toDev: string;
  toDevId: string;
  fromUtilAfter: number;
  toUtilAfter: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function computeSuggestions(
  capacity: CapacityAnalysis[],
  tasks: Task[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const overloaded = capacity.filter((c) => c.overloadRisk);
  if (overloaded.length === 0) return [];

  const underloaded = capacity.filter(
    (c) => !c.overloadRisk && c.effectiveCapacityHours - c.assignedHours > 0
  );
  if (underloaded.length === 0) return [];

  for (const from of overloaded) {
    // Get their moveable tasks (not done, sorted by lowest priority first)
    const moveable = tasks
      .filter(
        (t) =>
          t.assignedDeveloperId === from.developerId &&
          t.status !== "done"
      )
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[b.priority ?? "medium"] ?? 2) -
          (PRIORITY_ORDER[a.priority ?? "medium"] ?? 2)
      );

    for (const task of moveable) {
      // Find a recipient with enough slack
      const recipient = underloaded.find(
        (to) =>
          to.developerId !== from.developerId &&
          to.effectiveCapacityHours - to.assignedHours >= task.estimatedHours
      );
      if (!recipient) continue;

      const fromUtilAfter = Math.round(
        ((from.assignedHours - task.estimatedHours) / from.effectiveCapacityHours) * 100
      );
      const toUtilAfter = Math.round(
        ((recipient.assignedHours + task.estimatedHours) / recipient.effectiveCapacityHours) * 100
      );

      suggestions.push({
        taskId: task.id,
        taskTitle: task.title,
        taskHours: task.estimatedHours,
        taskPriority: task.priority ?? "medium",
        fromDev: from.developerName,
        toDev: recipient.developerName,
        toDevId: recipient.developerId,
        fromUtilAfter,
        toUtilAfter,
      });

      // Only one suggestion per overloaded dev to keep it concise
      break;
    }
  }

  return suggestions;
}
