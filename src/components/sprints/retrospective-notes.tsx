"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, NotebookPen, Check, Loader2 } from "lucide-react";
import { useUpdateSprint } from "@/hooks/use-sprints";
import type { Sprint } from "@/types";

interface Props {
  sprint: Sprint;
}

type SaveState = "idle" | "saving" | "saved";

export function RetrospectiveNotes({ sprint }: Props) {
  const [expanded, setExpanded] = useState(!!sprint.retrospectiveNotes);
  const [notes, setNotes] = useState(sprint.retrospectiveNotes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const updateSprint = useUpdateSprint();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await updateSprint.mutateAsync({
          id: sprint.id,
          retrospectiveNotes: value,
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("idle");
      }
    },
    [sprint.id, updateSprint]
  );

  function handleChange(value: string) {
    setNotes(value);
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 1000);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <NotebookPen className="size-4 text-muted-foreground" />
            Retrospective Notes
            {notes && !expanded && (
              <span className="text-xs text-muted-foreground font-normal">
                — {notes.slice(0, 60)}{notes.length > 60 ? "…" : ""}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {saveState === "saving" && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
            {saveState === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check className="size-3" /> Saved
              </span>
            )}
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="grid gap-2">
          <Label htmlFor="retro-notes" className="text-xs text-muted-foreground">
            Capture what went well, what could improve, and action items for the next sprint.
          </Label>
          <textarea
            id="retro-notes"
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            rows={5}
            placeholder="What went well? What could be improved? Any blockers or shoutouts?"
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </CardContent>
      )}
    </Card>
  );
}
