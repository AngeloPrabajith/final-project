"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CircleDot, CalendarRange } from "lucide-react";
import { useSprints } from "@/hooks/use-sprints";

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function ActiveSprints() {
  const { data: sprints, isLoading } = useSprints();

  if (isLoading) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const now = new Date();
  const active = (sprints ?? [])
    .filter((s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return now >= start && now <= end;
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  if (active.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CircleDot className="size-4 text-emerald-500" />
          Active Sprints
          <Badge variant="outline" className="text-xs tabular-nums">
            {active.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          In-flight sprints — jump straight to the board.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {active.map((sprint) => {
          const start = new Date(sprint.startDate);
          const end = new Date(sprint.endDate);
          const total = daysBetween(start, end);
          const elapsed = Math.min(total, daysBetween(start, now));
          const pct = Math.round((elapsed / total) * 100);
          return (
            <Link
              key={sprint.id}
              href={`/sprints/${sprint.id}`}
              className="group grid gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{sprint.name}</div>
                  {sprint.project && (
                    <div className="truncate text-xs text-muted-foreground">
                      {sprint.project.name}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarRange className="size-3" />
                <span>{formatRange(sprint.startDate, sprint.endDate)}</span>
                <span className="ml-auto tabular-nums">
                  Day {elapsed}/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
