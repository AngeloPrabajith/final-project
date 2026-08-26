"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useUpdateTask } from "@/hooks/use-tasks";
import { toast } from "sonner";
import type { CapacityAnalysis, Task } from "@/types";
import { computeSuggestions, type Suggestion } from "@/services/rebalancing.service";

interface Props {
  capacity: CapacityAnalysis[];
  tasks: Task[];
}

export function RebalancingSuggestions({ capacity, tasks }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const updateTask = useUpdateTask();

  const suggestions = computeSuggestions(capacity, tasks);
  if (suggestions.length === 0) return null;

  async function applySuggestion(s: Suggestion) {
    try {
      await updateTask.mutateAsync({ id: s.taskId, assignedDeveloperId: s.toDevId });
      setApplied((prev) => new Set(prev).add(s.taskId));
      toast.success(`"${s.taskTitle}" reassigned to ${s.toDev}`);
    } catch {
      toast.error("Failed to reassign task");
    }
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-amber-500" />
            Rebalancing Suggestions
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              {suggestions.length}
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
        {!expanded && (
          <p className="text-xs text-muted-foreground">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} to reduce overload
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="grid gap-2">
          <p className="text-xs text-muted-foreground mb-1">
            Moving these tasks would reduce overload without adding risk to other developers.
          </p>
          {suggestions.map((s) => {
            const isApplied = applied.has(s.taskId);
            return (
              <div
                key={s.taskId}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-opacity ${
                  isApplied ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">"{s.taskTitle}"</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{s.taskHours}h</span>
                    <span>·</span>
                    <span className="capitalize">{s.taskPriority} priority</span>
                    <span>·</span>
                    <span className="font-medium text-foreground">{s.fromDev}</span>
                    <ArrowRight className="size-3" />
                    <span className="font-medium text-foreground">{s.toDev}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.fromDev} → {s.fromUtilAfter}% &nbsp;|&nbsp; {s.toDev} → {s.toUtilAfter}%
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isApplied ? "secondary" : "default"}
                  className="shrink-0 h-7 text-xs"
                  disabled={isApplied || updateTask.isPending}
                  onClick={() => applySuggestion(s)}
                >
                  {isApplied ? (
                    <>
                      <Check className="size-3 mr-1" />
                      Applied
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
