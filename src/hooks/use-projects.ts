"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Project, CreateProjectInput } from "@/types";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: ["projects", id],
    queryFn: () => api.get(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) =>
      api.post<Project>("/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateProjectInput> & { id: string }) =>
      api.put<Project>(`/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export interface VelocityDataPoint {
  sprintId: string;
  sprintName: string;
  totalHours: number;
  completedHours: number;
  completionRate: number;
}

export function useVelocity(projectId: string) {
  return useQuery<VelocityDataPoint[]>({
    queryKey: ["velocity", projectId],
    queryFn: () => api.get(`/projects/${projectId}/velocity`),
    enabled: !!projectId,
  });
}
