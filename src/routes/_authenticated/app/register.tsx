import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-session";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app/register")({
  head: () => ({ meta: [{ title: "Register visitor — Sentinel VMS" }] }),
  component: RegisterPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  purpose: z.string().trim().min(2).max(500),
  badge_number: z.string().trim().min(1).max(40),
});

function RegisterPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [visitType, setVisitType] = useState<"guest" | "supplier" | "contractor">("guest");
  const [visitMode, setVisitMode] = useState<"walk_in" | "drive_in">("walk_in");
  const [hostId, setHostId] = useState<string>("");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", company: "",
    purpose: "", work_description: "", badge_number: "",
    vehicle_plate: "", vehicle_type: "",
  });

  const hosts = useQuery({
    queryKey: ["hosts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, position").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const availableBadges = useQuery({
    queryKey: ["badges", "available"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("badge_number").eq("status", "available").order("badge_number");
      if (error) throw error;
      return data;
    },
  });

  if (!me.canRegister) {
    return <div className="p-8 text-sm text-muted-foreground">You don't have permission to register visitors.</div>;
  }

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);

      // Check blacklist
      const { data: existing } = await supabase.from("visitors").select("id").eq("phone", parsed.phone).maybeSingle();
      let visitorId = existing?.id;
      if (!visitorId) {
        const { data: v, error: vErr } = await supabase.from("visitors").insert({
          full_name: parsed.full_name,
          phone: parsed.phone,
          email: parsed.email,
          company: form.company || null,
        }).select("id").single();
        if (vErr) throw vErr;
        visitorId = v.id;
      } else {
        // refresh basic info
        await supabase.from("visitors").update({
          full_name: parsed.full_name, email: parsed.email, company: form.company || null,
        }).eq("id", visitorId);
      }

      const { data: bl } = await supabase.from("blacklist").select("reason").eq("visitor_id", visitorId).eq("active", true).maybeSingle();
      if (bl) throw new Error(`Visitor is blacklisted: ${bl.reason}`);

      const { data: visit, error: visitErr } = await supabase.from("visits").insert({
        visitor_id: visitorId,
        host_id: hostId || null,
        visit_type: visitType,
        visit_mode: visitMode,
        purpose: parsed.purpose,
        company: form.company || null,
        work_description: visitType !== "guest" ? form.work_description || null : null,
        badge_number: parsed.badge_number,
        vehicle_plate: visitMode === "drive_in" ? form.vehicle_plate || null : null,
        vehicle_type: visitMode === "drive_in" ? form.vehicle_type || null : null,
        status: "checked_in",
        check_in_at: new Date().toISOString(),
        created_by: me.userId,
      }).select("id").single();
      if (visitErr) throw visitErr;

      // Mark badge issued
      await supabase.from("badges").update({ status: "issued" }).eq("badge_number", parsed.badge_number);

      return visit.id;
    },
    onSuccess: () => {
      toast.success("Visitor registered and checked in");
      qc.invalidateQueries();
      navigate({ to: "/app/visitors" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Register visitor</h1>
        <p className="text-sm text-muted-foreground">Classify, capture details, and check the visitor in.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>1. Classification</CardTitle><CardDescription>Required first step.</CardDescription></CardHeader>
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
            <Label>Visit mode</Label>
            <Select value={visitMode} onValueChange={(v: any) => setVisitMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="drive_in">Drive-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {visitType !== "guest" && (
            <div className="space-y-2 md:col-span-2">
              <Label>{visitType === "supplier" ? "What are they supplying?" : "Description of contracted work"}</Label>
              <Textarea value={form.work_description} onChange={(e) => set("work_description", e.target.value)} rows={2} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Visitor details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" required value={form.full_name} onChange={(v) => set("full_name", v)} />
          <Field label="Phone number" required value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Email" required type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Company / Origin" value={form.company} onChange={(v) => set("company", v)} />
          <Field label="Purpose of visit" required value={form.purpose} onChange={(v) => set("purpose", v)} className="md:col-span-2" />

          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label>Badge number</Label>
            <Select value={form.badge_number} onValueChange={(v) => set("badge_number", v)}>
              <SelectTrigger><SelectValue placeholder="Assign an available badge" /></SelectTrigger>
              <SelectContent>
                {availableBadges.data?.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No badges available — add in Badges</div>}
                {availableBadges.data?.map((b) => (
                  <SelectItem key={b.badge_number} value={b.badge_number}>#{b.badge_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visitMode === "drive_in" && (
            <>
              <Field label="Vehicle plate" value={form.vehicle_plate} onChange={(v) => set("vehicle_plate", v)} />
              <Field label="Vehicle type" value={form.vehicle_type} onChange={(v) => set("vehicle_type", v)} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app" })}>Cancel</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Registering…" : "Register & check in"}
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
