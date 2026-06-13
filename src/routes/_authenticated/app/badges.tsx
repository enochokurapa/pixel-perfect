import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useEffectiveBranchFilter } from "@/hooks/use-branch-scope";
import { useCurrentUser } from "@/hooks/use-session";

type BadgeRow = {
  id: string;
  badge_number: string;
  status: string;
};

export const Route = createFileRoute("/_authenticated/app/badges")({
  head: () => ({ meta: [{ title: "Badges — Sentinel VMS" }] }),
  component: BadgesPage,
});

function BadgesPage() {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const branchFilter = useEffectiveBranchFilter();
  const [newBadge, setNewBadge] = useState("");
  const [toDelete, setToDelete] = useState<BadgeRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const targetBranchId = branchFilter.kind === "eq" ? branchFilter.branchId : "";

  const badges = useQuery({
    queryKey: ["badges", "all", branchFilter],
    queryFn: async () => {
      let q = supabase.from("badges").select("*").is("deleted_at", null).order("badge_number");
      if (branchFilter.kind === "eq") q = q.eq("branch_id", branchFilter.branchId);
      else if (branchFilter.kind === "in" && branchFilter.branchIds.length > 0) q = q.in("branch_id", branchFilter.branchIds);
      else if (branchFilter.kind === "in") return [];
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!newBadge.trim()) throw new Error("Badge number required");
      if (!targetBranchId) throw new Error("Select one branch before adding a badge.");
      const { error } = await supabase.from("badges").insert({ badge_number: newBadge.trim(), branch_id: targetBranchId });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewBadge("");
      toast.success("Badge added");
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!toDelete) throw new Error("No badge selected");
      const reason = deleteReason.trim();
      if (reason.length < 3) throw new Error("Please provide a reason (min 3 chars).");
      if (toDelete.status === "issued") throw new Error("Cannot delete an issued badge.");
      const { error } = await supabase
        .from("badges")
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason, deleted_by: me.profile?.id ?? null })
        .eq("id", toDelete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Badge deleted");
      setToDelete(null);
      setDeleteReason("");
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const grouped = {
    available: badges.data?.filter((b) => b.status === "available") ?? [],
    issued: badges.data?.filter((b) => b.status === "issued") ?? [],
    unreturned: badges.data?.filter((b) => b.status === "unreturned") ?? [],
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Badges</h1>
        <p className="text-sm text-muted-foreground">
          Inventory of physical badges for the active branch selection.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add badge</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="e.g. B-014"
            value={newBadge}
            onChange={(e) => setNewBadge(e.target.value)}
            className="max-w-xs"
          />
          {branchFilter.kind !== "eq" && (
            <span className="self-center text-xs text-muted-foreground">Select one branch to add badges.</span>
          )}
          <Button onClick={() => add.mutate()} disabled={add.isPending || !targetBranchId}>
            Add
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <BadgeBucket
          title="Available"
          count={grouped.available.length}
          badges={grouped.available}
          tone="success"
          onDelete={(b) => setToDelete(b)}
        />
        <BadgeBucket
          title="Issued"
          count={grouped.issued.length}
          badges={grouped.issued}
          tone="info"
          onDelete={(b) => setToDelete(b)}
        />
        <BadgeBucket
          title="Unreturned"
          count={grouped.unreturned.length}
          badges={grouped.unreturned}
          tone="warning"
          onDelete={(b) => setToDelete(b)}
        />
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) { setToDelete(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete badge #{toDelete?.badge_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the badge from inventory. A reason is required for audit purposes.
              {toDelete?.status === "issued" && (
                <span className="mt-2 block text-destructive">This badge is currently issued and cannot be deleted.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for deletion (e.g. lost, damaged, replaced)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); remove.mutate(); }}
              disabled={remove.isPending || toDelete?.status === "issued" || deleteReason.trim().length < 3}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BadgeBucket({
  title,
  count,
  badges,
  tone,
  onDelete,
}: {
  title: string;
  count: number;
  badges: BadgeRow[];
  tone: "success" | "info" | "warning";
  onDelete: (b: BadgeRow) => void;
}) {
  const cls = { success: "text-success", info: "text-info", warning: "text-warning-foreground" }[
    tone
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className={`font-display text-2xl ${cls}`}>{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.id}
              className="group inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-mono"
            >
              #{b.badge_number}
              {b.status !== "issued" && (
                <button
                  type="button"
                  onClick={() => onDelete(b)}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                  aria-label={`Delete badge ${b.badge_number}`}
                  title="Delete badge"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {badges.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        </div>
      </CardContent>
    </Card>
  );
}
