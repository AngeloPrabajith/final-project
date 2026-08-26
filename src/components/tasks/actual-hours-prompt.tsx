"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  taskTitle: string;
  estimatedHours: number;
  onConfirm: (actualHours: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function ActualHoursPrompt(props: Props) {
  // Re-mount on each new task so internal state is reset automatically.
  return <ActualHoursPromptInner {...props} key={`${props.open}-${props.taskTitle}`} />;
}

function ActualHoursPromptInner({
  open,
  taskTitle,
  estimatedHours,
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const [hours, setHours] = useState<string>(String(estimatedHours));

  function handleConfirm() {
    const parsed = parseFloat(hours);
    if (isNaN(parsed) || parsed <= 0) return;
    onConfirm(parsed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            How long did it take?
          </DialogTitle>
          <DialogDescription className="text-xs">
            Recording actual hours for &quot;{taskTitle}&quot; lets the system learn this developer&apos;s estimation accuracy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="actual-hours">Actual hours</Label>
            <Input
              id="actual-hours"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Estimated: {estimatedHours}h
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Record hours
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
