import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogIn, ClipboardList } from "lucide-react";
import { checkInStudent } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Sentinel VMS" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const scoped = !me.canViewAllBranches ? me.branchId : null;
  const [studentId, setStudentId] = useState("");
  const [method, setMethod] = useState<"van" | "parent" | "walking" | "other">("parent");

  const students = useQuery({
    queryKey: ["students", scoped ?? "all"],
    queryFn: async () => {
      let q = supabase.from("students").select("id, full_name, class").order("full_name");
      if (scoped) q = q.eq("branch_id", scoped);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const today = useQuery({
    queryKey: ["attendance", "today", scoped ?? "all"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      let q = supabase.from("attendance_logs")
        .select("id, student_id, check_in_at, check_out_at, check_in_method, students(full_name, class)")
        .gte("check_in_at", start.toISOString())
        .order("check_in_at", { ascending: false });
      if (scoped) q = q.eq("branch_id", scoped);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const checkInFn = useServerFn(checkInStudent);
  const m = useMutation({
    mutationFn: async () => checkInFn({ data: { student_id: studentId, check_in_method: method } }),
    onSuccess: () => {
      toast.success("Student checked in. Guardian notified.");
      setStudentId("");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Student Attendance</h1>
        <p className="text-sm text-muted-foreground">Record student arrival and notify guardians.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Check in a student</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {(students.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}{s.class ? ` (${s.class})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arrival method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent drop-off</SelectItem>
                  <SelectItem value="van">School van</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => m.mutate()} disabled={!studentId || m.isPending}>
                <LogIn className="h-4 w-4 mr-1" /> {m.isPending ? "Saving…" : "Check in"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today's log</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase">
                <tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Arrived</th><th className="p-3">Method</th><th className="p-3">Left</th></tr>
              </thead>
              <tbody>
                {(today.data ?? []).map((l) => {
                  const s = (l as { students: { full_name: string; class: string | null } | null }).students;
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="p-3 font-medium">{s?.full_name ?? "—"}</td>
                      <td className="p-3">{s?.class ?? "—"}</td>
                      <td className="p-3">{new Date(l.check_in_at).toLocaleTimeString()}</td>
                      <td className="p-3 capitalize">{l.check_in_method}</td>
                      <td className="p-3">{l.check_out_at ? new Date(l.check_out_at).toLocaleTimeString() : <span className="text-muted-foreground">In school</span>}</td>
                    </tr>
                  );
                })}
                {!today.data?.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No check-ins today.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
