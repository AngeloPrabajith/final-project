"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useDeleteProject } from "@/hooks/use-projects";
import { toast } from "sonner";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  const deleteProject = useDeleteProject();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this project? All sprints and tasks will be removed."))
      return;
    try {
      await deleteProject.mutateAsync(project.id);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{project.name}</CardTitle>
            {project.description && (
              <CardDescription>{project.description}</CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">
            {project.sprints?.length ?? 0} sprint
            {(project.sprints?.length ?? 0) !== 1 ? "s" : ""}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
