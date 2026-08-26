"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SprintHealth } from "@/types";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface SprintHealthBadgeProps {
  health: SprintHealth;
}

export function SprintHealthBadge({ health }: SprintHealthBadgeProps) {
  const config = {
    healthy: {
      variant: "default" as const,
      icon: ShieldCheck,
      label: "Healthy",
      className: "bg-green-500 hover:bg-green-500 text-white",
    },
    "at-risk": {
      variant: "secondary" as const,
      icon: ShieldAlert,
      label: "At Risk",
      className: "bg-amber-500 hover:bg-amber-500 text-white",
    },
    overloaded: {
      variant: "destructive" as const,
      icon: ShieldX,
      label: "Overloaded",
      className: "",
    },
  }[health.status];

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-default">
        <Badge variant={config.variant} className={`gap-1.5 ${config.className}`}>
          <Icon className="size-3.5" />
          Sprint Health: {health.score}/100
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px] text-xs">
        <p className="font-medium mb-1">{config.label}</p>
        <p className="text-muted-foreground">{health.recommendation}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">Avg utilisation</span>
          <span>{health.averageUtilization}%</span>
          <span className="text-muted-foreground">Overloaded</span>
          <span>{health.overloadedDeveloperCount}</span>
          <span className="text-muted-foreground">At risk (≥80%)</span>
          <span>{health.atRiskDeveloperCount}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
