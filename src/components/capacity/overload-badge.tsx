"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";

export function OverloadBadge({ overloaded }: { overloaded: boolean }) {
  if (overloaded) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        Overloaded
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400">
      <CheckCircle className="size-3" />
      Healthy
    </Badge>
  );
}
