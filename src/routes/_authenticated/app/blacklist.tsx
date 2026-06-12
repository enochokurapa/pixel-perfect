import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-session";
import { ShieldAlert } from "lucide-react";

type BlacklistEntry = {
  id: string;
  reason: string;
  active: boolean;
  created_at: string;
  visitor: { full_name: string; phone: string; company: string | null } | null;
};

type BlacklistSearch = {
  phone?: string;
  name?: string;
  company?: string;
  visitorId?: string;
};

export const Route = createFileRoute("/_authenticated/app/blacklist")({
  head: () => ({ meta: [{ title: "Blacklist — Sentinel VMS" }] }),
  validateSearch: (s: Record<string, unknown>): BlacklistSearch => ({
    phone: typeof s.phone === "string" ? s.phone : undefined,
    name: typeof s.name === "string" ? s.name : undefined,
    company: typeof s.company === "string" ? s.company : undefined,
    visitorId: typeof s.visitorId === "string" ? s.visitorId : undefined,
  }),
  component: BlacklistPage,
});

function BlacklistPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/app/blacklist" }) as BlacklistSearch;
  const [phone, setPhone] = useState(search.phone ?? "");
  const [name, setName] = useState(search.name ?? "");
  const [company, setCompany] = useState(search.company ?? "");
  const [visitorId, setVisitorId] = useState(search.visitorId ?? "");
  const [reason, setReason] = useState("");
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (prefilledRef.current) return;
    if (search.phone || search.name || search.visitorId) {
      setPhone(search.phone ?? "");
      setName(search.name ?? "");
      setCompany(search.company ?? "");
      setVisitorId(search.visitorId ?? "");
      prefilledRef.current = true;
      toast.info(`Prefilled blacklist form for ${search.name ?? search.phone ?? "visitor"}`);
    }
  }, [search]);

  const entries = useQuery({
    queryKey: ["blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist")
        .select(
          "id, reason, active, created_at, visitor:visitors(full_name, phone, company)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BlacklistEntry[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Reason is required");
      let vid = visitorId.trim();
      if (!vid) {
        if (!phone.trim()) throw new Error("Phone or visitor is required");
        const { data: v } = await supabase
          .from("visitors")
          .select("id")
          .eq("phone", phone.trim())
          .maybeSingle();
        if (!v) throw new Error("No visitor found with that phone number");
        vid = v.id;
      }
      const { error } = await supabase
        .from("blacklist")
        .insert({ visitor_id: vid, reason: reason.trim(), created_by: me.userId });
      if (error) throw error;
    },
    onSuccess: () => {
      setPhone("");
      setName("");
      setCompany("");
      setVisitorId("");
      setReason("");
      prefilledRef.current = false;
      toast.success("Added to blacklist");
      qc.invalidateQueries({ queryKey: ["blacklist"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blacklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["blacklist"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const prefilled = Boolean(visitorId || name);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-destructive" /> Blacklist
        </h1>
        <p className="text-sm text-muted-foreground">
          Visitors flagged from entering the premises.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{prefilled ? `Add ${name || phone || "visitor"} to blacklist` : "Add entry"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prefilled && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{name || "Visitor"}</div>
              <div className="text-xs text-muted-foreground">
                {phone}{company ? ` · ${company}` : ""}
              </div>
            </div>
          )}
          <Input
            placeholder="Visitor phone number (must exist)"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setVisitorId("");
            }}
          />
          <Textarea
            placeholder="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              Add to blacklist
            </Button>
            {prefilled && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPhone("");
                  setName("");
                  setCompany("");
                  setVisitorId("");
                  setReason("");
                  prefilledRef.current = false;
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{entries.data?.length ?? 0} entries</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {entries.data?.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-medium">
                  {b.visitor?.full_name}{" "}
                  <span className="text-muted-foreground">· {b.visitor?.phone}</span>
                </div>
                <div className="mt-1 text-sm">{b.reason}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString()}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)}>
                Remove
              </Button>
            </div>
          ))}
          {entries.data?.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No entries.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
