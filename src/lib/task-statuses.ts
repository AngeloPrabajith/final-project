import type { TaskStatus } from "@/types";

export interface TaskStatusConfig {
  id: TaskStatus;
  label: string;
  /** Column header tint (Tailwind top-border class) */
  borderClass: string;
  /** Column background tint */
  bgClass: string;
  /** Whether this status is considered "completed" for capacity / accuracy purposes */
  isTerminal: boolean;
  /** Visible by default on the Kanban board (users can still hide/show any) */
  defaultVisible: boolean;
  /** Short description for the column-picker tooltip / form helper */
  description: string;
}

/**
 * Single source of truth for the workflow states a task can be in.
 * The order here is the order columns render on the Kanban board.
 *
 * NOTE: only `done` is treated as terminal by the capacity engine, burndown,
 * and estimation-accuracy service. Everything else counts as "active" and
 * consumes capacity. Pausing a task does not release its capacity — that is
 * deliberate: a paused task is still assigned to the developer.
 */
export const TASK_STATUSES: TaskStatusConfig[] = [
  {
    id: "backlog",
    label: "Backlog",
    borderClass: "border-t-slate-300",
    bgClass: "bg-slate-50/50 dark:bg-slate-900/30",
    isTerminal: false,
    defaultVisible: true,
    description: "Committed to this sprint but not yet picked up.",
  },
  {
    id: "todo",
    label: "To Do",
    borderClass: "border-t-border",
    bgClass: "bg-muted/30",
    isTerminal: false,
    defaultVisible: true,
    description: "Ready to be started.",
  },
  {
    id: "inprogress",
    label: "In Progress",
    borderClass: "border-t-blue-400",
    bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
    isTerminal: false,
    defaultVisible: true,
    description: "Being actively worked on.",
  },
  {
    id: "paused",
    label: "Paused",
    borderClass: "border-t-amber-400",
    bgClass: "bg-amber-50/40 dark:bg-amber-950/20",
    isTerminal: false,
    defaultVisible: true,
    description: "Blocked or deprioritised; still assigned and consuming capacity.",
  },
  {
    id: "qa",
    label: "QA",
    borderClass: "border-t-violet-400",
    bgClass: "bg-violet-50/50 dark:bg-violet-950/20",
    isTerminal: false,
    defaultVisible: true,
    description: "Code complete, in QA testing.",
  },
  {
    id: "uat",
    label: "UAT",
    borderClass: "border-t-cyan-400",
    bgClass: "bg-cyan-50/50 dark:bg-cyan-950/20",
    isTerminal: false,
    defaultVisible: true,
    description: "Passed QA, with stakeholders for acceptance.",
  },
  {
    id: "readyforprod",
    label: "Ready for Prod",
    borderClass: "border-t-emerald-300",
    bgClass: "bg-emerald-50/40 dark:bg-emerald-950/15",
    isTerminal: false,
    defaultVisible: true,
    description: "Signed off, queued for release.",
  },
  {
    id: "done",
    label: "Released to Prod",
    borderClass: "border-t-emerald-500",
    bgClass: "bg-emerald-50/60 dark:bg-emerald-950/25",
    isTerminal: true,
    defaultVisible: true,
    description: "Shipped. Feeds estimation-accuracy history.",
  },
];

export const TASK_STATUS_BY_ID: Record<TaskStatus, TaskStatusConfig> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.id, s])
) as Record<TaskStatus, TaskStatusConfig>;

export const DEFAULT_VISIBLE_STATUS_IDS: TaskStatus[] = TASK_STATUSES.filter(
  (s) => s.defaultVisible
).map((s) => s.id);

export function statusLabel(status: TaskStatus): string {
  return TASK_STATUS_BY_ID[status]?.label ?? status;
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return TASK_STATUS_BY_ID[status]?.isTerminal ?? false;
}
