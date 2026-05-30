import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, LogOut, Check, X } from "lucide-react";
import { respondToPickupAsGuardian } from "@/lib/school.functions";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "Guardian Portal" }] }),
  component: GuardianPortal,
});

function GuardianPortal() {
  const session = useSession();
  const me = useCurrentUser();
  const navigate = useNavigate();
  useEffect(() => { if (session === null) navigate({ to: "/login" }); }, [session, navigate]);

  const guardian = useQuery({
    enabled: !!me.userId,
    queryKey: ["my-guardian", me.userId],
    queryFn: async () => {
      const { data } = await supabase.from("guardians").select("id, full_name, email").eq("user_id", me.userId!).maybeSingle();
      return data;
    },
  });

  const myStudents = useQuery({
    enabled: !!guardian.data?.id,
    queryKey: ["my-students", guardian.data?.id],
    queryFn: async () => {
      const { data: links } = await supabase.from("student_guardians").select("student_id").eq("guardian_id", guardian.data!.id);
      const ids = (links ?? []).map((l) => l.student_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("students").select("id, full_name, class").in("id", ids);
      return data ?? [];
    },
  });

  const requests = useQuery({
    enabled: !!myStudents.data?.length,
    queryKey: ["my-pickups", myStudents.data?.map((s) => s.id).join(",")],
    queryFn: async () => {
      const ids = (myStudents.data ?? []).map((s) => s.id);
      const { data } = await supabase.from("pickup_requests")
        .select("id, status, pickup_person_name, pickup_person_phone, vehicle_plate, requested_at, rejection_reason, student_id")
        .in("student_id", ids).order("requested_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    refetchInterval: 4000,
  });

  const attendance = useQuery({
    enabled: !!myStudents.data?.length,
    queryKey: ["my-attendance", myStudents.data?.map((s) => s.id).join(",")],
    queryFn: async () => {
      const ids = (myStudents.data ?? []).map((s) => s.id);
      const { data } = await supabase.from("attendance_logs")
        .select("id, student_id, check_in_at, check_out_at, check_in_method")
        .in("student_id", ids).order("check_in_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const respondFn = useServerFn(respondToPickupAsGuardian);
  const respond = useMutation({
    mutationFn: async ({ id, response, reason }: { id: string; response: "approved" | "rejected"; reason?: string }) =>
      respondFn({ data: { pickup_request_id: id, response, reason: reason ?? null } }),
    onSuccess: () => { toast.success("Response recorded"); requests.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (session === undefined) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!session) return null;

  const studentName = (id: string) => myStudents.data?.find((s) => s.id === id)?.full_name ?? "Student";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Guardian Portal</div>
            <div className="text-xs text-muted-foreground">Welcome{guardian.data?.full_name ? `, ${guardian.data.full_name}` : ""}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>
          <LogOut className="h-4 w-4 mr-1" /> Sign out
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Pending pickup approvals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(requests.data ?? []).filter((r) => r.status === "pending").map((r) => (
              <PickupRow key={r.id} request={r} studentName={studentName(r.student_id)} onRespond={respond.mutate} />
            ))}
            {!(requests.data ?? []).some((r) => r.status === "pending") && <p className="text-sm text-muted-foreground">No pending requests.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My children</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {(myStudents.data ?? []).map((s) => <li key={s.id}>{s.full_name}{s.class ? ` — ${s.class}` : ""}</li>)}
              {!myStudents.data?.length && <li className="text-muted-foreground">No children linked yet.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attendance history</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase"><tr><th className="p-2">Child</th><th className="p-2">In</th><th className="p-2">Method</th><th className="p-2">Out</th></tr></thead>
                <tbody>
                  {(attendance.data ?? []).map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">{studentName(a.student_id)}</td>
                      <td className="p-2">{new Date(a.check_in_at).toLocaleString()}</td>
                      <td className="p-2 capitalize">{a.check_in_method}</td>
                      <td className="p-2">{a.check_out_at ? new Date(a.check_out_at).toLocaleString() : <span className="text-muted-foreground">In school</span>}</td>
                    </tr>
                  ))}
                  {!attendance.data?.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No history yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Past approvals (audit)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(requests.data ?? []).filter((r) => r.status !== "pending").map((r) => (
                <li key={r.id} className="rounded-md border p-2">
                  <div className="flex justify-between">
                    <span>{studentName(r.student_id)} — {r.pickup_person_name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    {r.status === "approved" && <Badge className="bg-green-600">Approved</Badge>}
                    {r.status === "rejected" && <Badge variant="destructive">Rejected{r.rejection_reason ? ` — ${r.rejection_reason}` : ""}</Badge>}
                    {r.status === "expired" && <Badge variant="secondary">Expired</Badge>}
                  </div>
                </li>
              ))}
              {!(requests.data ?? []).some((r) => r.status !== "pending") && <p className="text-muted-foreground">No past responses.</p>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PickupRow({ request, studentName, onRespond }: {
  request: { id: string; pickup_person_name: string; pickup_person_phone: string | null; vehicle_plate: string | null; requested_at: string };
  studentName: string;
  onRespond: (args: { id: string; response: "approved" | "rejected"; reason?: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="text-sm">
        <strong>{request.pickup_person_name}</strong> is at the gate to pick up <strong>{studentName}</strong>.
        {request.pickup_person_phone && <> Phone: {request.pickup_person_phone}.</>}
        {request.vehicle_plate && <> Plate: {request.vehicle_plate}.</>}
      </div>
      <div className="text-xs text-muted-foreground">Requested {new Date(request.requested_at).toLocaleString()} — link expires after 30 min.</div>
      {showReject ? (
        <div className="space-y-2">
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => onRespond({ id: request.id, response: "rejected", reason })}><X className="h-3 w-3 mr-1" /> Confirm reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onRespond({ id: request.id, response: "approved" })}><Check className="h-3 w-3 mr-1" /> Approve</Button>
          <Button size="sm" variant="outline" onClick={() => setShowReject(true)}><X className="h-3 w-3 mr-1" /> Reject</Button>
        </div>
      )}
    </div>
  );
}
