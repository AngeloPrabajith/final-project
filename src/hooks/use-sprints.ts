"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
  SprintForecast,
  ForecastEvaluationSummary,
} from "@/types";

export function useSprints(projectId?: string) {
  const params = projectId ? `?projectId=${projectId}` : "";
  return useQuery<Sprint[]>({
    queryKey: ["sprints", projectId],
    queryFn: () => api.get(`/sprints${params}`),
  });
}

export function useSprint(id: string) {
  return useQuery<Sprint>({
    queryKey: ["sprints", id],
    queryFn: () => api.get(`/sprints/${id}`),
    enabled: !!id,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSprintInput) =>
      api.post<Sprint>("/sprints", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSprintInput & { id: string }) =>
      api.put<Sprint>(`/sprints/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["capacity"] });
    },
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sprints/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useForecast(sprintId: string | undefined) {
  return useQuery<SprintForecast>({
    queryKey: ["forecast", sprintId],
    queryFn: () => api.get(`/sprints/${sprintId}/forecast`),
    enabled: !!sprintId,
  });
}

export function useForecastEvaluation() {
  return useQuery<ForecastEvaluationSummary>({
    queryKey: ["evaluation"],
    queryFn: () => api.get("/evaluation/forecast"),
  });
}
