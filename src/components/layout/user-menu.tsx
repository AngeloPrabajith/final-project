"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Settings, LogOut, Sun, Moon, Monitor, ChevronUp } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Separator } from "@/components/ui/separator";

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {initials}
    </div>
  );
}

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      {/* Flyout menu */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
          {/* User info header */}
          <div className="flex items-center gap-3 px-3 py-3">
            <UserAvatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          {/* Theme picker */}
          <div className="px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Theme</p>
            <div className="flex gap-1">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    theme === value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Settings link */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Settings className="size-4 text-muted-foreground" />
            Settings
          </Link>

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors"
      >
        <UserAvatar name={user.name} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <ChevronUp
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "rotate-180"}`}
        />
      </button>
    </div>
  );
}
