import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-session";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/blacklist")({
  head: () => ({ meta: [{ title: "Blacklist — Sentinel VMS" }] }),
  component: BlacklistPage,
});

function BlacklistPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const entries = useQuery({
    queryKey: ["blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist")
        .select("id, reason, active, created_at, visitor:visitors(full_name, phone, company), created_by_profile:profiles!blacklist_created_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) {
        // fallback without the joined profile if FK alias not present
        const r = await supabase.from("blacklist").select("id, reason, active, created_at, visitor:visitors(full_name, phone, company)").order("created_at", { ascending: false });
        if (r.error) throw r.error;
        return r.data as any[];
      }
      return data as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!phone.trim() || !reason.trim()) throw new Error("Phone and reason are required");
      const { data: v } = await supabase.from("visitors").select("id").eq("phone", phone.trim()).maybeSingle();
      if (!v) throw new Error("No visitor found with that phone number");
      const { error } = await supabase.from("blacklist").insert({ visitor_id: v.id, reason: reason.trim(), created_by: me.userId });
      if (error) throw error;
    },
    onSuccess: () => { setPhone(""); setReason(""); toast.success("Added to blacklist"); qc.invalidateQueries({ queryKey: ["blacklist"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blacklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["blacklist"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-destructive" /> Blacklist
        </h1>
        <p className="text-sm text-muted-foreground">Visitors flagged from entering the premises.</p>
      </header>

      {(me.isAdmin || me.isHost) && (
        <Card>
          <CardHeader><CardTitle>Add entry</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Visitor phone number (must exist)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            <Button onClick={() => add.mutate()} disabled={add.isPending}>Add to blacklist</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{entries.data?.length ?? 0} entries</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {entries.data?.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-medium">{b.visitor?.full_name} <span className="text-muted-foreground">· {b.visitor?.phone}</span></div>
                <div className="mt-1 text-sm">{b.reason}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
              </div>
              {me.isAdmin && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)}>Remove</Button>
              )}
            </div>
          ))}
          {entries.data?.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No entries.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
