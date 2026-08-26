"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, GripVertical, Clock } from "lucide-react";
import type { Task } from "@/types";

const priorityBorder: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-400",
  medium: "border-l-blue-400",
  low: "border-l-gray-300",
};

const priorityBadge: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
      {initials}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onEdit, onDelete, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const borderColor = priorityBorder[task.priority ?? "medium"];
  const badgeClass = priorityBadge[task.priority ?? "medium"];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border border-l-4 bg-card p-3 shadow-sm ${borderColor} ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary/30" : ""
      } transition-shadow hover:shadow-md`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 cursor-grab touch-none opacity-0 transition-opacity group-hover:opacity-40 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </div>

      {/* Title */}
      <p className="pr-6 text-sm font-medium leading-snug">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="pr-6 mt-1 text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeClass}`}>
          {(task.priority ?? "medium").charAt(0).toUpperCase() + (task.priority ?? "medium").slice(1)}
        </Badge>
        {task.type === "adhoc" && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            Ad-hoc
          </Badge>
        )}
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
          <Clock className="size-3" />
          {task.estimatedHours}h
        </span>
      </div>

      {/* Footer: assignee + actions */}
      <div className="mt-2 flex items-center justify-between">
        {task.assignedDeveloper ? (
          <div className="flex items-center gap-1.5">
            <Initials name={task.assignedDeveloper.name} />
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
              {task.assignedDeveloper.name}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">Unassigned</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
