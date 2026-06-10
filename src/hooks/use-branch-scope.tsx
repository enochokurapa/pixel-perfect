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
  /** Selected branch IDs; null = all permitted branches */
  activeBranchIds: string[] | null;
  setActiveBranchId: (id: string | null) => void;
  setActiveBranchIds: (ids: string[] | null) => void;
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

  const [activeBranchIds, setActive] = useState<string[] | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return saved.split(",").filter(Boolean);
  });
  const activeBranchId = activeBranchIds?.length === 1 ? activeBranchIds[0] : null;

  // Clamp invalid selection (changed branches, no longer permitted, etc.)
  useEffect(() => {
    if (availableBranches.length === 0) return;
    if (activeBranchIds === null && canChooseAll) return;
    const valid = (activeBranchIds ?? []).filter((id) => availableBranches.some((b) => b.id === id));
    if (valid.length !== (activeBranchIds ?? []).length || valid.length === 0) {
      const next = canChooseAll ? null : [availableBranches[0].id];
      setActive(next);
    }
  }, [availableBranches, canChooseAll, activeBranchIds]);

  const setActiveBranchIds = (ids: string[] | null) => {
    const next = ids && ids.length > 0 ? ids : null;
    setActive(next);
    if (typeof window !== "undefined") {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next.join(","));
    }
  };

  const setActiveBranchId = (id: string | null) => setActiveBranchIds(id ? [id] : null);

  return (
    <BranchScopeContext.Provider
      value={{
        availableBranches,
        activeBranchId,
        activeBranchIds,
        setActiveBranchId,
        setActiveBranchIds,
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
  const { activeBranchIds, availableBranches, canChooseAll } = useBranchScope();
  if (activeBranchIds?.length === 1) return { kind: "eq" as const, branchId: activeBranchIds[0] };
  if (activeBranchIds && activeBranchIds.length > 1) return { kind: "in" as const, branchIds: activeBranchIds };
  if (canChooseAll) return { kind: "all" as const };
  return { kind: "in" as const, branchIds: availableBranches.map((b) => b.id) };
}
