"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVelocity } from "@/hooks/use-projects";
import { TrendingUp } from "lucide-react";

export function VelocityChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = useVelocity(projectId);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (!data || data.length === 0) return null;

  // Need at least one sprint with data
  const hasData = data.some((d) => d.totalHours > 0);
  if (!hasData) return null;

  const avgVelocity =
    data.reduce((sum, d) => sum + d.completedHours, 0) / data.length;

  const chartData = data.map((d) => ({
    name: d.sprintName.length > 12 ? d.sprintName.slice(0, 11) + "…" : d.sprintName,
    fullName: d.sprintName,
    planned: d.totalHours,
    completed: d.completedHours,
    rate: d.completionRate,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Sprint Velocity</CardTitle>
            <CardDescription className="text-xs">
              Planned vs completed hours across sprints — avg {Math.round(avgVelocity)}h completed per sprint
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis
              className="text-xs"
              tick={{ fontSize: 11 }}
              label={{
                value: "Hours",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) => {
                if (name === "completion") return [`${value}%`, "Completion Rate"];
                return [`${value}h`, name === "planned" ? "Planned" : "Completed"];
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={avgVelocity}
              stroke="#f59e0b"
              strokeDasharray="5 3"
              label={{
                value: `Avg ${Math.round(avgVelocity)}h`,
                position: "insideTopRight",
                style: { fontSize: 10, fill: "#f59e0b" },
              }}
            />
            <Bar dataKey="planned" name="planned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="completed" fill="#22c55e" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="rate"
                position="top"
                formatter={(v: unknown) => typeof v === "number" && v > 0 ? `${v}%` : ""}
                style={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              />
            </Bar>
            <Line
              type="monotone"
              dataKey="completed"
              name="completion"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              hide
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
