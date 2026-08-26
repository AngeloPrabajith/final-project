"use client";

import Link from "next/link";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForecastEvaluation } from "@/hooks/use-sprints";
import type { ForecastOutcome, ForecastRiskBand } from "@/types";
import { LineChart as LineChartIcon, Target, ArrowRight } from "lucide-react";

const OUTCOME_TONES: Record<ForecastOutcome, string> = {
  met: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  partial:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  missed:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

const BAND_TONES: Record<ForecastRiskBand, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  moderate:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
  critical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

const BAND_LABEL: Record<ForecastRiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

const OUTCOME_LABEL: Record<ForecastOutcome, string> = {
  met: "Met",
  partial: "Partial",
  missed: "Missed",
};

export default function EvaluationPage() {
  const { data, isLoading } = useForecastEvaluation();

  if (isLoading) {
    return (
      <>
        <Header title="Forecast Evaluation" />
        <div className="p-6">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </>
    );
  }

  if (!data || data.totalSprints === 0) {
    return (
      <>
        <Header title="Forecast Evaluation" />
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No completed sprints yet</CardTitle>
              <CardDescription>
                Forecast calibration becomes meaningful once sprints have ended. Seed the demo
                data or finish a sprint to populate this view.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  const chartData = data.evaluations.map((e) => ({
    name:
      e.sprintName.length > 18 ? e.sprintName.slice(0, 17) + "…" : e.sprintName,
    fullName: e.sprintName,
    predicted: e.predictedProbability,
    actualCompletion: Math.round(e.actualCompletionRate * 100),
    outcome: e.outcome,
  }));

  const overallHitRate =
    data.totalSprints === 0
      ? 0
      : Math.round((data.hitCount / data.totalSprints) * 100);

  return (
    <>
      <Header title="Forecast Evaluation" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Summary card */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Sprints evaluated</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {data.totalSprints}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Correct alarms</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-emerald-600">
                {data.hitCount}
              </CardTitle>
              <CardDescription className="text-[10px]">
                Predicted high/critical AND actually slipped.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">False alarms</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-amber-600">
                {data.falseAlarmCount}
              </CardTitle>
              <CardDescription className="text-[10px]">
                Predicted high/critical but the sprint met its commitment.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Missed alarms</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-red-600">
                {data.missedAlarmCount}
              </CardTitle>
              <CardDescription className="text-[10px]">
                Predicted low/moderate but the sprint actually missed.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Methodology card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  Forecast Calibration · {overallHitRate}% alarm precision
                </CardTitle>
                <CardDescription className="text-xs">
                  Each completed sprint is rerun through the same forecast model using only
                  data that existed at sprint start (no leakage). The chart compares the
                  predicted failure probability against what actually happened.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  unit="%"
                  className="text-xs"
                  label={{
                    value: "Predicted failure %",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  className="text-xs"
                  label={{
                    value: "Actual completion %",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName ?? ""
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="left"
                  dataKey="predicted"
                  name="Predicted failure %"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={26}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="actualCompletion"
                  name="Actual completion %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Per-sprint table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineChartIcon className="size-4 text-muted-foreground" />
              Per-sprint detail
            </CardTitle>
            <CardDescription className="text-xs">
              Click any row to inspect the underlying sprint and contributors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sprint</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Predicted</TableHead>
                    <TableHead>Top driver</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.evaluations.map((e) => (
                    <TableRow key={e.sprintId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/sprints/${e.sprintId}`}
                          className="hover:underline"
                        >
                          {e.sprintName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {e.projectName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${BAND_TONES[e.predictedBand]}`}
                          >
                            {BAND_LABEL[e.predictedBand]}
                          </Badge>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {e.predictedProbability}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.topContributor.label} ({e.topContributor.points}pts)
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(e.actualCompletionRate * 100)}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${OUTCOME_TONES[e.outcome]}`}
                        >
                          {OUTCOME_LABEL[e.outcome]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sprints/${e.sprintId}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
