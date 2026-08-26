"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import {
  Sun,
  Moon,
  Monitor,
  User,
  Palette,
  SlidersHorizontal,
  Bell,
  Info,
} from "lucide-react";
import { CadenceLogo } from "@/components/brand/cadence-logo";

const SPRINT_DEFAULTS_KEY = "sprint_defaults";

interface SprintDefaults {
  capacityBuffer: number;
  overloadWarnings: boolean;
}

function getSprintDefaults(): SprintDefaults {
  if (typeof window === "undefined") return { capacityBuffer: 20, overloadWarnings: true };
  try {
    const raw = localStorage.getItem(SPRINT_DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : { capacityBuffer: 20, overloadWarnings: true };
  } catch {
    return { capacityBuffer: 20, overloadWarnings: true };
  }
}

function saveSprintDefaults(defaults: SprintDefaults) {
  localStorage.setItem(SPRINT_DEFAULTS_KEY, JSON.stringify(defaults));
}

const themeOptions = [
  { value: "light", label: "Light", icon: Sun, description: "Always use the light theme" },
  { value: "system", label: "System", icon: Monitor, description: "Follow your OS preference" },
  { value: "dark", label: "Dark", icon: Moon, description: "Always use the dark theme" },
] as const;

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [defaults, setDefaults] = useState<SprintDefaults>({ capacityBuffer: 20, overloadWarnings: true });

  useEffect(() => {
    setMounted(true);
    setDefaults(getSprintDefaults());
  }, []);

  function updateDefaults(patch: Partial<SprintDefaults>) {
    const updated = { ...defaults, ...patch };
    setDefaults(updated);
    saveSprintDefaults(updated);
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">

        {/* Appearance */}
        <SectionCard icon={Palette} title="Appearance" description="Customise the look and feel of the application">
          <div className="grid gap-3">
            <Label className="text-sm">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {mounted && themeOptions.map(({ value, label, icon: Icon, description }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all ${
                    theme === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`size-5 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${theme === value ? "text-primary" : ""}`}>{label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{description}</span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Profile */}
        <SectionCard icon={User} title="Profile" description="Your account information">
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {user?.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Badge variant="secondary" className="ml-auto">{user?.role ?? "member"}</Badge>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Profile details are managed by your account administrator. Contact your admin to update your name or email.
            </p>
          </div>
        </SectionCard>

        {/* Sprint Defaults */}
        <SectionCard
          icon={SlidersHorizontal}
          title="Sprint Defaults"
          description="Pre-fill defaults when creating new sprints"
        >
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="default-buffer">Default Capacity Buffer</Label>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {defaults.capacityBuffer}%
                </span>
              </div>
              <input
                id="default-buffer"
                type="range"
                min={0}
                max={40}
                step={5}
                value={defaults.capacityBuffer}
                onChange={(e) => updateDefaults({ capacityBuffer: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                New sprints will default to a <strong>{defaults.capacityBuffer}%</strong> capacity buffer,
                flagging overload at <strong>{100 - defaults.capacityBuffer}%</strong> utilisation.
                This can be overridden per sprint.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Notifications */}
        <SectionCard
          icon={Bell}
          title="Notifications"
          description="Control in-app alerts and warnings"
        >
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Overload warnings</p>
                <p className="text-xs text-muted-foreground">
                  Show a warning toast when adding a task causes a developer to exceed effective capacity
                </p>
              </div>
              <button
                role="switch"
                aria-checked={defaults.overloadWarnings}
                onClick={() => updateDefaults({ overloadWarnings: !defaults.overloadWarnings })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  defaults.overloadWarnings ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow-lg transition-transform ${
                    defaults.overloadWarnings ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </SectionCard>

        {/* About */}
        <SectionCard icon={Info} title="About" description="System and project information">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CadenceLogo size={18} />
              <span className="font-medium">Cadence</span>
              <Badge variant="outline" className="text-xs">CS6P05NM</Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Capacity intelligence for sprint planning
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Version</span><span>1.0.0</span>
              <span>Stack</span><span>Next.js · Prisma · PostgreSQL</span>
              <span>Module</span><span>Final Year Project</span>
              <span>Institution</span><span>London Metropolitan University</span>
            </div>
          </div>
        </SectionCard>

      </div>
    </>
  );
}
