import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ROLE_GROUPS, type Role } from "@/lib/permissions";
import { updateStaffBranchAssignments } from "@/lib/admin.functions";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Branch = { id: string; name: string };

const PER_BRANCH_GROUPS = ROLE_GROUPS.filter((g) => g.key !== "admin");

export function BranchAssignmentsEditor({
  userId,
  branches,
}: {
  userId: string;
  branches: Branch[];
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateStaffBranchAssignments);

  const current = useQuery({
    queryKey: ["user-branch-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_branch_roles")
        .select("branch_id, role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as { branch_id: string; role: AppRole }[];
    },
  });

  const initial = useMemo(() => {
    const map = new Map<string, Role[]>();
    (current.data ?? []).forEach((r) => {
      map.set(r.branch_id, [...(map.get(r.branch_id) ?? []), r.role as Role]);
    });
    return Array.from(map, ([branch_id, roles]) => ({ branch_id, roles }));
  }, [current.data]);

  const [draft, setDraft] = useState<{ branch_id: string; roles: Role[] }[]>([]);
  // Reset draft whenever the loaded data changes
  useMemo(() => setDraft(initial), [initial]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          user_id: userId,
          assignments: draft.filter((d) => d.branch_id && d.roles.length > 0),
        },
      }),
    onSuccess: () => {
      toast.success("Branch assignments updated");
      qc.invalidateQueries({ queryKey: ["user-branch-roles", userId] });
      qc.invalidateQueries({ queryKey: ["me", "branch-assignments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addRow = () => {
    const used = new Set(draft.map((d) => d.branch_id));
    const next = branches.find((b) => !used.has(b.id));
    setDraft((d) => [...d, { branch_id: next?.id ?? "", roles: [] }]);
  };

  const update = (idx: number, patch: Partial<{ branch_id: string; roles: Role[] }>) =>
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const remove = (idx: number) => setDraft((d) => d.filter((_, i) => i !== idx));

  const toggleRole = (idx: number, role: Role, on: boolean) => {
    const cur = draft[idx].roles;
    const next = on ? [...new Set([...cur, role])] : cur.filter((r) => r !== role);
    update(idx, { roles: next });
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        Per-branch role assignments. The same person can have different roles in different branches.
      </div>
      {draft.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          No branch assignments. Click "Add branch" to grant this user access to a branch.
        </div>
      )}
      {draft.map((row, idx) => (
        <div key={idx} className="rounded-md border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={row.branch_id} onValueChange={(v) => update(idx, { branch_id: v })}>
              <SelectTrigger className="h-8 w-[220px]">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => remove(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PER_BRANCH_GROUPS.flatMap((g) => g.roles).map((r) => {
              const on = row.roles.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-xs ${
                    on ? "border-primary/50 bg-primary/5" : "border-border"
                  }`}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(c) => toggleRole(idx, r.id, c === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-muted-foreground">{r.description}</div>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={addRow} disabled={draft.length >= branches.length}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add branch
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save assignments"}
        </Button>
      </div>
    </div>
  );
}

export function BranchAssignmentsCard({ userId }: { userId: string }) {
  const branches = useQuery({
    queryKey: ["branches-for-assign"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, name").order("name");
      return (data ?? []) as Branch[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch assignments</CardTitle>
        <CardDescription>
          Grant this user access to one or more branches. Each branch can have its own set of roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BranchAssignmentsEditor userId={userId} branches={branches.data ?? []} />
      </CardContent>
    </Card>
  );
}
