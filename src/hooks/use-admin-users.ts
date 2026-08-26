"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminUser, UpdateAdminUserInput } from "@/types";

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/admin/users"),
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAdminUserInput & { id: string }) =>
      api.put(`/admin/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      // A link or role change alters what every other query is allowed to
      // return, so drop the lot rather than trying to enumerate them.
      qc.invalidateQueries({ queryKey: ["developers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
