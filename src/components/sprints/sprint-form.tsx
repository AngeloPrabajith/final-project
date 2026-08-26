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
import { useCreateSprint, useUpdateSprint } from "@/hooks/use-sprints";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Sprint } from "@/types";

interface SprintFormProps {
  projectId: string;
  sprint?: Sprint;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SprintForm({ projectId, sprint, open: controlledOpen, onOpenChange }: SprintFormProps) {
  const isEditing = !!sprint;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const toDateInput = (d?: string) => d ? d.slice(0, 10) : "";

  const [name, setName] = useState(sprint?.name ?? "");
  const [startDate, setStartDate] = useState(toDateInput(sprint?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(sprint?.endDate));
  const [bufferPct, setBufferPct] = useState(() => {
    if (sprint) return Math.round((sprint.capacityBuffer ?? 0.2) * 100);
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("sprint_defaults") : null;
      const saved = raw ? JSON.parse(raw) : null;
      return saved?.capacityBuffer ?? 20;
    } catch {
      return 20;
    }
  });

  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setStartDate(toDateInput(sprint.startDate));
      setEndDate(toDateInput(sprint.endDate));
      setBufferPct(Math.round((sprint.capacityBuffer ?? 0.2) * 100));
    }
  }, [sprint?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const capacityBuffer = bufferPct / 100;
    try {
      if (isEditing && sprint) {
        await updateSprint.mutateAsync({
          id: sprint.id,
          name,
          startDate,
          endDate,
          capacityBuffer,
        });
        toast.success("Sprint updated");
      } else {
        await createSprint.mutateAsync({ name, startDate, endDate, projectId, capacityBuffer });
        toast.success("Sprint created");
        setName("");
        setStartDate("");
        setEndDate("");
        setBufferPct(20);
      }
      setOpen(false);
    } catch {
      toast.error(isEditing ? "Failed to update sprint" : "Failed to create sprint");
    }
  }

  const isPending = createSprint.isPending || updateSprint.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditing && (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" data-icon="inline-start" />
          New Sprint
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Sprint" : "Create Sprint"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sprint-start">Start Date</Label>
              <Input
                id="sprint-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sprint-end">End Date</Label>
              <Input
                id="sprint-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sprint-buffer">Capacity Buffer</Label>
              <span className="text-sm font-medium tabular-nums">{bufferPct}%</span>
            </div>
            <input
              id="sprint-buffer"
              type="range"
              min={0}
              max={40}
              step={5}
              value={bufferPct}
              onChange={(e) => setBufferPct(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Developers will be considered overloaded once they exceed{" "}
              <strong>{100 - bufferPct}%</strong> of their sprint capacity. Leaving a buffer accounts
              for meetings, code review, and ad-hoc work.
            </p>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing ? "Saving..." : "Creating..."
              : isEditing ? "Save Changes" : "Create Sprint"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
