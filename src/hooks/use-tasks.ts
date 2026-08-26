"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Task, CreateTaskInput, UpdateTaskInput, SprintCapacityResponse } from "@/types";

export function useTasks(sprintId?: string) {
  const params = sprintId ? `?sprintId=${sprintId}` : "";
  return useQuery<Task[]>({
    queryKey: ["tasks", sprintId],
    queryFn: () => api.get(`/tasks${params}`),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post<Task>("/tasks", data),
    onSuccess: async (_, variables) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["forecast"] });

      // Check if task creation caused any overloads (respects user notification preference)
      try {
        const raw = localStorage.getItem("sprint_defaults");
        const prefs = raw ? JSON.parse(raw) : null;
        if (prefs?.overloadWarnings === false) {
          qc.invalidateQueries({ queryKey: ["capacity"] });
          return;
        }
        const sprintCapacity = await api.get<SprintCapacityResponse>(
          `/sprints/${variables.sprintId}/capacity`
        );
        // `capacity` is omitted for non-manager callers; they can't create
        // tasks anyway, so there is simply nothing to warn about.
        const overloaded = (sprintCapacity.capacity ?? []).filter(
          (c) => c.overloadRisk
        );
        if (overloaded.length > 0) {
          const names = overloaded.map((c) => c.developerName).join(", ");
          toast.warning(
            `Overload detected: ${names} ${overloaded.length === 1 ? "is" : "are"} now over effective capacity. Consider reassigning tasks.`,
            { duration: 6000 }
          );
        }
      } catch {
        // Silently ignore — capacity check is non-critical
      }

      qc.invalidateQueries({ queryKey: ["capacity"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTaskInput & { id: string }) =>
      api.put<Task>(`/tasks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["capacity"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["forecast"] });
      qc.invalidateQueries({ queryKey: ["accuracy"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["capacity"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["forecast"] });
      qc.invalidateQueries({ queryKey: ["accuracy"] });
    },
  });
}
