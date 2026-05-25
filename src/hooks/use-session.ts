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

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          void supabase.auth.signOut({ scope: "local" });
        }
        if (!cancelled) setSession(data.session ?? null);
      })
      .catch(() => {
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

  return {
    session,
    userId,
    profile: profile.data,
    roles: roles.data ?? [],
    isLoading: sessionLoading || profile.isLoading || roles.isLoading || roles.isFetching,
    isAdmin: has("admin"),
    isReceptionist: has("receptionist"),
    isSecurity: has("security"),
    isHost: has("host"),
    canRegister: has("admin") || has("receptionist") || has("security"),
    canManageBadges: has("admin") || has("receptionist") || has("security"),
  };
}
