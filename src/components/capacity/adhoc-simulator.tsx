"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSimulation } from "@/hooks/use-capacity";
import { formatHours, formatPercent } from "@/utils/format";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Developer } from "@/types";

export function AdhocSimulator({
  sprintId,
  developers,
}: {
  sprintId: string;
  developers: Developer[];
}) {
  const [developerId, setDeveloperId] = useState("");
  const [hours, setHours] = useState("");
  const [shouldSimulate, setShouldSimulate] = useState(false);

  const { data: result, isLoading } = useSimulation(
    shouldSimulate ? sprintId : "",
    shouldSimulate ? developerId : "",
    shouldSimulate ? parseFloat(hours) || 0 : 0
  );

  function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    if (developerId && hours) {
      setShouldSimulate(true);
    }
  }

  function handleReset() {
    setDeveloperId("");
    setHours("");
    setShouldSimulate(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ad-hoc Task Simulator</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Test the impact of adding a task before committing. Select a developer
          and enter hours to see projected capacity changes.
        </p>
        <form onSubmit={handleSimulate} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="grid gap-2">
            <Label>Developer</Label>
            <Select
              value={developerId}
              onValueChange={(v) => {
                setDeveloperId(v ?? "");
                setShouldSimulate(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select developer" />
              </SelectTrigger>
              <SelectContent>
                {developers.map((dev) => (
                  <SelectItem key={dev.id} value={dev.id}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Additional Hours</Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={hours}
              onChange={(e) => {
                setHours(e.target.value);
                setShouldSimulate(false);
              }}
              placeholder="e.g. 10"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!developerId || !hours || isLoading}>
              {isLoading ? "Simulating..." : "Simulate"}
            </Button>
            {shouldSimulate && (
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </form>

        {result && (
          <div className="space-y-3">
            {result.wouldCauseOverload && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Adding {hours}h would overload this developer!
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-4 rounded-lg border p-4 text-sm">
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-foreground">Before</div>
                <div className="text-lg font-semibold">
                  {formatHours(result.before.assignedHours)}
                </div>
                <div className="text-xs text-muted-foreground">
                  of {formatHours(result.before.capacityHours)} (
                  {formatPercent(result.before.utilizationPercent)})
                </div>
              </div>
              <ArrowRight className="size-5 text-muted-foreground" />
              <div
                className={`flex-1 text-center ${
                  result.after.overloadRisk ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                }`}
              >
                <div className="text-xs text-muted-foreground">After</div>
                <div className="text-lg font-semibold">
                  {formatHours(result.after.assignedHours)}
                </div>
                <div className="text-xs">
                  of {formatHours(result.after.capacityHours)} (
                  {formatPercent(result.after.utilizationPercent)})
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
