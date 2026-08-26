"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OverloadBadge } from "./overload-badge";
import { formatHours, formatPercent } from "@/utils/format";
import type { CapacityAnalysis } from "@/types";

export function DeveloperWorkloadTable({
  data,
}: {
  data: CapacityAnalysis[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No capacity data for this sprint.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Developer</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
            <TableHead className="text-right">Assigned</TableHead>
            <TableHead className="text-right">Utilization</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.developerId}
              className={
                row.overloadRisk
                  ? "bg-red-50 dark:bg-red-950/20"
                  : ""
              }
            >
              <TableCell className="font-medium">
                {row.developerName}
              </TableCell>
              <TableCell className="text-right">
                {formatHours(row.capacityHours)}
              </TableCell>
              <TableCell className="text-right">
                {formatHours(row.assignedHours)}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  row.overloadRisk ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {formatPercent(row.utilizationPercent)}
              </TableCell>
              <TableCell>
                <OverloadBadge overloaded={row.overloadRisk} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
