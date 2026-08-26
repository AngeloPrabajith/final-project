"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Sprint, SprintCapacityResponse } from "@/types";

interface Props {
  sprints: Sprint[];
}

function utilizationColor(pct: number): string {
  if (pct >= 100) return "bg-red-500 text-white";
  if (pct >= 80) return "bg-amber-400 text-white";
  if (pct >= 60) return "bg-yellow-200 text-yellow-900";
  return "bg-green-100 text-green-800";
}

export function DeveloperCapacityHeatmap({ sprints }: Props) {
  const results = useQueries({
    queries: sprints.map((sprint) => ({
      queryKey: ["capacity", sprint.id],
      queryFn: () => api.get<SprintCapacityResponse>(`/sprints/${sprint.id}/capacity`),
      staleTime: 60_000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  if (isLoading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  // Build a map: developerName → { sprintId → utilizationPct }
  const devMap = new Map<string, Map<string, number>>();

  results.forEach((result, i) => {
    const sprintId = sprints[i].id;
    result.data?.capacity?.forEach((c) => {
      if (!devMap.has(c.developerName)) {
        devMap.set(c.developerName, new Map());
      }
      devMap.get(c.developerName)!.set(sprintId, c.utilizationPercent);
    });
  });

  if (devMap.size === 0) return null;

  const developerNames = Array.from(devMap.keys()).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Developer Utilisation Across Sprints
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pr-3 pb-1 min-w-[120px]">
                Developer
              </th>
              {sprints.map((sprint) => (
                <th
                  key={sprint.id}
                  className="text-center font-medium text-muted-foreground pb-1 min-w-[80px]"
                >
                  <div className="truncate max-w-[80px]" title={sprint.name}>
                    {sprint.name.length > 10
                      ? sprint.name.slice(0, 9) + "…"
                      : sprint.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {developerNames.map((devName) => (
              <tr key={devName}>
                <td className="font-medium pr-3 py-0.5">{devName}</td>
                {sprints.map((sprint) => {
                  const pct = devMap.get(devName)?.get(sprint.id);
                  if (pct === undefined) {
                    return (
                      <td key={sprint.id} className="text-center">
                        <div className="rounded px-2 py-1 bg-muted text-muted-foreground text-center">
                          —
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={sprint.id} className="text-center">
                      <Tooltip>
                        <TooltipTrigger
                          className={`rounded px-2 py-1 font-medium text-center cursor-default w-full ${utilizationColor(pct)}`}
                        >
                          {Math.round(pct)}%
                        </TooltipTrigger>
                        <TooltipContent>
                          {devName} — {sprint.name}: {Math.round(pct)}% utilisation
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-green-100" /> &lt;60%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-yellow-200" /> 60–80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-amber-400" /> 80–100%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-red-500" /> &gt;100% overloaded
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
