import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app/pre-register")({
  head: () => ({ meta: [{ title: "Pre-register visitor — Sentinel VMS" }] }),
  component: PreRegisterPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(255),
  purpose: z.string().trim().min(2).max(500),
});

function PreRegisterPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [visitType, setVisitType] = useState<"guest" | "supplier" | "contractor">("guest");
  const [hostId, setHostId] = useState<string>(me.userId ?? "");
  const [duration, setDuration] = useState(180);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", company: "", purpose: "" });
  type AssetRow = { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string };
  const [assets, setAssets] = useState<AssetRow[]>([
    { kind: "device", brand: "", serial: "", description: "" },
  ]);

  const hosts = useQuery({
    queryKey: ["hosts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, position").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const { data: existing } = await supabase.from("visitors").select("id").eq("phone", parsed.phone).maybeSingle();
      let visitorId = existing?.id;
      if (!visitorId) {
        const { data: v, error } = await supabase.from("visitors").insert({
          full_name: parsed.full_name, phone: parsed.phone, email: parsed.email, company: form.company || null,
        }).select("id").single();
        if (error) throw error;
        visitorId = v.id;
      }
      const { data: bl } = await supabase.from("blacklist").select("reason").eq("visitor_id", visitorId).eq("active", true).maybeSingle();
      if (bl) throw new Error(`Visitor is blacklisted: ${bl.reason}`);

      const { error: vErr } = await supabase.from("visits").insert({
        visitor_id: visitorId,
        host_id: hostId || me.userId,
        visit_type: visitType,
        visit_mode: "walk_in",
        purpose: parsed.purpose,
        company: form.company || null,
        status: "pending",
        approval: "pending",
        pre_registered: true,
        expected_duration_minutes: duration,
        created_by: me.userId,
      });
      if (vErr) throw vErr;
    },
    onSuccess: () => {
      toast.success("Visit pre-registered. Host will be notified.");
      qc.invalidateQueries();
      navigate({ to: "/app/visitors" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Pre-register a visit</h1>
        <p className="text-sm text-muted-foreground">Book ahead — reception will check the visitor in on arrival.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Visitor</CardTitle><CardDescription>Who is coming to see you?</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" required value={form.full_name} onChange={(v) => set("full_name", v)} />
          <Field label="Phone" required value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Email" required type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Company" value={form.company} onChange={(v) => set("company", v)} />
          <Field label="Purpose" required value={form.purpose} onChange={(v) => set("purpose", v)} className="md:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Visit details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Visitor type</Label>
            <Select value={visitType} onValueChange={(v: any) => setVisitType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected duration (minutes)</Label>
            <Input type="number" min={15} max={600} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Host</Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger>
              <SelectContent>
                {hosts.data?.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.full_name}{h.position ? ` · ${h.position}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app" })}>Cancel</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : "Pre-register"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, type, className }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
