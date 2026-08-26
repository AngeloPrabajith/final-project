"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ClientProjectDetail } from "@/types";

/**
 * Client delivery view for one project. The server assembles the whole page
 * payload so the browser never has to stitch together capacity or forecast
 * responses that would need redacting individually.
 */
export function usePortfolioProject(projectId: string) {
  return useQuery<ClientProjectDetail>({
    queryKey: ["portfolio", projectId],
    queryFn: () => api.get(`/portfolio/${projectId}`),
    enabled: !!projectId,
  });
}
