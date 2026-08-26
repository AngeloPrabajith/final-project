"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { landingPathFor } from "@/lib/roles";

/**
 * Pure dispatcher. Every role has a real route of its own — `/dashboard`,
 * `/my-work`, `/portfolio` — so `/` just forwards to the right one rather than
 * rendering three different screens behind one URL.
 *
 * `replace`, not `push`, so the back button doesn't bounce off this page.
 */
export default function RootRedirectPage() {
  const { role, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(landingPathFor(role));
  }, [isLoading, user, role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading…</div>
    </div>
  );
}
