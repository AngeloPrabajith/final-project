"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { CapacityChart } from "@/components/capacity/capacity-chart";
import { DeveloperWorkloadTable } from "@/components/capacity/developer-workload-table";
import { AdhocSimulator } from "@/components/capacity/adhoc-simulator";
import { DeveloperCapacityHeatmap } from "@/components/capacity/developer-capacity-heatmap";
import { useCapacity } from "@/hooks/use-capacity";
import { useSprints } from "@/hooks/use-sprints";
import { useDevelopers } from "@/hooks/use-developers";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function CapacityPage() {
  const { data: sprints, isLoading: sprintsLoading } = useSprints();
  const { data: developers } = useDevelopers();
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [overloadFilter, setOverloadFilter] = useState("all");

  const activeSprint = selectedSprintId || sprints?.[0]?.id || "";
  const { data: sprintCapacity, isLoading: capacityLoading } =
    useCapacity(activeSprint);

  const allCapacity = sprintCapacity?.capacity ?? [];
  const filteredCapacity =
    overloadFilter === "overloaded"
      ? allCapacity.filter((c) => c.overloadRisk)
      : overloadFilter === "healthy"
      ? allCapacity.filter((c) => !c.overloadRisk)
      : allCapacity;

  return (
    <>
      <Header title="Capacity Analysis" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label>Sprint</Label>
            {sprintsLoading ? (
              <Skeleton className="h-9 w-[240px]" />
            ) : (
              <Select
                value={activeSprint}
                onValueChange={(v) => setSelectedSprintId(v ?? "")}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a sprint" />
                </SelectTrigger>
                <SelectContent>
                  {sprints?.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                      {sprint.project ? ` (${sprint.project.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Filter</Label>
            <Select
              value={overloadFilter}
              onValueChange={(v) => setOverloadFilter(v ?? "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Developers</SelectItem>
                <SelectItem value="overloaded">Overloaded Only</SelectItem>
                <SelectItem value="healthy">Healthy Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!activeSprint ? (
          <p className="text-muted-foreground">
            No sprints available. Create a project and sprint first.
          </p>
        ) : capacityLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-[350px] rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : sprintCapacity ? (
          <>
            <CapacityChart data={filteredCapacity} />
            <DeveloperWorkloadTable data={filteredCapacity} />
            {developers && (
              <AdhocSimulator
                sprintId={activeSprint}
                developers={developers}
              />
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Failed to load capacity data.
          </p>
        )}

        {sprints && sprints.length > 1 && (
          <DeveloperCapacityHeatmap sprints={sprints} />
        )}
      </div>
    </>
  );
}
