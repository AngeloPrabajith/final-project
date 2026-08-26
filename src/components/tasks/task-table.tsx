"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { TaskForm } from "./task-form";
import { ActualHoursPrompt } from "./actual-hours-prompt";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@/types";
import { TASK_STATUSES, isTerminalStatus } from "@/lib/task-statuses";

function priorityConfig(priority: string) {
  switch (priority) {
    case "critical":
      return { label: "Critical", className: "bg-red-100 text-red-700 border-red-200", order: 0 };
    case "high":
      return { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200", order: 1 };
    case "low":
      return { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200", order: 3 };
    default:
      return { label: "Medium", className: "bg-blue-100 text-blue-700 border-blue-200", order: 2 };
  }
}

type SortField = "title" | "assignee" | "hours" | "priority";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="size-3 opacity-40 ml-1 inline" />;
  return sortDir === "asc"
    ? <ArrowUp className="size-3 ml-1 inline text-primary" />
    : <ArrowDown className="size-3 ml-1 inline text-primary" />;
}

/**
 * `manage` is the manager view: every column, edit and delete, task creation
 * handled by the parent page.
 *
 * `personal` is the developer's "My Work" view: the assignee column is
 * replaced by the sprint the task belongs to (they are all the same person, so
 * the assignee column says nothing), and edit/delete are hidden because the
 * API rejects those for developers anyway. The status dropdown and the
 * actual-hours prompt are identical in both — that flow is the one thing least
 * worth duplicating.
 */
export function TaskTable({
  tasks,
  sprintId,
  mode = "manage",
}: {
  tasks: Task[];
  sprintId?: string;
  mode?: "manage" | "personal";
}) {
  const isPersonal = mode === "personal";
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pendingDone, setPendingDone] = useState<Task | null>(null);

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (isTerminalStatus(status) && !isTerminalStatus(task.status)) {
      setPendingDone(task);
      return;
    }
    try {
      await updateTask.mutateAsync({ id: task.id, status });
    } catch {
      toast.error("Failed to update task");
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
      toast.success("Task marked done");
    } catch {
      toast.error("Failed to update task");
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
      toast.error("Failed to update task");
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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = tasks
    .filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.assignedDeveloper?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "title") return dir * a.title.localeCompare(b.title);
      if (sortField === "assignee") {
        const aName = isPersonal
          ? a.sprint?.name ?? ""
          : a.assignedDeveloper?.name ?? "";
        const bName = isPersonal
          ? b.sprint?.name ?? ""
          : b.assignedDeveloper?.name ?? "";
        return dir * aName.localeCompare(bName);
      }
      if (sortField === "hours") return dir * (a.estimatedHours - b.estimatedHours);
      if (sortField === "priority") {
        const aOrder = priorityConfig(a.priority ?? "medium").order;
        const bOrder = priorityConfig(b.priority ?? "medium").order;
        return dir * (aOrder - bOrder);
      }
      return 0;
    });

  return (
    <div className="grid gap-3">
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="h-8 w-[160px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {tasks.length === 0
            ? isPersonal
              ? "You have no tasks assigned right now."
              : "No tasks in this sprint yet."
            : "No tasks match your filter."}
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort("title")}
                >
                  Title <SortIcon field="title" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort("assignee")}
                >
                  {isPersonal ? "Sprint" : "Assignee"}{" "}
                  <SortIcon field="assignee" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort("hours")}
                >
                  Hours <SortIcon field="hours" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort("priority")}
                >
                  Priority <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                {!isPersonal && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task) => {
                const pc = priorityConfig(task.priority ?? "medium");
                return (
                  <TableRow key={task.id} className={isTerminalStatus(task.status) ? "opacity-60" : ""}>
                    <TableCell className="font-medium max-w-[360px]">
                      <div className="leading-snug">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground font-normal line-clamp-1 mt-0.5">
                          {task.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPersonal ? (
                        <span className="text-sm">
                          {task.sprint?.name ?? "—"}
                        </span>
                      ) : (
                        task.assignedDeveloper?.name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right">{task.estimatedHours}h</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${pc.className}`}>
                        {pc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.type === "adhoc" ? "destructive" : "secondary"}>
                        {task.type === "adhoc" ? "Ad-hoc" : "Planned"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(v) =>
                          v && handleStatusChange(task, v as TaskStatus)
                        }
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {!isPersonal && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEdit(task)}
                            className="text-muted-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDelete(task.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editingTask && sprintId && (
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
    </div>
  );
}
