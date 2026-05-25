import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  company: z.string().trim().min(1, "Company / Origin is required").max(120),
  purpose: z.string().trim().min(2).max(500),
  badge_number: z.string().trim().max(40),
  host_id: z.string().uuid({ message: "Host is required" }),
});

function RegisterPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [visitType, setVisitType] = useState<"guest" | "supplier" | "contractor">("guest");
  const [visitMode, setVisitMode] = useState<"walk_in" | "drive_in">("walk_in");
  const [hostId, setHostId] = useState<string>("");
  const [idScanFile, setIdScanFile] = useState<File | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  type AssetRow = { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string };
  const [assets, setAssets] = useState<AssetRow[]>([
    { kind: "device", brand: "", serial: "", description: "" },
  ]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    company: "",
    purpose: "",
    work_description: "",
    badge_number: "",
    vehicle_plate: "",
    vehicle_type: "",
    id_type: "",
    id_number: "",
  });

  const hosts = useQuery({
    queryKey: ["hosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, position")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const availableBadges = useQuery({
    queryKey: ["badges", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("badge_number")
        .eq("status", "available")
        .order("badge_number");
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ ...form, host_id: hostId });

      // Validate assets — at least one with brand + serial
      const cleanAssets = assets
        .map((a) => ({ ...a, brand: a.brand.trim(), serial: a.serial.trim(), description: a.description.trim() }))
        .filter((a) => a.brand || a.serial || a.description);
      if (cleanAssets.length === 0) {
        throw new Error("At least one asset is required. Capture the visitor's items.");
      }
      for (const [i, a] of cleanAssets.entries()) {
        if (!a.brand || !a.serial) {
          throw new Error(`Asset #${i + 1}: brand and serial number are required.`);
        }
      }

      // Find or create visitor (duplicate detection by phone)
      const { data: existing } = await supabase
        .from("visitors")
        .select("id")
        .eq("phone", parsed.phone)
        .maybeSingle();
      let visitorId = existing?.id;
      const visitorPayload = {
        full_name: parsed.full_name,
        email: parsed.email,
        company: parsed.company,
        id_type: form.id_type || null,
        id_number: form.id_number || null,
      };
      if (!visitorId) {
        const { data: v, error: vErr } = await supabase
          .from("visitors")
          .insert({ ...visitorPayload, phone: parsed.phone })
          .select("id")
          .single();
        if (vErr) throw vErr;
        visitorId = v.id;
      } else {
        await supabase.from("visitors").update(visitorPayload).eq("id", visitorId);
      }

      // Blacklist check
      const { data: bl } = await supabase
        .from("blacklist")
        .select("reason")
        .eq("visitor_id", visitorId)
        .eq("active", true)
        .maybeSingle();
      if (bl) throw new Error(`Visitor is blacklisted: ${bl.reason}`);

      // Optional ID scan upload
      if (idScanFile) {
        const ext = idScanFile.name.split(".").pop() || "jpg";
        const path = `${visitorId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("id-scans")
          .upload(path, idScanFile, { upsert: true, contentType: idScanFile.type });
        if (upErr) throw upErr;
        await supabase.from("visitors").update({ id_scan_url: path }).eq("id", visitorId);
      }

      const { data: visit, error: visitErr } = await supabase
        .from("visits")
        .insert({
          visitor_id: visitorId,
          host_id: parsed.host_id,
          visit_type: visitType,
          visit_mode: visitMode,
          purpose: parsed.purpose,
          company: parsed.company,
          work_description: visitType !== "guest" ? form.work_description || null : null,
          badge_number: parsed.badge_number || null,
          vehicle_plate: visitMode === "drive_in" ? form.vehicle_plate || null : null,
          vehicle_type: visitMode === "drive_in" ? form.vehicle_type || null : null,
          status: "checked_in",
          check_in_at: new Date().toISOString(),
          created_by: me.userId,
        })
        .select("id")
        .single();
      if (visitErr) throw visitErr;

      // Insert captured assets
      const { error: aErr } = await supabase.from("visit_assets").insert(
        cleanAssets.map((a) => ({
          visit_id: visit.id,
          kind: a.kind,
          brand: a.brand,
          serial: a.serial,
          description: a.description || null,
        })),
      );
      if (aErr) throw aErr;

      if (parsed.badge_number) {
        await supabase
          .from("badges")
          .update({ status: "issued" })
          .eq("badge_number", parsed.badge_number);
      }
      return visit.id;
    },
    onSuccess: () => {
      toast.success("Visitor registered, checked in & confirmation logged");
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
        <p className="text-sm text-muted-foreground">
          Classify, capture details, and check the visitor in.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>1. Classification</CardTitle>
          <CardDescription>Required first step.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Visitor type</Label>
            <Select value={visitType} onValueChange={(v) => setVisitType(v as typeof visitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visit mode</Label>
            <Select value={visitMode} onValueChange={(v) => setVisitMode(v as typeof visitMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="drive_in">Drive-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {visitType !== "guest" && (
            <div className="space-y-2 md:col-span-2">
              <Label>
                {visitType === "supplier"
                  ? "What are they supplying?"
                  : "Description of contracted work"}
              </Label>
              <Textarea
                value={form.work_description}
                onChange={(e) => set("work_description", e.target.value)}
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Visitor details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Phone number <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              onBlur={async (e) => {
                const phone = e.target.value.trim();
                if (!phone) return;
                const { data: existing } = await supabase
                  .from("visitors")
                  .select("full_name, email, company")
                  .eq("phone", phone)
                  .maybeSingle();
                if (existing) {
                  setForm((f) => ({
                    ...f,
                    full_name: f.full_name || existing.full_name,
                    email: f.email || existing.email || "",
                    company: f.company || existing.company || "",
                  }));
                  setDuplicateNotice(
                    `Returning visitor — details auto-filled from previous visit (${existing.full_name}).`,
                  );
                  toast.info(`Returning visitor: ${existing.full_name}`);
                } else {
                  setDuplicateNotice(null);
                }
                const { data: bl } = await supabase
                  .from("blacklist")
                  .select("reason, visitor_id, visitors!inner(phone)")
                  .eq("active", true)
                  .eq("visitors.phone", phone)
                  .maybeSingle();
                if (bl) toast.error(`⚠ Blacklisted: ${bl.reason}`);
              }}
            />
            {duplicateNotice && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{duplicateNotice}</p>
            )}
          </div>
          <Field
            label="Full name"
            required
            value={form.full_name}
            onChange={(v) => set("full_name", v)}
          />
          <Field
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
          />
          <Field
            label="Company / Origin"
            required
            value={form.company}
            onChange={(v) => set("company", v)}
          />
          <Field
            label="Purpose of visit"
            required
            value={form.purpose}
            onChange={(v) => set("purpose", v)}
            className="md:col-span-2"
          />

          <div className="space-y-2">
            <Label>
              Host <span className="text-destructive">*</span>
            </Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger>
                <SelectValue placeholder="Select host" />
              </SelectTrigger>
              <SelectContent>
                {hosts.data?.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.full_name}
                    {h.position ? ` · ${h.position}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Badge number</Label>
            <Select value={form.badge_number} onValueChange={(v) => set("badge_number", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Assign an available badge if needed" />
              </SelectTrigger>
              <SelectContent>
                {availableBadges.data?.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No badges available — add in Badges
                  </div>
                )}
                {availableBadges.data?.map((b) => (
                  <SelectItem key={b.badge_number} value={b.badge_number}>
                    #{b.badge_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visitMode === "drive_in" && (
            <>
              <Field
                label="Vehicle plate"
                value={form.vehicle_plate}
                onChange={(v) => set("vehicle_plate", v)}
              />
              <Field
                label="Vehicle type"
                value={form.vehicle_type}
                onChange={(v) => set("vehicle_type", v)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Identification (optional)</CardTitle>
          <CardDescription>Capture ID details and an optional scan for audit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>ID Type</Label>
            <Select value={form.id_type} onValueChange={(v) => set("id_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select ID type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">National ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="drivers_license">Driver's License</SelectItem>
                <SelectItem value="work_id">Work ID</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="ID Number" value={form.id_number} onChange={(v) => set("id_number", v)} />
          <div className="space-y-2 md:col-span-2">
            <Label>ID Scan (image)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setIdScanFile(e.target.files?.[0] ?? null)}
            />
            {idScanFile && (
              <p className="text-xs text-muted-foreground">Selected: {idScanFile.name}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app" })}>
          Cancel
        </Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Registering…" : "Register & check in"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
