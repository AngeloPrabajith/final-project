"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectProgressCard } from "@/components/client/project-progress-card";
import { useClientDashboard } from "@/hooks/use-capacity";

/**
 * The client's landing screen: delivery progress for the projects they've been
 * granted, and nothing else. There is no route from here into a sprint board,
 * a capacity page or a developer list.
 */
export default function PortfolioPage() {
  const { data, isLoading } = useClientDashboard();

  if (isLoading) {
    return (
      <>
        <Header title="Delivery" />
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  const projects = data?.projects ?? [];

  return (
    <>
      <Header title="Delivery" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">No projects yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Your account doesn&apos;t have access to any projects yet. Your
              project manager can grant access from Team &amp; Access.
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Progress on {projects.length === 1 ? "your project" : "your projects"}.
              Figures update as work is completed.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectProgressCard key={p.projectId} project={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
