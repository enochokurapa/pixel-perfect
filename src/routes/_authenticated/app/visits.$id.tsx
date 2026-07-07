import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, FileSpreadsheet, FileText, LogIn, LogOut, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type VisitUpdate = Database["public"]["Tables"]["visits"]["Update"];
type VisitAsset = Database["public"]["Tables"]["visit_assets"]["Row"];
import { toast } from "sonner";
import { StatusBadge } from "./index";
import { exportExcel, exportDetailPdf } from "@/lib/visit-export";
import { logActivity } from "@/lib/activity-log";
import { checkoutVisit } from "@/lib/visits.functions";


export const Route = createFileRoute("/_authenticated/app/visits/$id")({
  head: () => ({ meta: [{ title: "Visit detail — Sentinel VMS" }] }),
  component: VisitDetail,
});




function downloadExcel(v: any, assetList: VisitAsset[]) {
  const rows = [
    { Field: "Full name", Value: v.visitor?.full_name ?? "" },
    { Field: "Phone", Value: v.visitor?.phone ?? "" },
    { Field: "Email", Value: v.visitor?.email ?? "" },
    { Field: "Company", Value: v.visitor?.company ?? "" },
    { Field: "ID type", Value: v.visitor?.id_type ?? "" },
    { Field: "ID number", Value: v.visitor?.id_number ?? "" },
    { Field: "Host", Value: v.host?.full_name ?? v.host_name ?? "" },
    { Field: "Purpose", Value: v.purpose ?? "" },
    { Field: "Visit type", Value: v.visit_type ?? "" },
    { Field: "Visit mode", Value: v.visit_mode ?? "" },
    { Field: "Badge", Value: v.badge_number ?? "" },
    { Field: "Vehicle plate", Value: v.vehicle_plate ?? "" },
    { Field: "Vehicle type", Value: v.vehicle_type ?? "" },
    { Field: "Expected duration (min)", Value: v.expected_duration_minutes ?? "" },
    { Field: "Status", Value: v.status ?? "" },
    { Field: "Approval", Value: v.approval ?? "" },
    { Field: "Check-in", Value: v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "" },
    { Field: "Check-out", Value: v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "" },
    { Field: "Badge returned", Value: v.badge_returned ? "Yes" : "No" },
    { Field: "Assets verified", Value: v.assets_verified ? "Yes" : "No" },
    { Field: "Checkout notes", Value: v.checkout_notes ?? "" },
    { Field: "Rejection reason", Value: v.rejection_reason ?? "" },
    { Field: "Feedback", Value: v.feedback ?? "" },
    ...assetList.map((a, i) => ({ Field: `Asset ${i + 1}`, Value: `${a.kind} ${a.brand ?? ""} ${a.serial ?? ""} ${a.description ?? ""}`.trim() })),
  ];
  exportExcel(`visit-${v.visitor?.full_name ?? "detail"}`, rows);
}

function downloadPdf(v: any, assetList: VisitAsset[]) {
  const visitor: [string, string][] = [
    ["Full name", v.visitor?.full_name ?? "—"],
    ["Phone", v.visitor?.phone ?? "—"],
    ["Email", v.visitor?.email ?? "—"],
    ["Company", v.visitor?.company ?? "—"],
    ["ID type", v.visitor?.id_type ?? "—"],
    ["ID number", v.visitor?.id_number ?? "—"],
  ];
  const visit: [string, string][] = [
    ["Host", v.host?.full_name ?? v.host_name ?? "—"],
    ["Purpose", v.purpose ?? "—"],
    ["Visit type", v.visit_type ?? "—"],
    ["Visit mode", v.visit_mode ?? "—"],
    ["Badge", v.badge_number ?? "—"],
    ["Vehicle plate", v.vehicle_plate ?? "—"],
    ["Vehicle type", v.vehicle_type ?? "—"],
    ["Expected duration", `${v.expected_duration_minutes ?? "—"} min`],
    ["Status", v.status ?? "—"],
    ["Approval", v.approval ?? "—"],
    ["Check-in", v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"],
    ["Check-out", v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "—"],
    ["Badge returned", v.badge_returned ? "Yes" : "No"],
    ["Assets verified", v.assets_verified ? "Yes" : "No"],
    ["Checkout notes", v.checkout_notes ?? "—"],
    ["Rejection reason", v.rejection_reason ?? "—"],
    ["Feedback", v.feedback ?? "—"],
  ];
  const assetRows: [string, string][] = assetList.length
    ? assetList.map((a, i) => [`Asset ${i + 1} (${a.kind})`, `${a.brand ?? ""} ${a.serial ?? ""} ${a.description ?? ""}`.trim() || "—"])
    : [["Assets", "None recorded"]];
  exportDetailPdf(
    `visit-${v.visitor?.full_name ?? "detail"}`,
    `Visit Report — ${v.visitor?.full_name ?? ""}`,
    [
      { heading: "Visitor", rows: visitor },
      { heading: "Visit", rows: visit },
      { heading: "Equipment & assets", rows: assetRows },
    ],
  );
}

function VisitDetail() {


  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const checkoutVisitFn = useServerFn(checkoutVisit);

  const visit = useQuery({
    queryKey: ["visit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, visitor:visitors(*), host:profiles(full_name, email, position)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const assets = useQuery({
    queryKey: ["visit-assets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_assets")
        .select("*")
        .eq("visit_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: VisitUpdate) => {
      const { error } = await supabase.from("visits").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const v = visit.data;

  if (visit.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading visit…</div>;
  }
  if (!v) {
    return <div className="p-8 text-sm text-muted-foreground">Visit not found.</div>;
  }

  const canStaffEdit = true;

  const approve = async () => {
    await update.mutateAsync({ approval: "approved" });
    // Compose a rich message with guest name, visit time, and assets to verify
    const assetList = assets.data ?? [];
    const assetSummary =
      assetList.length > 0
        ? assetList
            .map((a) => `${a.kind}${a.brand ? ` ${a.brand}` : ""}${a.serial ? ` (S/N ${a.serial})` : ""}`)
            .join(", ")
        : "No assets declared";
    const visitTime = v.check_in_at
      ? new Date(v.check_in_at).toLocaleString()
      : new Date().toLocaleString();
    const msg = `${v.visitor?.full_name ?? "A visitor"} approved by host. Visit time: ${visitTime}. Assets to verify: ${assetSummary}. Verify, capture details and issue badge to finalize check-in.`;

    if (v.branch_id) {
      const { data: deskStaff } = await supabase
        .from("user_branch_roles")
        .select("user_id, role")
        .eq("branch_id", v.branch_id)
        .in("role", ["manage_badges", "register_guest", "checkout_visitor"]);
      const recipients = Array.from(new Set((deskStaff ?? []).map((r) => r.user_id)));
      if (recipients.length > 0) {
        await supabase.from("notifications").insert(
          recipients.map((rid) => ({
            recipient_id: rid,
            type: "visit_pre_registered" as const,
            title: `Issue badge: ${v.visitor?.full_name ?? "visitor"}`,
            message: msg,
            visit_id: v.id,
          })),
        );
      }
    }
    await logActivity({
      action: "visit.approve",
      entityType: "visit",
      entityId: v.id,
      branchId: v.branch_id,
      details: { visitor: v.visitor?.full_name },
    });
    toast.success("Approved. Front desk notified to issue badge.");
  };
  const reject = async (reason: string) => {
    await update.mutateAsync({ approval: "not_approved", rejection_reason: reason });
    await logActivity({
      action: "visit.reject",
      entityType: "visit",
      entityId: v.id,
      branchId: v.branch_id,
      details: { visitor: v.visitor?.full_name, reason },
    });
  };
  const issueBadgeAndCheckIn = async (payload: {
    badge_number: string;
    assets_verified: boolean;
    newAssets: { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string }[];
  }) => {
    if (!payload.badge_number) {
      throw new Error("Please assign a badge before checking the visitor in.");
    }
    if (!v.branch_id) {
      throw new Error("This visit is missing a branch, so a badge cannot be issued safely.");
    }

    // Safety re-check: badge must still be available and not active on another checked-in visit.
    const [{ data: badgeRow, error: badgeErr }, { data: activeBadge, error: activeBadgeErr }] = await Promise.all([
      supabase
        .from("badges")
        .select("status")
        .eq("badge_number", payload.badge_number)
        .eq("branch_id", v.branch_id)
        .maybeSingle(),
      supabase
        .from("visits")
        .select("id")
        .eq("badge_number", payload.badge_number)
        .eq("branch_id", v.branch_id)
        .eq("status", "checked_in")
        .neq("id", v.id)
        .maybeSingle(),
    ]);
    if (badgeErr) throw new Error(badgeErr.message);
    if (activeBadgeErr) throw new Error(activeBadgeErr.message);
    if (!badgeRow) throw new Error("This badge no longer exists at this branch.");
    if (badgeRow.status !== "available" || activeBadge) {
      throw new Error(
        `Badge #${payload.badge_number} is currently in use with another visitor and cannot be re-issued until it is returned.`,
      );
    }
    if (payload.newAssets.length > 0) {
      const { error: aErr } = await supabase.from("visit_assets").insert(
        payload.newAssets.map((a) => ({
          visit_id: id,
          kind: a.kind,
          brand: a.brand || null,
          serial: a.serial || null,
          description: a.description || null,
        })),
      );
      if (aErr) throw new Error(aErr.message);
    }
    await update.mutateAsync({
      status: "checked_in",
      check_in_at: new Date().toISOString(),
      badge_number: payload.badge_number,
      assets_verified: payload.assets_verified,
    });
    await supabase
      .from("badges")
      .update({ status: "issued" })
      .eq("badge_number", payload.badge_number)
      .eq("branch_id", v.branch_id);
    await logActivity({
      action: "visit.badge_issued",
      entityType: "visit",
      entityId: v.id,
      branchId: v.branch_id,
      details: { badge_number: payload.badge_number, visitor: v.visitor?.full_name },
    });
    await logActivity({
      action: "visit.check_in",
      entityType: "visit",
      entityId: v.id,
      branchId: v.branch_id,
      details: { visitor: v.visitor?.full_name },
    });
    qc.invalidateQueries();
  };

  const checkOut = async (verification: {
    badge_returned: boolean;
    assets_verified: boolean;
    checkout_notes: string;
  }) => {
    try {
      await checkoutVisitFn({
        data: {
          visit_id: v.id,
          badge_returned: verification.badge_returned,
          assets_verified: verification.assets_verified,
          checkout_notes: verification.checkout_notes,
        },
      });
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check out visitor");
      throw error;
    }
  };
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/app/visitors" })}
          className="-ml-2"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to visitors
        </Button>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="font-display text-2xl font-semibold sm:text-3xl break-words">{v.visitor?.full_name}</h1>
              <StatusBadge status={v.status} approval={v.approval} />
              {v.pre_registered && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Pre-registered · {v.approval}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground capitalize break-words">
              {v.visit_type} · {v.visit_mode.replace("_", " ")} ·{" "}
              {v.visitor?.company ?? "No company"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadExcel(v, assets.data ?? [])}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPdf(v, assets.data ?? [])}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
            {v.approval === "pending" && (
              <>
                <RejectButton onReject={reject} disabled={update.isPending} />
                <Button onClick={approve} disabled={update.isPending}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
              </>
            )}
            {canStaffEdit && v.status === "pending" && v.approval !== "not_approved" && (
              <IssueBadgeButton
                visitorName={v.visitor?.full_name ?? "visitor"}
                existingAssets={assets.data ?? []}
                branchId={v.branch_id ?? null}
                onConfirm={issueBadgeAndCheckIn}
                disabled={update.isPending || v.approval === "pending"}
              />
            )}
            {canStaffEdit && v.status === "checked_in" && (
              <CheckOutButton
                hasBadge={!!v.badge_number}
                onConfirm={checkOut}
                disabled={update.isPending}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Visit information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <Info label="Purpose" value={v.purpose} />
            <Info label="Host" value={v.host?.full_name ?? v.host_name ?? "—"} />
            <Info label="Visit type" value={v.visit_type} className="capitalize" />
            <Info label="Visit mode" value={v.visit_mode.replace("_", " ")} className="capitalize" />
            <Info label="Badge" value={v.badge_number ? `#${v.badge_number}` : "—"} />
            <Info label="Expected duration" value={`${v.expected_duration_minutes} min`} />
            <Info
              label="Checked in"
              value={v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"}
            />
            <Info
              label="Checked out (exit time)"
              value={v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "—"}
            />
            {v.visit_mode === "drive_in" && (
              <>
                <Info label="Vehicle plate" value={v.vehicle_plate ?? "—"} />
                <Info label="Vehicle type" value={v.vehicle_type ?? "—"} />
              </>
            )}
            {v.work_description && (
              <Info label="Work description" value={v.work_description} className="sm:col-span-2" />
            )}
            {v.status === "checked_out" && (
              <>
                <Info
                  label="Badge returned"
                  value={v.badge_returned ? "Yes ✓" : "No ✗"}
                  className={v.badge_returned ? "text-success" : "text-destructive"}
                />
                <Info
                  label="Assets verified"
                  value={v.assets_verified ? "Yes ✓" : "No ✗"}
                  className={v.assets_verified ? "text-success" : "text-destructive"}
                />
                {v.checkout_notes && (
                  <Info label="Check-out notes" value={v.checkout_notes} className="sm:col-span-2" />
                )}
              </>
            )}
            {v.rejection_reason && (
              <Info
                label="Rejection reason"
                value={v.rejection_reason}
                className="sm:col-span-2 text-destructive"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visitor details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Full name" value={v.visitor?.full_name ?? "—"} />
            <Info label="Phone" value={v.visitor?.phone ?? "—"} />
            <Info label="Email" value={v.visitor?.email ?? "—"} />
            <Info label="Company / Origin" value={v.visitor?.company ?? "—"} />
            <Info label="ID type" value={v.visitor?.id_type ?? "—"} />
            <Info label="ID number" value={v.visitor?.id_number ?? "—"} />
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link
                to="/app/blacklist"
                search={{
                  phone: v.visitor?.phone ?? "",
                  name: v.visitor?.full_name ?? "",
                  company: v.visitor?.company ?? "",
                  visitorId: v.visitor_id ?? "",
                }}
              >
                <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Manage blacklist
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>


      <AssetsCard
        visitId={id}
        items={assets.data ?? []}
        canEdit={canStaffEdit}
        onChange={() => qc.invalidateQueries({ queryKey: ["visit-assets", id] })}
      />

      {v.visit_mode === "drive_in" && (
        <VehicleCaptureCard
          visitId={id}
          plate={v.vehicle_plate}
          vehicleType={v.vehicle_type}
          canEdit={canStaffEdit && v.status !== "checked_out"}
          onSave={async (plate, vt) => {
            await update.mutateAsync({ vehicle_plate: plate || null, vehicle_type: vt || null });
            qc.invalidateQueries({ queryKey: ["vehicle-audit", id] });
          }}
        />
      )}

      {v.status === "checked_out" && (
        <FeedbackCard
          visitId={id}
          initial={v.feedback}
          onSaved={() => qc.invalidateQueries({ queryKey: ["visit", id] })}
        />
      )}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function RejectButton({
  onReject,
  disabled,
}: {
  onReject: (reason: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        <X className="mr-1 h-4 w-4" /> Reject
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-9 w-48"
      />
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          if (reason.trim()) onReject(reason.trim());
        }}
        disabled={disabled}
      >
        Confirm
      </Button>
    </div>
  );
}

function CheckOutButton({
  hasBadge,
  onConfirm,
  disabled,
}: {
  hasBadge: boolean;
  onConfirm: (v: { badge_returned: boolean; assets_verified: boolean; checkout_notes: string }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [badgeReturned, setBadgeReturned] = useState(false);
  const [assetsVerified, setAssetsVerified] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (hasBadge && !badgeReturned) {
      toast.error("Please confirm the badge was returned.");
      return;
    }
    if (!assetsVerified) {
      toast.error("Please confirm assets were verified (or that none were brought in).");
      return;
    }
    setBusy(true);
    try {
      await onConfirm({
        badge_returned: badgeReturned,
        assets_verified: assetsVerified,
        checkout_notes: notes.trim(),
      });
      toast.success("Visitor checked out");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <LogOut className="mr-1 h-4 w-4" /> Check out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-out verification</DialogTitle>
          <DialogDescription>
            Confirm everything is in order before the visitor leaves. Exit time will be captured automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {hasBadge && (
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
              <Checkbox
                checked={badgeReturned}
                onCheckedChange={(c) => setBadgeReturned(c === true)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">Badge returned</div>
                <div className="text-xs text-muted-foreground">
                  Confirm the visitor handed back their badge.
                </div>
              </div>
            </label>
          )}
          <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
            <Checkbox
              checked={assetsVerified}
              onCheckedChange={(c) => setAssetsVerified(c === true)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Assets verified</div>
              <div className="text-xs text-muted-foreground">
                Confirm all assets brought in are leaving with the visitor (or none were brought).
              </div>
            </div>
          </label>
          <div className="space-y-2">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              rows={3}
              placeholder="Anything noteworthy about the check-out?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Exit time: <span className="font-medium text-foreground">{new Date().toLocaleString()}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? "Checking out…" : "Confirm check-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetsCard({

  visitId,
  items,
  canEdit,
  onChange,
}: {
  visitId: string;
  items: VisitAsset[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const [kind, setKind] = useState<"laptop" | "device" | "other">("device");
  const [brand, setBrand] = useState("");
  const [serial, setSerial] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!description.trim() && !brand.trim() && !serial.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("visit_assets").insert({
      visit_id: visitId,
      kind,
      brand: brand || null,
      serial: serial || null,
      description: description || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBrand("");
    setSerial("");
    setDescription("");
    toast.success("Asset recorded");
    onChange();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("visit_assets").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment & assets</CardTitle>
        <CardDescription>Items the visitor brought in — should match on check-out.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="grid gap-3 rounded-md border border-dashed p-4 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="device">Device</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Serial</Label>
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Description</Label>
              <div className="flex gap-2">
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                <Button onClick={add} disabled={busy}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Serial</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 capitalize">{a.kind}</td>
                    <td className="px-3 py-2">{a.brand ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.serial ?? "—"}</td>
                    <td className="px-3 py-2">{a.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackCard({
  visitId,
  initial,
  onSaved,
}: {
  visitId: string;
  initial: string | null;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("visits").update({ feedback: text }).eq("id", visitId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feedback saved");
    onSaved();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Post-visit feedback</CardTitle>
        <CardDescription>Capture what happened during the visit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="How did the visit go?"
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save feedback"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueBadgeButton({
  visitorName,
  existingAssets,
  branchId,
  onConfirm,
  disabled,
}: {
  visitorName: string;
  existingAssets: VisitAsset[];
  branchId: string | null;
  onConfirm: (p: {
    badge_number: string;
    assets_verified: boolean;
    newAssets: { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string }[];
  }) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [assetsVerified, setAssetsVerified] = useState(false);
  const [hasAssets, setHasAssets] = useState<"no" | "yes">(existingAssets.length > 0 ? "yes" : "no");
  type NewAsset = { kind: "laptop" | "device" | "other"; brand: string; serial: string; description: string };
  const [newAssets, setNewAssets] = useState<NewAsset[]>([]);
  const [busy, setBusy] = useState(false);

  const availableBadges = useQuery({
    queryKey: ["badges", "available", branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("badge_number")
        .eq("status", "available")
        .eq("branch_id", branchId!)
        .order("badge_number");
      if (error) throw error;
      return data;
    },
  });

  const confirm = async () => {
    if (!badgeNumber) {
      toast.error("Please assign a badge.");
      return;
    }
    if (!assetsVerified) {
      toast.error("Please confirm assets have been verified (or that none were brought in).");
      return;
    }
    const cleaned = newAssets
      .map((a) => ({ ...a, brand: a.brand.trim(), serial: a.serial.trim(), description: a.description.trim() }))
      .filter((a) => a.brand || a.serial || a.description);
    if (hasAssets === "yes" && existingAssets.length === 0 && cleaned.length === 0) {
      toast.error("Record at least one asset, or switch to 'No assets'.");
      return;
    }
    for (const [i, a] of cleaned.entries()) {
      if (!a.brand || !a.serial) {
        toast.error(`Asset #${i + 1}: brand and serial are required.`);
        return;
      }
    }
    setBusy(true);
    try {
      await onConfirm({ badge_number: badgeNumber, assets_verified: true, newAssets: cleaned });
      toast.success("Badge issued. Visitor checked in.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <LogIn className="mr-1 h-4 w-4" /> Verify & issue badge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Issue badge — {visitorName}</DialogTitle>
          <DialogDescription>
            Verify the visitor's assets, assign a badge and complete check-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Badge number <span className="text-destructive">*</span></Label>
            <Select value={badgeNumber} onValueChange={setBadgeNumber}>
              <SelectTrigger>
                <SelectValue placeholder="Select an available badge" />
              </SelectTrigger>
              <SelectContent>
                {availableBadges.data?.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No badges available</div>
                )}
                {availableBadges.data?.map((b) => (
                  <SelectItem key={b.badge_number} value={b.badge_number}>#{b.badge_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Is the visitor bringing any assets? <span className="text-destructive">*</span></Label>
            <Select value={hasAssets} onValueChange={(v) => setHasAssets(v as "yes" | "no")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No assets</SelectItem>
                <SelectItem value="yes">Yes — capture below</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {existingAssets.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-medium text-foreground">Previously declared assets ({existingAssets.length}):</div>
              <ul className="space-y-0.5 text-muted-foreground">
                {existingAssets.map((a) => (
                  <li key={a.id}>• {a.kind} — {a.brand ?? "?"} {a.serial ? `(S/N ${a.serial})` : ""} {a.description ?? ""}</li>
                ))}
              </ul>
            </div>
          )}

          {hasAssets === "yes" && (
            <div className="space-y-2">
              <Label className="text-xs">Add / verify assets</Label>
              {newAssets.map((a, i) => (
                <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-12">
                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-[10px]">Type</Label>
                    <Select
                      value={a.kind}
                      onValueChange={(v) => setNewAssets((arr) => arr.map((x, j) => (i === j ? { ...x, kind: v as NewAsset["kind"] } : x)))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laptop">Laptop</SelectItem>
                        <SelectItem value="device">Device</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-[10px]">Brand *</Label>
                    <Input value={a.brand} onChange={(e) => setNewAssets((arr) => arr.map((x, j) => (i === j ? { ...x, brand: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-[10px]">Serial *</Label>
                    <Input value={a.serial} onChange={(e) => setNewAssets((arr) => arr.map((x, j) => (i === j ? { ...x, serial: e.target.value } : x)))} />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-[10px]">Description</Label>
                    <Input value={a.description} onChange={(e) => setNewAssets((arr) => arr.map((x, j) => (i === j ? { ...x, description: e.target.value } : x)))} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setNewAssets((arr) => [...arr, { kind: "device", brand: "", serial: "", description: "" }])}>
                + Add asset
              </Button>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
            <Checkbox checked={assetsVerified} onCheckedChange={(c) => setAssetsVerified(c === true)} className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">Assets verified <span className="text-destructive">*</span></div>
              <div className="text-xs text-muted-foreground">
                I have physically verified the visitor's assets against the list above (or confirmed none were brought in).
              </div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? "Issuing badge…" : "Issue badge & check in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VehicleCaptureCard({
  visitId,
  plate,
  vehicleType,
  canEdit,
  onSave,
}: {
  visitId: string;
  plate: string | null;
  vehicleType: string | null;
  canEdit: boolean;
  onSave: (plate: string, vehicleType: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [p, setP] = useState(plate ?? "");
  const [t, setT] = useState(vehicleType ?? "");
  const [busy, setBusy] = useState(false);
  const [pErr, setPErr] = useState<string | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);

  const audit = useQuery({
    queryKey: ["vehicle-audit", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_vehicle_audit" as any)
        .select("*, changed_by_profile:profiles!visit_vehicle_audit_changed_by_fkey(full_name)")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback without embed if FK isn't declared to profiles
        const { data: raw } = await supabase
          .from("visit_vehicle_audit" as any)
          .select("*")
          .eq("visit_id", visitId)
          .order("created_at", { ascending: false });
        return (raw ?? []) as any[];
      }
      return (data ?? []) as any[];
    },
  });

  const save = async () => {
    setPErr(null); setTErr(null);
    if (!p.trim()) { setPErr("Vehicle plate is required."); return; }
    if (!t.trim()) { setTErr("Vehicle type is required."); return; }
    setBusy(true);
    try {
      await onSave(p.trim().toUpperCase(), t.trim());
      toast.success("Vehicle details updated");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Vehicle capture</CardTitle>
          <CardDescription>Current plate & type, plus full change history.</CardDescription>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => { setP(plate ?? ""); setT(vehicleType ?? ""); setEditing(true); }}>
            Edit vehicle
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Plate</div>
              <div className="mt-0.5 font-mono font-medium">{plate ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</div>
              <div className="mt-0.5 font-medium capitalize">{vehicleType ?? "—"}</div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle plate *</Label>
              <Input value={p} onChange={(e) => setP(e.target.value)} className={pErr ? "border-destructive" : ""} />
              {pErr && <p className="text-xs text-destructive">{pErr}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle type *</Label>
              <Select value={t} onValueChange={setT}>
                <SelectTrigger className={tErr ? "border-destructive" : ""}>
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
              {tErr && <p className="text-xs text-destructive">{tErr}</p>}
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Audit trail
          </div>
          {(!audit.data || audit.data.length === 0) ? (
            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Change</th>
                    <th className="px-3 py-2 text-left">Plate</th>
                    <th className="px-3 py-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audit.data.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{row.change_kind}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.old_plate ?? "—"} <span className="text-muted-foreground">→</span> {row.new_plate ?? "—"}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {row.old_vehicle_type ?? "—"} <span className="text-muted-foreground">→</span> {row.new_vehicle_type ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
