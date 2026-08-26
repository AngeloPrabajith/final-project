"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { canAccess } from "@/lib/route-access";
import { landingPathFor } from "@/lib/roles";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, token, role, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // `user` is only non-null once /api/me has answered (or a cached session was
  // restored). Waiting for it avoids bouncing a manager off their own
  // dashboard during the moment the role is still the optimistic default.
  const roleResolved = Boolean(user);
  const allowed = canAccess(role, pathname);

  useEffect(() => {
    if (isLoading || !token || !roleResolved) return;
    if (!allowed) router.replace(landingPathFor(role));
  }, [isLoading, token, roleResolved, allowed, role, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {roleResolved && !allowed ? (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-muted-foreground">Redirecting…</div>
          </div>
        ) : (
          children
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
