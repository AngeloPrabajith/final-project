"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CapacityAnalysis } from "@/types";

export function CapacitySummary({
  data,
}: {
  data: CapacityAnalysis[];
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No capacity data available. Create sprints and assign tasks to see
            the overview.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.developerName.split(" ")[0],
    capacity: d.capacityHours,
    assigned: d.assignedHours,
    fill: d.overloadRisk ? "#ef4444" : "#3b82f6",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
              }}
              formatter={(value, name) => [
                `${value}h`,
                name === "capacity" ? "Capacity" : "Assigned",
              ]}
            />
            <Legend />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <Bar
              dataKey="capacity"
              name="Capacity"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="assigned"
              name="Assigned"
              radius={[4, 4, 0, 0]}
              fill="#3b82f6"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
