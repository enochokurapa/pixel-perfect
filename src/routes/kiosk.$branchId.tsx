import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { getKioskBranchInfo, submitKioskRegistration, getKioskVisitStatus } from "@/lib/kiosk.functions";

export const Route = createFileRoute("/kiosk/$branchId")({
  head: () => ({
    meta: [
      { title: "Visitor self-registration" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KioskPage,
});

function KioskPage() {
  const { branchId } = Route.useParams();
  const submitFn = useServerFn(submitKioskRegistration);
  const getInfo = useServerFn(getKioskBranchInfo);

  const info = useQuery({
    queryKey: ["kiosk-info", branchId],
    queryFn: () => getInfo({ data: { branch_id: branchId } }),
    retry: false,
  });

  const [submittedVisitId, setSubmittedVisitId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    company: "",
    id_type: "",
    id_number: "",
    purpose: "",
    host_id: "",
    arrival_mode: "walk_in" as "walk_in" | "drive_in",
    vehicle_plate: "",
    vehicle_type: "",
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          branch_id: branchId,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          id_type: form.id_type.trim(),
          id_number: form.id_number.trim(),
          purpose: form.purpose.trim(),
          host_id: form.host_id,
          arrival_mode: form.arrival_mode,
          vehicle_plate: form.arrival_mode === "drive_in" ? form.vehicle_plate.trim() : "",
          vehicle_type: form.arrival_mode === "drive_in" ? form.vehicle_type.trim() : "",
        },
      }),
    onSuccess: (res) => setSubmittedVisitId(res.visit_id),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (info.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }
  if (info.isError || !info.data) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Invalid QR code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This kiosk link is no longer active. Please ask reception for a new code.
          </p>
        </div>
      </div>
    );
  }

  if (submittedVisitId) {
    return <KioskProgress visitId={submittedVisitId} visitorName={form.full_name} />;
  }


  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Welcome to {info.data.branch.name}</h1>
          <p className="text-sm text-muted-foreground">
            Please fill in your details to register your visit.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>All fields with * are required.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Full name" required value={form.full_name} onChange={(v) => set("full_name", v)} />
            <Field label="Phone number" required value={form.phone} onChange={(v) => set("phone", v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
            <Field label="Company" value={form.company} onChange={(v) => set("company", v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ID type</Label>
                <Select value={form.id_type} onValueChange={(v) => set("id_type", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National ID">National ID</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="Driving License">Driving License</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="ID number" value={form.id_number} onChange={(v) => set("id_number", v)} />
            </div>

            <div className="space-y-2">
              <Label>
                Who are you here to see? <span className="text-destructive">*</span>
              </Label>
              <Select value={form.host_id} onValueChange={(v) => set("host_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {info.data.hosts.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No hosts available at this branch
                    </div>
                  )}
                  {info.data.hosts.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.full_name}
                      {h.position ? ` · ${h.position}` : ""}
                      {h.department ? ` (${h.department})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Purpose of visit <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>
                How are you arriving? <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={form.arrival_mode}
                onValueChange={(v) => set("arrival_mode", v as "walk_in" | "drive_in")}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  htmlFor="arr-walk"
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40"
                >
                  <RadioGroupItem id="arr-walk" value="walk_in" />
                  Walk-in
                </label>
                <label
                  htmlFor="arr-drive"
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40"
                >
                  <RadioGroupItem id="arr-drive" value="drive_in" />
                  Drive-in
                </label>
              </RadioGroup>
            </div>

            {form.arrival_mode === "drive_in" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Vehicle plate"
                  value={form.vehicle_plate}
                  onChange={(v) => set("vehicle_plate", v)}
                  required
                />
                <div className="space-y-2">
                  <Label>
                    Vehicle type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.vehicle_type} onValueChange={(v) => set("vehicle_type", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Car">Car</SelectItem>
                      <SelectItem value="SUV">SUV</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                      <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="Bicycle">Bicycle</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}


            <Button
              size="lg"
              className="w-full"
              disabled={
                submit.isPending ||
                !form.full_name.trim() ||
                !form.phone.trim() ||
                !form.host_id ||
                !form.purpose.trim() ||
                (form.arrival_mode === "drive_in" &&
                  (!form.vehicle_plate.trim() || !form.vehicle_type.trim()))
              }
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "Submitting…" : "Register my visit"}
            </Button>
          </CardContent>
        </Card>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function KioskProgress({ visitId, visitorName }: { visitId: string; visitorName: string }) {
  const statusFn = useServerFn(getKioskVisitStatus);
  const status = useQuery({
    queryKey: ["kiosk-visit-status", visitId],
    queryFn: () => statusFn({ data: { visit_id: visitId } }),
    refetchInterval: 4000,
  });

  const d = status.data;
  const rejected = d?.approval === "not_approved";
  const approved = d?.approval === "approved";
  const checkedIn = d?.status === "checked_in";
  const checkedOut = d?.status === "checked_out";

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString() : null;

  const steps = [
    {
      key: "submitted",
      title: "Registration submitted",
      desc: d?.host_name
        ? `Your request to see ${d.host_name} has been sent.`
        : "Your request has been sent.",
      time: fmt(d?.created_at),
      state: "done" as const,
    },
    {
      key: "approved",
      title: rejected ? "Not approved" : "Host approval",
      desc: rejected
        ? d?.rejection_reason || "Your host could not approve this visit. Please speak to reception."
        : approved
          ? "Your host approved. Reception is preparing your badge."
          : "Waiting for your host to approve…",
      time: approved ? fmt(d?.created_at) : null,
      state: rejected ? ("error" as const) : approved ? ("done" as const) : ("pending" as const),
    },
    {
      key: "checked_in",
      title: "Badge issued & checked in",
      desc: checkedOut
        ? "Visit complete — thank you!"
        : checkedIn
          ? d?.badge_number
            ? `Badge #${d.badge_number} issued. Please proceed.`
            : "You are checked in. Please proceed."
          : "Reception will verify any assets, capture your details and issue your badge.",
      time: fmt(d?.check_in_at),
      state: rejected
        ? ("blocked" as const)
        : checkedIn || checkedOut
          ? ("done" as const)
          : ("pending" as const),
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              {rejected ? (
                <XCircle className="h-6 w-6 text-destructive" />
              ) : checkedIn || checkedOut ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <h1 className="font-display text-2xl font-semibold">
              {rejected
                ? "Visit not approved"
                : checkedIn || checkedOut
                  ? "You're checked in"
                  : `Thank you, ${visitorName.split(" ")[0] || "visitor"}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {rejected
                ? "Please speak to reception for assistance."
                : approved && !checkedIn
                  ? "Approved — please wait while reception issues your badge."
                  : checkedIn || checkedOut
                    ? "Please proceed as directed."
                    : "Please take a seat — we'll update this screen as your visit progresses."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your visit progress</CardTitle>
            <CardDescription>This page updates automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((s, i) => (
              <div key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-full border ${
                      s.state === "done"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : s.state === "error"
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : s.state === "blocked"
                            ? "border-muted bg-muted text-muted-foreground"
                            : "border-primary/40 bg-primary/5 text-primary"
                    }`}
                  >
                    {s.state === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : s.state === "error" ? (
                      <XCircle className="h-4 w-4" />
                    ) : s.state === "pending" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  {i < steps.length - 1 && <div className="my-1 h-8 w-px bg-border" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                  {s.time && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{s.time}</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          Your reference: <span className="font-mono">{visitId.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

