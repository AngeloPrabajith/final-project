"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderKanban, Zap, Users, AlertTriangle } from "lucide-react";
import type { DashboardStats } from "@/types";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      title: "Total Projects",
      value: stats.totalProjects,
      icon: FolderKanban,
    },
    {
      title: "Active Sprints",
      value: stats.activeSprints,
      icon: Zap,
    },
    {
      title: "Developers",
      value: stats.totalDevelopers,
      icon: Users,
    },
    {
      title: "Overloaded",
      value: stats.overloadedDevelopers,
      icon: AlertTriangle,
      danger: stats.overloadedDevelopers > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon
              className={`size-4 ${
                card.danger
                  ? "text-red-500"
                  : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card.danger ? "text-red-500" : ""
              }`}
            >
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
