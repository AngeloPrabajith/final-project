"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { MeResponse, User } from "@/types";
import { landingPathFor, normaliseRole, type Role } from "@/lib/roles";
import { api } from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** Normalised role. Defaults to the most restrictive until `/api/me` answers. */
  role: Role;
  /** Linked `Developer.id`, or null when this account has no developer profile. */
  developerId: string | null;
  /** Assigned project ids for clients; null means unrestricted. */
  projectIds: string[] | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  role: "client",
  developerId: null,
  projectIds: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("client");
  const [developerId, setDeveloperId] = useState<string | null>(null);
  const [projectIds, setProjectIds] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        setToken(storedToken);
        setUser(parsed);
        // Optimistic: use the cached role so the shell renders immediately.
        // `/api/me` below is the authoritative answer.
        setRole(normaliseRole(parsed.role));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  /**
   * The `user` blob in localStorage is written once at login and never
   * refreshed, so it goes stale the moment a manager changes someone's role or
   * links their developer profile. Re-resolve from the server on every load.
   */
  useEffect(() => {
    // No clearing branch here — `logout()` already resets this state, and
    // clearing synchronously in an effect body just triggers a cascading render.
    if (!token) return;
    let cancelled = false;
    api
      .get<MeResponse>("/me")
      .then((me) => {
        if (cancelled) return;
        setRole(me.role);
        setDeveloperId(me.developerId);
        setProjectIds(me.projectIds);
        setUser(me.user);
        localStorage.setItem("user", JSON.stringify(me.user));
      })
      .catch(() => {
        // A 401 is already handled by the api client (clears session and
        // redirects); anything else leaves the optimistic role in place.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!isLoading && !token && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/login");
    }
  }, [isLoading, token, pathname, router]);

  function login(newToken: string, newUser: User) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    const nextRole = normaliseRole(newUser.role);
    setRole(nextRole);
    router.push(landingPathFor(nextRole));
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setRole("client");
    setDeveloperId(null);
    setProjectIds(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        developerId,
        projectIds,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
