import { findOverlappingSprintsForDeveloper } from "@/services/sprint.service";

const ALLOCATION_FLOOR = 0.25;
const CONTEXT_SWITCH_PENALTY_PER_EXTRA = 0.2;
const CONTEXT_SWITCH_FLOOR = 0.5;

export interface MultiProjectFactor {
  concurrentSprintCount: number;
  allocationFactor: number;
  contextSwitchFactor: number;
  combinedFactor: number;
  overlappingSprintNames: string[];
}

/**
 * Pure: how much of a developer's nominal capacity is available to a single
 * sprint when they are assigned to N other concurrent sprints. Equal split:
 * 1 / (N + 1). Floored to {@link ALLOCATION_FLOOR} so a developer isn't
 * modelled as having effectively zero capacity per sprint.
 */
export function computeAllocationFactor(concurrentCount: number): number {
  const raw = 1 / (Math.max(0, concurrentCount) + 1);
  return Math.max(ALLOCATION_FLOOR, raw);
}

/**
 * Pure: context-switching penalty. Cohn (2005), Sutherland's *Scrum*, and
 * Weinberg's classic estimate roughly a 20% productivity loss per additional
 * concurrent context. We apply that linearly past the first concurrent sprint
 * (i.e. two concurrent sprints = no penalty; three = 20% off; four = 40% off),
 * floored at {@link CONTEXT_SWITCH_FLOOR}.
 */
export function computeContextSwitchFactor(concurrentCount: number): number {
  const extras = Math.max(0, concurrentCount - 1);
  return Math.max(
    CONTEXT_SWITCH_FLOOR,
    1 - CONTEXT_SWITCH_PENALTY_PER_EXTRA * extras
  );
}

/**
 * Compute the combined multi-project factor for a developer in a target sprint.
 * Returns a fall-through `1.0` factor when the developer has no other concurrent
 * sprints, so the base capacity engine is never penalised in the single-sprint
 * case.
 */
export async function computeMultiProjectFactor(
  developerId: string,
  targetSprintId: string
): Promise<MultiProjectFactor> {
  const overlapping = await findOverlappingSprintsForDeveloper(
    developerId,
    targetSprintId
  );
  const concurrentSprintCount = overlapping.length;
  const allocationFactor = computeAllocationFactor(concurrentSprintCount);
  const contextSwitchFactor = computeContextSwitchFactor(concurrentSprintCount);
  const combinedFactor =
    Math.round(allocationFactor * contextSwitchFactor * 1000) / 1000;
  return {
    concurrentSprintCount,
    allocationFactor: Math.round(allocationFactor * 1000) / 1000,
    contextSwitchFactor: Math.round(contextSwitchFactor * 1000) / 1000,
    combinedFactor,
    overlappingSprintNames: overlapping.map((s) => s.name),
  };
}
