"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  LineChart,
  ChevronRight,
  CircleDot,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { CadenceLogo } from "@/components/brand/cadence-logo";
import { UserMenu } from "./user-menu";
import { useProjects } from "@/hooks/use-projects";
import { useSprints } from "@/hooks/use-sprints";
import { useAuth } from "@/components/auth-provider";
import type { Role } from "@/lib/roles";

interface NavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
}

/**
 * Navigation per role. This is presentation only — the API enforces access
 * independently, so hiding a link is a courtesy, not a control.
 *
 * Managers keep the original four plus account administration. Developers and
 * clients each get a single destination, because each has exactly one screen.
 */
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  manager: [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Developers", href: "/developers", icon: Users },
    { title: "Capacity", href: "/capacity", icon: BarChart3 },
    { title: "Forecast Evaluation", href: "/evaluation", icon: LineChart },
    { title: "Team & Access", href: "/admin/users", icon: ShieldCheck },
  ],
  developer: [{ title: "My Work", href: "/my-work", icon: ClipboardList }],
  client: [{ title: "Delivery", href: "/portfolio", icon: FolderKanban }],
};

// Child-rendered once per expanded project — hook usage inside is safe
// because this component is only mounted while expanded.
function ProjectSprints({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { data: sprints } = useSprints(projectId);

  if (!sprints || sprints.length === 0) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground">
        No sprints yet
      </p>
    );
  }

  const now = new Date();
  const sorted = [...sprints].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <>
      {sorted.slice(0, 6).map((sprint) => {
        const start = new Date(sprint.startDate);
        const end = new Date(sprint.endDate);
        const isCurrent = now >= start && now <= end;
        return (
          <SidebarMenuSubItem key={sprint.id}>
            <SidebarMenuSubButton
              render={<Link href={`/sprints/${sprint.id}`} />}
              isActive={pathname === `/sprints/${sprint.id}`}
            >
              {isCurrent && (
                <CircleDot className="size-3 text-emerald-500" />
              )}
              <span className="truncate">{sprint.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </>
  );
}

function ProjectsMenu() {
  const pathname = usePathname();
  const { data: projects } = useProjects();
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());

  // Auto-expand the project currently in the URL, without needing an effect.
  const urlProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const effectiveExpanded = new Set(userExpanded);
  if (urlProjectId) effectiveExpanded.add(urlProjectId);

  const projectsActive = pathname.startsWith("/projects");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href="/projects" />}
        isActive={projectsActive && pathname === "/projects"}
      >
        <FolderKanban className="size-4" />
        <span>Projects</span>
        {projects && projects.length > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {projects.length}
          </span>
        )}
      </SidebarMenuButton>
      {projects && projects.length > 0 && (
        <SidebarMenuSub>
          {projects.map((project) => {
            const isExpanded = effectiveExpanded.has(project.id);
            const isActive = pathname.startsWith(`/projects/${project.id}`);
            return (
              <SidebarMenuSubItem key={project.id}>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent"
                    onClick={() =>
                      setUserExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(project.id)) next.delete(project.id);
                        else next.add(project.id);
                        return next;
                      })
                    }
                    aria-label={isExpanded ? "Collapse project" : "Expand project"}
                  >
                    <ChevronRight
                      className={`size-3 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  <SidebarMenuSubButton
                    render={<Link href={`/projects/${project.id}`} />}
                    isActive={isActive && pathname === `/projects/${project.id}`}
                    className="flex-1"
                  >
                    <span className="truncate">{project.name}</span>
                  </SidebarMenuSubButton>
                </div>
                {isExpanded && (
                  <ul className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                    <ProjectSprints projectId={project.id} />
                  </ul>
                )}
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const navItems = NAV_BY_ROLE[role] ?? [];
  // The project tree deep-links into /sprints/[id] — the densest per-developer
  // view in the app — so it stays manager-only. Clients navigate via /portfolio.
  const showProjects = role === "manager";

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <CadenceLogo size={22} />
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight">Cadence</span>
            <span className="text-[10px] text-muted-foreground">Capacity intelligence</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.slice(0, 1).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {showProjects && <ProjectsMenu />}
              {navItems.slice(1).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
