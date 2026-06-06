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
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { getKioskBranchInfo, submitKioskRegistration } from "@/lib/kiosk.functions";

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

  const [done, setDone] = useState(false);
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
        },
      }),
    onSuccess: () => setDone(true),
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

  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-3 p-10">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="font-display text-2xl font-semibold">You're registered</h1>
            <p className="text-sm text-muted-foreground">
              Your host has been notified. Please take a seat — reception will issue your badge shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
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

            <Button
              size="lg"
              className="w-full"
              disabled={
                submit.isPending ||
                !form.full_name.trim() ||
                !form.phone.trim() ||
                !form.host_id ||
                !form.purpose.trim()
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
