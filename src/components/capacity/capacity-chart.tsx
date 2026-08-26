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
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CapacityAnalysis } from "@/types";

export function CapacityChart({ data }: { data: CapacityAnalysis[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.developerName.split(" ")[0],
    capacity: d.capacityHours,
    assigned: d.assignedHours,
    overloaded: d.overloadRisk,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity vs Assigned Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis
              className="text-xs"
              label={{
                value: "Hours",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
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
            <Bar
              dataKey="capacity"
              name="Capacity"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="assigned" name="Assigned" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.overloaded ? "#ef4444" : "#3b82f6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
