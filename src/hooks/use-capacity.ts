"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  SprintCapacityResponse,
  ClientDashboard,
  DashboardResponse,
  DeveloperDashboard,
  ManagerDashboard,
  SimulationResult,
} from "@/types";

export function useCapacity(sprintId: string) {
  return useQuery<SprintCapacityResponse>({
    queryKey: ["capacity", sprintId],
    queryFn: () => api.get(`/sprints/${sprintId}/capacity`),
    enabled: !!sprintId,
  });
}

export function useSimulation(
  sprintId: string,
  developerId: string,
  hours: number
) {
  return useQuery<SimulationResult>({
    queryKey: ["simulation", sprintId, developerId, hours],
    queryFn: () =>
      api.get(
        `/sprints/${sprintId}/capacity?simulateDeveloperId=${developerId}&simulateHours=${hours}`
      ),
    enabled: !!sprintId && !!developerId && hours > 0,
  });
}

/**
 * `/api/dashboard` returns a different shape per role, discriminated on
 * `kind`. The three typed wrappers below narrow it so each page can only read
 * the fields its own role actually receives — a manager component can't
 * accidentally reach for `capacitySummary` on a client's payload.
 */
export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
  });
}

export function useManagerDashboard() {
  const query = useDashboard();
  return {
    ...query,
    data: query.data?.kind === "manager" ? query.data : undefined,
  } as typeof query & { data: ManagerDashboard | undefined };
}

export function useDeveloperDashboard() {
  const query = useDashboard();
  return {
    ...query,
    data: query.data?.kind === "developer" ? query.data : undefined,
  } as typeof query & { data: DeveloperDashboard | undefined };
}

export function useClientDashboard() {
  const query = useDashboard();
  return {
    ...query,
    data: query.data?.kind === "client" ? query.data : undefined,
  } as typeof query & { data: ClientDashboard | undefined };
}
