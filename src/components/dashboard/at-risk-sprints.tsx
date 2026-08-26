"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users } from "lucide-react";
import type { AtRiskSprint } from "@/types";

export function AtRiskSprints({ sprints }: { sprints: AtRiskSprint[] }) {
  if (sprints.length === 0) return null;

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ShieldAlert className="size-5 text-amber-500" />
        At-Risk Sprints
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sprints.map((sprint) => (
          <Card key={sprint.id} className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">
                    <Link href={`/sprints/${sprint.id}`} className="hover:underline">
                      {sprint.name}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{sprint.projectName}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${
                    sprint.health.score < 40
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}
                >
                  {sprint.health.score}/100
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              {sprint.health.overloadedDeveloperCount} overloaded developer{sprint.health.overloadedDeveloperCount !== 1 ? "s" : ""}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
