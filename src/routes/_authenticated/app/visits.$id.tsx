import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, LogIn, LogOut, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./index";

export const Route = createFileRoute("/_authenticated/app/visits/$id")({
  head: () => ({ meta: [{ title: "Visit detail — Sentinel VMS" }] }),
  component: VisitDetail,
});

function VisitDetail() {
  const { id } = Route.useParams();
  const me = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();

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
    mutationFn: async (patch: Record<string, any>) => {
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

  const isHost = v.host_id === me.userId;
  const canStaffEdit = me.isAdmin || me.isReceptionist;

  const approve = () => update.mutate({ approval: "approved" });
  const reject = (reason: string) => update.mutate({ approval: "rejected", rejection_reason: reason, status: "cancelled" });
  const checkIn = () => update.mutate({ status: "checked_in", check_in_at: new Date().toISOString() });
  const checkOut = async () => {
    await update.mutateAsync({ status: "checked_out", check_out_at: new Date().toISOString() });
    if (v.badge_number) {
      await supabase.from("badges").update({ status: "available" }).eq("badge_number", v.badge_number);
      qc.invalidateQueries();
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/visitors" })} className="-ml-2">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to visitors
        </Button>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold">{v.visitor?.full_name}</h1>
              <StatusBadge status={v.status} />
              {v.pre_registered && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Pre-registered · {v.approval}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              {v.visit_type} · {v.visit_mode.replace("_", " ")} · {v.visitor?.company ?? "No company"}
            </p>
          </div>
          <div className="flex gap-2">
            {isHost && v.approval === "pending" && (
              <>
                <RejectButton onReject={reject} disabled={update.isPending} />
                <Button onClick={approve} disabled={update.isPending}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
              </>
            )}
            {canStaffEdit && v.status === "pending" && v.approval !== "rejected" && (
              <Button onClick={checkIn} disabled={update.isPending}>
                <LogIn className="mr-1 h-4 w-4" /> Check in
              </Button>
            )}
            {canStaffEdit && v.status === "checked_in" && (
              <Button variant="outline" onClick={checkOut} disabled={update.isPending}>
                <LogOut className="mr-1 h-4 w-4" /> Check out
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Visit information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <Info label="Purpose" value={v.purpose} />
            <Info label="Host" value={v.host?.full_name ?? "—"} />
            <Info label="Badge" value={v.badge_number ? `#${v.badge_number}` : "—"} />
            <Info label="Expected duration" value={`${v.expected_duration_minutes} min`} />
            <Info label="Checked in" value={v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"} />
            <Info label="Checked out" value={v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "—"} />
            {v.visit_mode === "drive_in" && (
              <>
                <Info label="Vehicle plate" value={v.vehicle_plate ?? "—"} />
                <Info label="Vehicle type" value={v.vehicle_type ?? "—"} />
              </>
            )}
            {v.work_description && <Info label="Work description" value={v.work_description} className="sm:col-span-2" />}
            {v.rejection_reason && (
              <Info label="Rejection reason" value={v.rejection_reason} className="sm:col-span-2 text-destructive" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Visitor</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Phone" value={v.visitor?.phone ?? "—"} />
            <Info label="Email" value={v.visitor?.email ?? "—"} />
            <Info label="Company" value={v.visitor?.company ?? "—"} />
            {(me.isAdmin || me.isReceptionist) && (
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link to="/app/blacklist">
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Manage blacklist
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <AssetsCard
        visitId={id}
        items={assets.data ?? []}
        canEdit={canStaffEdit}
        onChange={() => qc.invalidateQueries({ queryKey: ["visit-assets", id] })}
      />

      {(isHost || canStaffEdit) && v.status === "checked_out" && (
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

function RejectButton({ onReject, disabled }: { onReject: (reason: string) => void; disabled?: boolean }) {
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
      <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-48" />
      <Button variant="destructive" size="sm" onClick={() => { if (reason.trim()) onReject(reason.trim()); }} disabled={disabled}>
        Confirm
      </Button>
    </div>
  );
}

function AssetsCard({ visitId, items, canEdit, onChange }: { visitId: string; items: any[]; canEdit: boolean; onChange: () => void }) {
  const [kind, setKind] = useState<"device" | "vehicle" | "tool" | "other">("device");
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
    if (error) { toast.error(error.message); return; }
    setBrand(""); setSerial(""); setDescription("");
    toast.success("Asset recorded");
    onChange();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("visit_assets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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
              <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="device">Device</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
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
                <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /></Button>
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

function FeedbackCard({ visitId, initial, onSaved }: { visitId: string; initial: string | null; onSaved: () => void }) {
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("visits").update({ feedback: text }).eq("id", visitId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
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
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="How did the visit go?" />
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save feedback"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
