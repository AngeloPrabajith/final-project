"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useDevelopers } from "@/hooks/use-developers";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Task, TaskType, TaskPriority } from "@/types";

interface TaskFormProps {
  sprintId: string;
  task?: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskForm({ sprintId, task, open: controlledOpen, onOpenChange }: TaskFormProps) {
  const isEditing = !!task;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [title, setTitle] = useState(task?.title ?? "");
  const [estimatedHours, setEstimatedHours] = useState(String(task?.estimatedHours ?? ""));
  const [type, setType] = useState<TaskType>(task?.type ?? "planned");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [developerId, setDeveloperId] = useState(task?.assignedDeveloperId ?? "");

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: developers } = useDevelopers();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setEstimatedHours(String(task.estimatedHours));
      setType(task.type);
      setPriority(task.priority ?? "medium");
      setDeveloperId(task.assignedDeveloperId ?? "");
    }
  }, [task?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEditing && task) {
        await updateTask.mutateAsync({
          id: task.id,
          title,
          estimatedHours: parseFloat(estimatedHours),
          type,
          priority,
          assignedDeveloperId: developerId || null,
        });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync({
          title,
          estimatedHours: parseFloat(estimatedHours),
          type,
          priority,
          sprintId,
          assignedDeveloperId: developerId || undefined,
        });
        toast.success("Task created");
        setTitle("");
        setEstimatedHours("");
        setType("planned");
        setPriority("medium");
        setDeveloperId("");
      }
      setOpen(false);
    } catch {
      toast.error(isEditing ? "Failed to update task" : "Failed to create task");
    }
  }

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditing && (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" data-icon="inline-start" />
          Add Task
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-hours">Estimated Hours</Label>
              <Input
                id="task-hours"
                type="number"
                min="0.5"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="8"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="adhoc">Ad-hoc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => v && setPriority(v as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Assign Developer</Label>
            <Select value={developerId} onValueChange={(v) => setDeveloperId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned">
                  {(value: string) => {
                    if (!value) return "Unassigned";
                    const dev = developers?.find((d) => d.id === value);
                    return dev ? `${dev.name} (${dev.weeklyCapacityHours}h/wk)` : "Unassigned";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {developers?.map((dev) => (
                  <SelectItem key={dev.id} value={dev.id}>
                    {dev.name} ({dev.weeklyCapacityHours}h/wk)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing ? "Saving..." : "Creating..."
              : isEditing ? "Save Changes" : "Add Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
