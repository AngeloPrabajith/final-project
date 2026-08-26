"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { SprintForm } from "@/components/sprints/sprint-form";
import { VelocityChart } from "@/components/projects/velocity-chart";
import { useProject } from "@/hooks/use-projects";
import { useDeleteSprint } from "@/hooks/use-sprints";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { formatDateRange } from "@/utils/format";
import { toast } from "sonner";
import { useState } from "react";
import type { Sprint } from "@/types";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading } = useProject(id);
  const deleteSprint = useDeleteSprint();
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function handleDeleteSprint(sprintId: string) {
    if (!confirm("Delete this sprint and all its tasks?")) return;
    try {
      await deleteSprint.mutateAsync(sprintId);
      toast.success("Sprint deleted");
    } catch {
      toast.error("Failed to delete sprint");
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="Project" />
        <div className="p-6">
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Project" />
        <div className="p-6">
          <p className="text-muted-foreground">Project not found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={project.name} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          {project.description && (
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sprints</h2>
          <SprintForm projectId={project.id} />
        </div>

        {project.sprints && project.sprints.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {project.sprints.map((sprint) => (
              <Card key={sprint.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>
                      <Link
                        href={`/sprints/${sprint.id}`}
                        className="hover:underline"
                      >
                        {sprint.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {formatDateRange(sprint.startDate, sprint.endDate)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => { setEditingSprint(sprint as Sprint); setEditOpen(true); }}
                      className="text-muted-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteSprint(sprint.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    <Link href={`/sprints/${sprint.id}`}>View Sprint</Link>
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">No sprints yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first sprint to start planning capacity.
            </p>
          </div>
        )}

        <VelocityChart projectId={project.id} />

        {editingSprint && (
          <SprintForm
            projectId={project.id}
            sprint={editingSprint}
            open={editOpen}
            onOpenChange={(o) => {
              setEditOpen(o);
              if (!o) setEditingSprint(null);
            }}
          />
        )}
      </div>
    </>
  );
}
