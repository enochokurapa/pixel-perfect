import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, GraduationCap } from "lucide-react";
import { createStudent, createGuardian } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/app/students")({
  head: () => ({ meta: [{ title: "Students — Sentinel VMS" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const scoped = !me.canViewAllBranches ? me.branchId : null;
  const [openNew, setOpenNew] = useState(false);
  const [openGuardian, setOpenGuardian] = useState(false);

  const students = useQuery({
    queryKey: ["students", scoped ?? "all"],
    queryFn: async () => {
      let q = supabase.from("students").select("id, full_name, student_code, class, branch_id, is_active, created_at").order("full_name");
      if (scoped) q = q.eq("branch_id", scoped);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const guardians = useQuery({
    queryKey: ["guardians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("guardians").select("id, full_name, email, phone, user_id").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createStudentFn = useServerFn(createStudent);
  const createGuardianFn = useServerFn(createGuardian);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6" /> Students</h1>
          <p className="text-sm text-muted-foreground">Manage student roster and guardians.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openGuardian} onOpenChange={setOpenGuardian}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Add guardian</Button></DialogTrigger>
            <GuardianForm onDone={() => { setOpenGuardian(false); qc.invalidateQueries({ queryKey: ["guardians"] }); }} createFn={createGuardianFn} />
          </Dialog>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add student</Button></DialogTrigger>
            <StudentForm
              branchId={me.branchId}
              guardians={guardians.data ?? []}
              createFn={createStudentFn}
              onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["students"] }); }}
            />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Roster</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase">
                <tr><th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Class</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {(students.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-medium">{s.full_name}</td>
                    <td className="p-3 text-muted-foreground">{s.student_code ?? "—"}</td>
                    <td className="p-3">{s.class ?? "—"}</td>
                    <td className="p-3">{s.is_active ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
                  </tr>
                ))}
                {!students.data?.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No students yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Go to <Link to="/app/attendance" className="underline">Attendance</Link> to check students in, or <Link to="/app/pickup" className="underline">Pickup Control</Link> to release them.
      </div>
    </div>
  );
}

function StudentForm({ branchId, guardians, createFn, onDone }: {
  branchId: string | null;
  guardians: { id: string; full_name: string }[];
  createFn: ReturnType<typeof useServerFn<typeof createStudent>>;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [klass, setKlass] = useState("");
  const [primaryGuardian, setPrimaryGuardian] = useState<string>("");
  const m = useMutation({
    mutationFn: async () => createFn({ data: {
      full_name: fullName,
      student_code: code || null,
      class: klass || null,
      branch_id: branchId,
      guardian_ids: primaryGuardian ? [primaryGuardian] : [],
      primary_guardian_id: primaryGuardian || null,
    } }),
    onSuccess: () => { toast.success("Student added"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New student</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Student code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><Label>Class</Label><Input value={klass} onChange={(e) => setKlass(e.target.value)} /></div>
        </div>
        <div>
          <Label>Primary guardian</Label>
          <Select value={primaryGuardian} onValueChange={setPrimaryGuardian}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              {guardians.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={!fullName || m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function GuardianForm({ createFn, onDone }: {
  createFn: ReturnType<typeof useServerFn<typeof createGuardian>>;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: async () => createFn({ data: { full_name: fullName, email, phone: phone || null, password: password || undefined, create_portal_account: true } }),
    onSuccess: () => { toast.success("Guardian created with portal access"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New guardian</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><Label>Email (portal login)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>Portal password (min 8 chars)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={!fullName || !email || m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
