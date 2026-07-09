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
        if (error) void supabase.auth.signOut({ scope: "local" });
        if (!cancelled) setSession(data.session ?? null);
      })
      .catch(() => {
        window.clearTimeout(authTimeout);
        void supabase.auth.signOut({ scope: "local" });
        if (!cancelled) setSession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
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

  const branchAssignments = useQuery({
    enabled: !!userId,
    queryKey: ["me", "branch-assignments", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_branch_roles")
        .select("branch_id, role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as { branch_id: string; role: AppRole }[];
    },
  });

  const branch = useQuery({
    enabled: !!profile.data?.branch_id,
    queryKey: ["me", "branch", profile.data?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("id", profile.data!.branch_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const explicitRoles = roles.data ?? [];
  const branchRoleList = (branchAssignments.data ?? []).map((r) => r.role as AppRole);
  const allRoles = Array.from(new Set([...explicitRoles, ...branchRoleList]));
  const has = (r: AppRole) => allRoles.includes(r);
  const isSignedIn = !!userId;
  const isAdmin = has("admin");
  const canViewAllBranches = isAdmin || has("view_all_branches");
  const branchId = profile.data?.branch_id ?? null;

  // Compute branches user can access; admins / view_all -> empty array meaning "all"
  const assignedBranchIds = Array.from(
    new Set((branchAssignments.data ?? []).map((b) => b.branch_id)),
  );
  // Fallback: if no explicit assignments, use profile.branch_id
  const allowedBranchIds: string[] =
    assignedBranchIds.length > 0
      ? assignedBranchIds
      : branchId
      ? [branchId]
      : [];

  // role → branches it applies to
  const rolesByBranch: Record<string, AppRole[]> = {};
  (branchAssignments.data ?? []).forEach((r) => {
    rolesByBranch[r.branch_id] = [...(rolesByBranch[r.branch_id] ?? []), r.role];
  });

  return {
    session,
    userId,
    profile: profile.data,
    branchId,
    globalRoles: explicitRoles,
    roles: allRoles,
    branchAssignments: branchAssignments.data ?? [],
    allowedBranchIds,
    rolesByBranch,
    isLoading:
      sessionLoading ||
      profile.isLoading ||
      roles.isLoading ||
      branchAssignments.isLoading,
    has,
    isSignedIn,
    isAdmin,
    isHost: has("host"),
    canViewAllBranches,
    canViewReports: isAdmin || has("view_reports"),
    canRegister:
      isAdmin ||
      has("register_guest") ||
      has("register_contractor") ||
      has("register_delivery"),
    canPreRegister:
      isAdmin ||
      has("pre_register_guest") ||
      has("pre_register_contractor") ||
      has("pre_register_delivery"),
    canManageBadges: isAdmin || has("manage_badges"),
    canManageBlacklist: isAdmin || has("manage_blacklist"),
    canManageStaff: isAdmin || has("manage_staff"),
    canManageBranches: isAdmin || has("manage_branches"),
    canCheckout:
      isAdmin ||
      has("checkout_visitor") ||
      has("manage_badges") ||
      has("receptionist") ||
      has("security") ||
      has("gate_officer"),
    canCapturePhoto: isAdmin || has("capture_visitor_photo"),
    canViewPhotoReports: isAdmin || has("view_photo_reports") || has("view_reports"),
    canViewAuditLog: isAdmin || has("view_audit_log"),
  };
}
