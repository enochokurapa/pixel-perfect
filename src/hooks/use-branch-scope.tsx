import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";

type Branch = { id: string; name: string };
const STORAGE_KEY = "sentinel.activeBranchId";

type Ctx = {
  /** All branches the user is allowed to see */
  availableBranches: Branch[];
  /** Currently selected branch ID, or null = "All branches" */
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  /** If active=null, show data from all branches the user is allowed to see */
  canChooseAll: boolean;
  isLoading: boolean;
};

const BranchScopeContext = createContext<Ctx | null>(null);

export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();

  const allBranches = useQuery({
    queryKey: ["branches", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const availableBranches = useMemo(() => {
    const all = allBranches.data ?? [];
    if (me.canViewAllBranches) return all;
    if (me.allowedBranchIds.length === 0) return [];
    return all.filter((b) => me.allowedBranchIds.includes(b.id));
  }, [allBranches.data, me.canViewAllBranches, me.allowedBranchIds]);

  const canChooseAll = me.canViewAllBranches;

  const [activeBranchId, setActive] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Clamp invalid selection (changed branches, no longer permitted, etc.)
  useEffect(() => {
    if (availableBranches.length === 0) return;
    if (activeBranchId === null && canChooseAll) return;
    const stillValid = availableBranches.some((b) => b.id === activeBranchId);
    if (!stillValid) {
      const next = canChooseAll ? null : availableBranches[0].id;
      setActive(next);
    }
  }, [availableBranches, canChooseAll, activeBranchId]);

  const setActiveBranchId = (id: string | null) => {
    setActive(id);
    if (typeof window !== "undefined") {
      if (id === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, id);
    }
  };

  return (
    <BranchScopeContext.Provider
      value={{
        availableBranches,
        activeBranchId,
        setActiveBranchId,
        canChooseAll,
        isLoading: allBranches.isLoading || me.isLoading,
      }}
    >
      {children}
    </BranchScopeContext.Provider>
  );
}

export function useBranchScope() {
  const ctx = useContext(BranchScopeContext);
  if (!ctx) throw new Error("useBranchScope must be used inside BranchScopeProvider");
  return ctx;
}

/**
 * Returns the branch filter to apply to queries.
 * - If a specific branch is selected → that branch id
 * - If "All" + admin → null (no filter)
 * - If "All" + restricted user → their list of allowed ids (use .in())
 */
export function useEffectiveBranchFilter() {
  const { activeBranchId, availableBranches, canChooseAll } = useBranchScope();
  if (activeBranchId) return { kind: "eq" as const, branchId: activeBranchId };
  if (canChooseAll) return { kind: "all" as const };
  return { kind: "in" as const, branchIds: availableBranches.map((b) => b.id) };
}
