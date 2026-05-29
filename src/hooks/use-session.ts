import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const authTimeout = window.setTimeout(() => {
      if (!cancelled) setSession(null);
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        window.clearTimeout(authTimeout);
        if (error) {
          void supabase.auth.signOut({ scope: "local" });
        }
        if (!cancelled) setSession(data.session ?? null);
      })
      .catch(() => {
        window.clearTimeout(authTimeout);
        void supabase.auth.signOut({ scope: "local" });
        if (!cancelled) setSession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      qc.invalidateQueries();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, [qc]);

  return session;
}

export function useCurrentUser() {
  const session = useSession();
  const userId = session?.user.id;
  const sessionLoading = session === undefined;
  const profile = useQuery({
    enabled: !!userId,
    queryKey: ["me", "profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const roles = useQuery({
    enabled: !!userId,
    queryKey: ["me", "roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const has = (r: AppRole) => roles.data?.includes(r) ?? false;
  const isSignedIn = !!userId;
  const isAdmin = has("admin");
  const canViewAllBranches = isAdmin || has("view_all_branches");
  const branchId = profile.data?.branch_id ?? null;

  return {
    session,
    userId,
    profile: profile.data,
    branchId,
    roles: roles.data ?? [],
    isLoading: sessionLoading || profile.isLoading || roles.isLoading || roles.isFetching,
    has,
    isSignedIn,
    isAdmin: isSignedIn || isAdmin, // keep prior behavior for existing call-sites
    isHost: has("host"),
    canViewAllBranches,
    canRegister:
      isSignedIn ||
      isAdmin ||
      has("register_guest") ||
      has("register_contractor") ||
      has("register_delivery"),
    canManageBadges: isSignedIn || isAdmin || has("manage_badges"),
  };
}

