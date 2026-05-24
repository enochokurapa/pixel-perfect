import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/app/badges")({
  head: () => ({ meta: [{ title: "Badges — Sentinel VMS" }] }),
  component: BadgesPage,
});

function BadgesPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [newBadge, setNewBadge] = useState("");

  const badges = useQuery({
    queryKey: ["badges", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*").order("badge_number");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!newBadge.trim()) throw new Error("Badge number required");
      const { error } = await supabase.from("badges").insert({ badge_number: newBadge.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setNewBadge(""); toast.success("Badge added"); qc.invalidateQueries({ queryKey: ["badges"] }); },
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
        <p className="text-sm text-muted-foreground">Inventory of physical badges and their current status.</p>
      </header>

      {me.canManageBadges && (
        <Card>
          <CardHeader><CardTitle>Add badge</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            <Input placeholder="e.g. B-014" value={newBadge} onChange={(e) => setNewBadge(e.target.value)} className="max-w-xs" />
            <Button onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <BadgeBucket title="Available" count={grouped.available.length} badges={grouped.available} tone="success" />
        <BadgeBucket title="Issued" count={grouped.issued.length} badges={grouped.issued} tone="info" />
        <BadgeBucket title="Unreturned" count={grouped.unreturned.length} badges={grouped.unreturned} tone="warning" />
      </div>
    </div>
  );
}

function BadgeBucket({ title, count, badges, tone }: { title: string; count: number; badges: any[]; tone: "success" | "info" | "warning" }) {
  const cls = { success: "text-success", info: "text-info", warning: "text-warning-foreground" }[tone];
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
            <span key={b.id} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs font-mono">
              #{b.badge_number}
            </span>
          ))}
          {badges.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        </div>
      </CardContent>
    </Card>
  );
}
