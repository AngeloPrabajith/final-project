"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Developer,
  CreateDeveloperInput,
  EstimationAccuracy,
} from "@/types";

export function useDevelopers() {
  return useQuery<Developer[]>({
    queryKey: ["developers"],
    queryFn: () => api.get("/developers"),
  });
}

export function useCreateDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDeveloperInput) =>
      api.post<Developer>("/developers", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["developers"] }),
  });
}

export function useUpdateDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: Partial<CreateDeveloperInput> & { id: string }) =>
      api.put<Developer>(`/developers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["developers"] }),
  });
}

export function useDeleteDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/developers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["developers"] }),
  });
}

export function useAllAccuracies() {
  return useQuery<EstimationAccuracy[]>({
    queryKey: ["accuracy"],
    queryFn: () => api.get("/developers/accuracy"),
  });
}

export function useDeveloperAccuracy(developerId: string | undefined) {
  return useQuery<EstimationAccuracy>({
    queryKey: ["accuracy", developerId],
    queryFn: () => api.get(`/developers/${developerId}/accuracy`),
    enabled: !!developerId,
  });
}
