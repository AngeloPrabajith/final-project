"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import { ActualHoursPrompt } from "./actual-hours-prompt";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@/types";
import {
  TASK_STATUSES,
  DEFAULT_VISIBLE_STATUS_IDS,
  isTerminalStatus,
  type TaskStatusConfig,
} from "@/lib/task-statuses";
import { Columns3, Check } from "lucide-react";

const VISIBLE_COLUMNS_KEY = "kanban_visible_columns";

function KanbanColumn({
  config,
  tasks,
  onEdit,
  onDelete,
}: {
  config: TaskStatusConfig;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[260px] shrink-0 flex-col rounded-xl border-t-4 ${config.borderClass} ${config.bgClass} ${
        isOver ? "ring-2 ring-primary/40 ring-dashed" : ""
      } transition-all`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-semibold">{config.label}</span>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {tasks.length}
        </Badge>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-3 pt-0 min-h-[120px]">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">
              No tasks
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function ColumnPicker({
  visible,
  onToggle,
}: {
  visible: Set<TaskStatus>;
  onToggle: (id: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const hiddenCount = TASK_STATUSES.length - visible.size;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <Columns3 className="size-3.5" />
        Columns
        {hiddenCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
            {hiddenCount} hidden
          </Badge>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Show columns
          </div>
          {TASK_STATUSES.map((s) => {
            const isChecked = visible.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => onToggle(s.id)}
              >
                <div
                  className={`flex size-4 items-center justify-center rounded border ${
                    isChecked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {isChecked && <Check className="size-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {s.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TaskKanbanProps {
  tasks: Task[];
  sprintId: string;
}

export function TaskKanban({ tasks, sprintId }: TaskKanbanProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDone, setPendingDone] = useState<Task | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<TaskStatus>>(
    () => new Set(DEFAULT_VISIBLE_STATUS_IDS)
  );

  // Hydrate column visibility from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TaskStatus[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((id) =>
          TASK_STATUSES.some((s) => s.id === id)
        ) as TaskStatus[];
        if (valid.length > 0) setVisibleColumns(new Set(valid));
      }
    } catch {
      // Ignore corrupt preference.
    }
  }, []);

  function toggleColumn(id: TaskStatus) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) {
        next.delete(id); // enforce: at least one column always visible
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  // Any task in a column we've hidden stays in the data but is tallied separately.
  const hiddenColumnTaskCount = TASK_STATUSES.filter(
    (s) => !visibleColumns.has(s.id)
  ).reduce((sum, s) => sum + tasksByStatus(s.id).length, 0);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const targetStatus =
      (TASK_STATUSES.find((c) => c.id === over.id)?.id as TaskStatus | undefined) ??
      tasks.find((t) => t.id === over.id)?.status;

    if (!targetStatus || targetStatus === draggedTask.status) return;

    if (isTerminalStatus(targetStatus) && !isTerminalStatus(draggedTask.status)) {
      setPendingDone(draggedTask);
      return;
    }

    try {
      await updateTask.mutateAsync({ id: draggedTask.id, status: targetStatus });
    } catch {
      toast.error("Failed to update task status");
    }
  }

  async function confirmDoneWithActual(actualHours: number) {
    if (!pendingDone) return;
    try {
      await updateTask.mutateAsync({
        id: pendingDone.id,
        status: "done",
        actualHours,
        completedAt: new Date().toISOString(),
      });
      toast.success("Task released to prod");
    } catch {
      toast.error("Failed to update task status");
    } finally {
      setPendingDone(null);
    }
  }

  async function skipActualHours() {
    if (!pendingDone) return;
    try {
      await updateTask.mutateAsync({
        id: pendingDone.id,
        status: "done",
        completedAt: new Date().toISOString(),
      });
    } catch {
      toast.error("Failed to update task status");
    } finally {
      setPendingDone(null);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditOpen(true);
  }

  const visibleColumnConfigs = TASK_STATUSES.filter((s) =>
    visibleColumns.has(s.id)
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-end gap-2">
        {hiddenColumnTaskCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {hiddenColumnTaskCount} task{hiddenColumnTaskCount !== 1 ? "s" : ""} in
            hidden columns
          </span>
        )}
        <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} />
      </div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {visibleColumnConfigs.map((config) => (
            <KanbanColumn
              key={config.id}
              config={config}
              tasks={tasksByStatus(config.id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-1 opacity-90">
              <TaskCard
                task={activeTask}
                onEdit={() => {}}
                onDelete={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>

        {editingTask && (
          <TaskForm
            sprintId={sprintId}
            task={editingTask}
            open={editOpen}
            onOpenChange={(o) => {
              setEditOpen(o);
              if (!o) setEditingTask(null);
            }}
          />
        )}

        <ActualHoursPrompt
          open={!!pendingDone}
          taskTitle={pendingDone?.title ?? ""}
          estimatedHours={pendingDone?.estimatedHours ?? 0}
          onConfirm={confirmDoneWithActual}
          onSkip={skipActualHours}
          onCancel={() => setPendingDone(null)}
        />
      </DndContext>
    </div>
  );
}
