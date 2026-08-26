"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, ShieldCheck, UserCog, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { useAdminUsers, useUpdateAdminUser } from "@/hooks/use-admin-users";
import { useDevelopers } from "@/hooks/use-developers";
import { useProjects } from "@/hooks/use-projects";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import type { AdminUser } from "@/types";
import { ApiError } from "@/lib/api-client";

const ROLE_TONE: Record<Role, string> = {
  manager:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  developer:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  client:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const UNLINKED = "__none__";

/**
 * Manager-only account administration: set a role, link a login to a developer
 * profile, and grant a client access to projects.
 *
 * This screen is what makes the developer role usable at all — a self-
 * registered account arrives unlinked and can read nothing until a manager
 * connects it to a `Developer` record here.
 */
export default function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers();
  const { data: developers } = useDevelopers();
  const { data: projects } = useProjects();
  const updateUser = useUpdateAdminUser();

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<Role>("developer");
  const [developerId, setDeveloperId] = useState<string>(UNLINKED);
  const [projectIds, setProjectIds] = useState<string[]>([]);

  function openEdit(user: AdminUser) {
    setEditing(user);
    setRole(user.role);
    setDeveloperId(user.developerId ?? UNLINKED);
    setProjectIds(user.projectIds);
  }

  function toggleProject(id: string) {
    setProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function save() {
    if (!editing) return;
    try {
      await updateUser.mutateAsync({
        id: editing.id,
        role,
        developerId: role === "developer" && developerId !== UNLINKED ? developerId : null,
        projectIds: role === "client" ? projectIds : [],
      });
      toast.success(`${editing.name} updated`);
      setEditing(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update user"
      );
    }
  }

  return (
    <>
      <Header title="Team & Access" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Accounts and access</CardTitle>
                <CardDescription className="text-xs">
                  Managers see everything. Developers see only their own
                  workload, and need a linked developer profile before they see
                  anything at all. Clients see only the projects granted here.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${ROLE_TONE[u.role]}`}
                          >
                            {ROLE_LABEL[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {u.role === "manager" && (
                            <span className="text-muted-foreground">
                              Full access
                            </span>
                          )}
                          {u.role === "developer" &&
                            (u.developerName ? (
                              <span className="flex items-center gap-1.5">
                                <UserCog className="size-3 text-muted-foreground" />
                                {u.developerName}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                <Link2Off className="size-3" />
                                No developer profile linked
                              </span>
                            ))}
                          {u.role === "client" && (
                            <span className="text-muted-foreground">
                              {u.projectIds.length === 0
                                ? "No projects granted"
                                : `${u.projectIds.length} project${
                                    u.projectIds.length === 1 ? "" : "s"
                                  }`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEdit(u)}
                            className="text-muted-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {role === "developer" && (
              <div className="grid gap-1.5">
                <Label>Developer profile</Label>
                <Select
                  value={developerId}
                  onValueChange={(v) => v && setDeveloperId(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNLINKED}>Not linked</SelectItem>
                    {(developers ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Until this is set the account can sign in but sees no work.
                </p>
              </div>
            )}

            {role === "client" && (
              <div className="grid gap-1.5">
                <Label>Projects this client can see</Label>
                <div className="grid gap-1.5 rounded-lg border p-3">
                  {(projects ?? []).map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={projectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="size-3.5 accent-current"
                      />
                      {p.name}
                    </label>
                  ))}
                  {(projects ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No projects exist yet.
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  With nothing ticked the client sees an empty portfolio — access
                  is deny-by-default.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={updateUser.isPending}>
                {updateUser.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
