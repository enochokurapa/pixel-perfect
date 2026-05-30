import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Car, LogOut, AlertTriangle, Copy } from "lucide-react";
import { createPickupRequest } from "@/lib/school.functions";
import { checkOutStudent } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/app/pickup")({
  head: () => ({ meta: [{ title: "Pickup Control — Sentinel VMS" }] }),
  component: PickupPage,
});

function PickupPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const scoped = !me.canViewAllBranches ? me.branchId : null;
  const [studentId, setStudentId] = useState("");
  const [personName, setPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");

  const studentMap = useQuery({
    queryKey: ["students-map", scoped ?? "all"],
    queryFn: async () => {
      let q = supabase.from("students").select("id, full_name, class");
      if (scoped) q = q.eq("branch_id", scoped);
      const { data } = await q;
      return new Map((data ?? []).map((s) => [s.id, s]));
    },
  });

  const students = useQuery({
    queryKey: ["students-in-school", scoped ?? "all", studentMap.data?.size ?? 0],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      let q = supabase.from("attendance_logs")
        .select("id, student_id, check_in_method")
        .gte("check_in_at", start.toISOString())
        .is("check_out_at", null);
      if (scoped) q = q.eq("branch_id", scoped);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["pickup-requests", scoped ?? "all"],
    queryFn: async () => {
      let q = supabase.from("pickup_requests")
        .select("id, status, pickup_person_name, pickup_person_phone, vehicle_plate, requested_at, rejection_reason, student_id")
        .order("requested_at", { ascending: false }).limit(50);
      if (scoped) q = q.eq("branch_id", scoped);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const createFn = useServerFn(createPickupRequest);
  const checkOutFn = useServerFn(checkOutStudent);

  const createMut = useMutation({
    mutationFn: async () => createFn({ data: {
      student_id: studentId,
      pickup_person_name: personName,
      pickup_person_phone: phone || null,
      vehicle_plate: plate || null,
    } }),
    onSuccess: (res) => {
      toast.success("Pickup request sent to guardian.");
      const url = `${window.location.origin}/pickup-response/${res.token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.message("Approval link copied to clipboard", { description: url });
      setStudentId(""); setPersonName(""); setPhone(""); setPlate("");
      qc.invalidateQueries({ queryKey: ["pickup-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: async ({ attendanceId, pickupRequestId }: { attendanceId: string; pickupRequestId: string | null }) =>
      checkOutFn({ data: { attendance_id: attendanceId, pickup_request_id: pickupRequestId } }),
    onSuccess: () => {
      toast.success("Student released.");
      qc.invalidateQueries({ queryKey: ["students-in-school"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const studentChoices = (students.data ?? []).map((row) => {
    const s = studentMap.data?.get(row.student_id);
    return { attendanceId: row.id, studentId: row.student_id, label: s ? `${s.full_name}${s.class ? ` (${s.class})` : ""}` : "—", method: row.check_in_method };
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6" /> Pickup Control</h1>
        <p className="text-sm text-muted-foreground">Capture pickup attempts, get guardian approval, and release children safely.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New pickup request</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Student (currently in school)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {studentChoices.map((c) => <SelectItem key={c.studentId} value={c.studentId}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Pickup person name</Label><Input value={personName} onChange={(e) => setPersonName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Vehicle plate</Label><Input value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!studentId || !personName || createMut.isPending}>
            {createMut.isPending ? "Sending…" : "Send approval request"}
          </Button>
          <p className="text-xs text-muted-foreground">Approval link is valid for 30 minutes and single-use. The guardian will receive an in-app notification; share the copied link via email/SMS if needed.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent pickup requests</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase">
                <tr><th className="p-3">Student</th><th className="p-3">Pickup person</th><th className="p-3">Plate</th><th className="p-3">Status</th><th className="p-3">Action</th></tr>
              </thead>
              <tbody>
                {(requests.data ?? []).map((r) => {
                  const s = studentMap.data?.get(r.student_id);
                  const inSchool = studentChoices.find((c) => c.studentId === r.student_id);
                  const canRelease = r.status === "approved" && inSchool;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 font-medium">{s?.full_name ?? "—"}</td>
                      <td className="p-3">{r.pickup_person_name}{r.pickup_person_phone ? ` · ${r.pickup_person_phone}` : ""}</td>
                      <td className="p-3">{r.vehicle_plate ?? "—"}</td>
                      <td className="p-3">
                        {r.status === "pending" && <Badge variant="outline" className="text-amber-600 border-amber-300">Pending — do not release</Badge>}
                        {r.status === "approved" && <Badge className="bg-green-600">Approved</Badge>}
                        {r.status === "rejected" && <Badge variant="destructive">Rejected{r.rejection_reason ? ` — ${r.rejection_reason}` : ""}</Badge>}
                        {r.status === "expired" && <Badge variant="secondary">Expired</Badge>}
                      </td>
                      <td className="p-3">
                        {canRelease ? (
                          <Button size="sm" onClick={() => releaseMut.mutate({ attendanceId: inSchool.attendanceId, pickupRequestId: r.id })}>
                            <LogOut className="h-3 w-3 mr-1" /> Release
                          </Button>
                        ) : r.status === "pending" ? (
                          <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> No approval</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!requests.data?.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No pickup requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
