import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { toast } from "sonner";
import { z } from "zod";
import { PhotoCaptureDialog, type CapturedPhoto } from "@/components/photo-capture";
import { logActivity } from "@/lib/activity-log";
import { Camera, Trash2 } from "lucide-react";

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
  host_id: z.string().uuid().optional().or(z.literal("")),
  host_name: z.string().trim().max(120).optional().or(z.literal("")),
});

type VisitorType = "guest" | "supplier" | "contractor" | "delivery";
type AssetRow = { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string };
const TYPE_OPTIONS: { value: VisitorType; label: string; role: "register_guest" | "register_contractor" | "register_delivery" }[] = [
  { value: "guest", label: "Guest", role: "register_guest" },
  { value: "contractor", label: "Contractor", role: "register_contractor" },
  { value: "delivery", label: "Delivery", role: "register_delivery" },
  { value: "supplier", label: "Supplier", role: "register_delivery" },
];

function RegisterPage() {
  const me = useCurrentUser();
  const branchScope = useBranchScope();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [visitType, setVisitType] = useState<VisitorType>("guest");
  const [visitMode, setVisitMode] = useState<"walk_in" | "drive_in">("walk_in");
  const [hostId, setHostId] = useState<string>("");
  const [manualHostName, setManualHostName] = useState("");
  const [registrationBranchId, setRegistrationBranchId] = useState("");
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [hasAssets, setHasAssets] = useState<"no" | "yes">("no");
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
  const [facePhoto, setFacePhoto] = useState<CapturedPhoto | null>(null);
  const [idPhoto, setIdPhoto] = useState<CapturedPhoto | null>(null);
  const [faceOpen, setFaceOpen] = useState(false);
  const [idOpen, setIdOpen] = useState(false);

  useEffect(() => {
    if (registrationBranchId) return;
    const preferred = branchScope.activeBranchIds?.length === 1 ? branchScope.activeBranchIds[0] : me.branchId;
    if (preferred) setRegistrationBranchId(preferred);
    else if (branchScope.availableBranches.length === 1) setRegistrationBranchId(branchScope.availableBranches[0].id);
  }, [branchScope.activeBranchIds, branchScope.availableBranches, me.branchId, registrationBranchId]);

  const canUseType = (role: "register_guest" | "register_contractor" | "register_delivery") =>
    me.isAdmin || me.globalRoles.includes(role) || (!!registrationBranchId && (me.rolesByBranch[registrationBranchId] ?? []).includes(role));
  const allowedTypes = useMemo(() => TYPE_OPTIONS.filter((o) => canUseType(o.role)), [me.globalRoles, me.rolesByBranch, me.isAdmin, registrationBranchId]);
  useEffect(() => {
    if (allowedTypes.length > 0 && !allowedTypes.some((o) => o.value === visitType)) setVisitType(allowedTypes[0].value);
  }, [allowedTypes, visitType]);

  const hosts = useQuery({
    queryKey: ["hosts", registrationBranchId],
    enabled: !!registrationBranchId,
    queryFn: async () => {
      const allowedIds = [registrationBranchId];
      const [primary, assigned] = await Promise.all([
        supabase.from("profiles").select("id, full_name, position").in("branch_id", allowedIds),
        supabase.from("user_branch_roles").select("user_id").in("branch_id", allowedIds),
      ]);
      if (primary.error) throw primary.error;
      if (assigned.error) throw assigned.error;
      const primaryIds = new Set((primary.data ?? []).map((p) => p.id));
      const extraIds = Array.from(new Set((assigned.data ?? []).map((r) => r.user_id))).filter(
        (id) => !primaryIds.has(id),
      );
      let extra: { id: string; full_name: string; position: string | null }[] = [];
      if (extraIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, position")
          .in("id", extraIds);
        if (error) throw error;
        extra = data ?? [];
      }
      return [...(primary.data ?? []), ...extra].sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      );
    },
  });

  const availableBadges = useQuery({
    queryKey: ["badges", "available", registrationBranchId],
    enabled: !!registrationBranchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("badge_number")
        .eq("status", "available")
        .eq("branch_id", registrationBranchId)
        .order("badge_number");
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!registrationBranchId) throw new Error("Select the branch for this registration.");
      if (allowedTypes.length === 0) throw new Error("You do not have rights to register any visitor type at this branch.");
      const parsed = schema.parse({ ...form, host_id: hostId, host_name: manualHostName });
      if (!parsed.host_id && !parsed.host_name?.trim()) {
        throw new Error("Select a host or type the host name.");
      }
      if (visitMode === "drive_in") {
        if (!form.vehicle_plate.trim()) throw new Error("Vehicle plate is required for drive-in visits.");
        if (!form.vehicle_type.trim()) throw new Error("Vehicle type is required for drive-in visits.");
      }

      if (!parsed.badge_number) {
        throw new Error("Assign an available badge before checking the visitor in.");
      }

      // Safety re-check: badge must still be available and not active on another checked-in visit.
      const [{ data: badgeRow, error: badgeErr }, { data: activeBadge, error: activeBadgeErr }] = await Promise.all([
        supabase
          .from("badges")
          .select("status")
          .eq("badge_number", parsed.badge_number)
          .eq("branch_id", registrationBranchId)
          .maybeSingle(),
        supabase
          .from("visits")
          .select("id")
          .eq("badge_number", parsed.badge_number)
          .eq("branch_id", registrationBranchId)
          .eq("status", "checked_in")
          .maybeSingle(),
      ]);
      if (badgeErr) throw new Error(badgeErr.message);
      if (activeBadgeErr) throw new Error(activeBadgeErr.message);
      if (!badgeRow) throw new Error("The selected badge no longer exists at this branch.");
      if (badgeRow.status !== "available" || activeBadge) {
        throw new Error(
          `Badge #${parsed.badge_number} is currently in use with another visitor. Please pick a different badge or wait until it is returned.`,
        );
      }


      // Validate assets only if visitor declared bringing assets
      let cleanAssets: AssetRow[] = [];
      if (hasAssets === "yes") {
        cleanAssets = assets
          .map((a) => ({ ...a, brand: a.brand.trim(), serial: a.serial.trim(), description: a.description.trim() }))
          .filter((a) => a.brand || a.serial || a.description);
        if (cleanAssets.length === 0) {
          throw new Error("At least one asset is required when 'With asset' is selected.");
        }
        for (const [i, a] of cleanAssets.entries()) {
          if (!a.brand || !a.serial) {
            throw new Error(`Asset #${i + 1}: brand and serial number are required.`);
          }
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

      // Optional photo uploads happen before check-in so a camera/storage failure never leaves
      // a visitor marked inside without their requested photo records.
      const photoPatch: {
        face_photo_url?: string;
        id_photo_url?: string;
        id_photo_type?: string;
        photos_captured_at?: string;
      } = {};
      const uploadPhoto = async (photo: CapturedPhoto, kind: "face" | "id") => {
        const path = `${registrationBranchId}/${visitorId}/${kind}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("visitor-photos")
          .upload(path, photo.blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw new Error(`Could not save ${kind === "face" ? "visitor face" : "visitor ID"} photo: ${error.message}`);
        return path;
      };
      if (facePhoto) photoPatch.face_photo_url = await uploadPhoto(facePhoto, "face");
      if (idPhoto) {
        photoPatch.id_photo_url = await uploadPhoto(idPhoto, "id");
        photoPatch.id_photo_type = idPhoto.idType ?? "other";
      }
      if (Object.keys(photoPatch).length > 0) {
        photoPatch.photos_captured_at = new Date().toISOString();
      }

      const { data: visit, error: visitErr } = await supabase
        .from("visits")
        .insert({
          visitor_id: visitorId,
          host_id: parsed.host_id || null,
          host_name: parsed.host_id ? hosts.data?.find((h) => h.id === parsed.host_id)?.full_name ?? null : parsed.host_name?.trim() || null,
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
          branch_id: registrationBranchId,
          ...photoPatch,
        })
        .select("id")
        .single();
      if (visitErr) throw visitErr;

      // Insert captured assets (only if any)
      if (cleanAssets.length > 0) {
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
      }

      if (parsed.badge_number) {
        await supabase
          .from("badges")
          .update({ status: "issued" })
          .eq("badge_number", parsed.badge_number)
          .eq("branch_id", registrationBranchId);
      }

      if (Object.keys(photoPatch).length > 0) {
        await logActivity({
          action: "visit.photo_captured",
          entityType: "visit",
          entityId: visit.id,
          branchId: registrationBranchId,
          details: { face: !!facePhoto, id: !!idPhoto, id_type: idPhoto?.idType },
        });
      }

      await logActivity({
        action: "visit.register",
        entityType: "visit",
        entityId: visit.id,
        branchId: registrationBranchId,
        details: {
          visitor: parsed.full_name,
          type: visitType,
          mode: visitMode,
          host: parsed.host_id ? "system" : "manual",
        },
      });
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
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
                {allowedTypes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch <span className="text-destructive">*</span></Label>
            <Select value={registrationBranchId} onValueChange={(v) => { setRegistrationBranchId(v); setHostId(""); setManualHostName(""); set("badge_number", ""); }}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branchScope.availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
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
          {visitMode === "drive_in" && (
            <>
              <div className="space-y-2">
                <Label>Vehicle plate <span className="text-destructive">*</span></Label>
                <Input
                  value={form.vehicle_plate}
                  onChange={(e) => set("vehicle_plate", e.target.value)}
                  aria-invalid={!form.vehicle_plate.trim()}
                  className={!form.vehicle_plate.trim() ? "border-destructive/60" : ""}
                />
                {!form.vehicle_plate.trim() && (
                  <p className="text-xs text-destructive">Vehicle plate is required for drive-in visits.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Vehicle type <span className="text-destructive">*</span></Label>
                <Select value={form.vehicle_type} onValueChange={(v) => set("vehicle_type", v)}>
                  <SelectTrigger
                    aria-invalid={!form.vehicle_type}
                    className={!form.vehicle_type ? "border-destructive/60" : ""}
                  >
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car / Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="pickup">Pickup / Truck</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {!form.vehicle_type && (
                  <p className="text-xs text-destructive">Vehicle type is required for drive-in visits.</p>
                )}
              </div>
            </>
          )}
          {visitType !== "guest" && (
            <div className="space-y-2 md:col-span-2">
              <Label>
                {visitType === "supplier"
                  ? "What are they supplying?"
                  : visitType === "delivery"
                  ? "What is being delivered? (items, sender, recipient)"
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
                  .select("id, full_name, email, company")
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
                  const { data: priorVisits } = await supabase
                    .from("visits")
                    .select("id")
                    .eq("visitor_id", existing.id)
                    .order("created_at", { ascending: false })
                    .limit(10);
                  const priorIds = (priorVisits ?? []).map((v) => v.id);
                  if (priorIds.length > 0) {
                    const { data: priorAssets } = await supabase
                      .from("visit_assets")
                      .select("kind, brand, serial, description")
                      .in("visit_id", priorIds)
                      .order("created_at", { ascending: false })
                      .limit(6);
                    const unique = Array.from(
                      new Map(
                        (priorAssets ?? [])
                          .filter((a) => a.brand || a.serial || a.description)
                          .map((a) => [`${a.kind}-${a.brand ?? ""}-${a.serial ?? ""}`, a]),
                      ).values(),
                    );
                    if (unique.length > 0) {
                      setHasAssets("yes");
                      setAssets(unique.map((a) => ({
                        kind: a.kind as AssetRow["kind"],
                        brand: a.brand ?? "",
                        serial: a.serial ?? "",
                        description: a.description ?? "",
                      })));
                    }
                  }
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
              Host in system
            </Label>
            <Select value={hostId} onValueChange={(v) => { setHostId(v); setManualHostName(""); }}>
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
          <Field
            label="Or type host name"
            value={manualHostName}
            onChange={(v) => {
              setManualHostName(v);
              if (v.trim()) setHostId("");
            }}
          />

          <div className="space-y-2">
            <Label>Badge number <span className="text-destructive">*</span></Label>
            <Select value={form.badge_number} onValueChange={(v) => set("badge_number", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Assign an available badge" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Assets being brought in</CardTitle>
          <CardDescription>
            Is the visitor bringing any item (laptop, device, etc.) onto the premises?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 md:max-w-xs">
            <Label>Bringing any assets? <span className="text-destructive">*</span></Label>
            <Select value={hasAssets} onValueChange={(v) => setHasAssets(v as "yes" | "no")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Without asset</SelectItem>
                <SelectItem value="yes">With asset</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasAssets === "yes" && (
            <>
              {assets.map((a, i) => (
                <div key={i} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-3">
                    <Label>Type</Label>
                    <Select
                      value={a.kind}
                      onValueChange={(v) =>
                        setAssets((arr) => arr.map((x, j) => (i === j ? { ...x, kind: v as AssetRow["kind"] } : x)))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laptop">Laptop</SelectItem>
                        <SelectItem value="device">Device</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Brand <span className="text-destructive">*</span></Label>
                    <Input
                      value={a.brand}
                      onChange={(e) =>
                        setAssets((arr) => arr.map((x, j) => (i === j ? { ...x, brand: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Serial # <span className="text-destructive">*</span></Label>
                    <Input
                      value={a.serial}
                      onChange={(e) =>
                        setAssets((arr) => arr.map((x, j) => (i === j ? { ...x, serial: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Description</Label>
                    <Input
                      value={a.description}
                      onChange={(e) =>
                        setAssets((arr) => arr.map((x, j) => (i === j ? { ...x, description: e.target.value } : x)))
                      }
                    />
                  </div>
                  {assets.length > 1 && (
                    <div className="md:col-span-12">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAssets((arr) => arr.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setAssets((arr) => [...arr, { kind: "device", brand: "", serial: "", description: "" }])
                }
              >
                + Add another asset
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Identification (optional)</CardTitle>
          <CardDescription>Capture ID details here. Use the photo capture step below for ID pictures.</CardDescription>
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
        </CardContent>
      </Card>

      {me.canCapturePhoto && (
        <Card>
          <CardHeader>
            <CardTitle>5. Visitor photo capture (optional)</CardTitle>
            <CardDescription>
              Use the device camera to take a face photo and/or an ID photo. You can skip this step.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <PhotoSlot
              label="Visitor face photo"
              photo={facePhoto}
              onCapture={() => setFaceOpen(true)}
              onClear={() => setFacePhoto(null)}
            />
            <PhotoSlot
              label="Visitor ID photo"
              photo={idPhoto}
              onCapture={() => setIdOpen(true)}
              onClear={() => setIdPhoto(null)}
              badge={idPhoto?.idType?.replace("_", " ")}
            />
          </CardContent>
        </Card>
      )}

      <PhotoCaptureDialog
        open={faceOpen}
        onOpenChange={setFaceOpen}
        mode="face"
        onConfirm={(p) => setFacePhoto(p)}
      />
      <PhotoCaptureDialog
        open={idOpen}
        onOpenChange={setIdOpen}
        mode="id"
        onConfirm={(p) => setIdPhoto(p)}
      />

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

function PhotoSlot({
  label,
  photo,
  onCapture,
  onClear,
  badge,
}: {
  label: string;
  photo: CapturedPhoto | null;
  onCapture: () => void;
  onClear: () => void;
  badge?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {badge && (
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/40">
        {photo ? (
          <img src={photo.dataUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            Not captured
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCapture}>
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          {photo ? "Retake" : "Capture"}
        </Button>
        {photo && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

