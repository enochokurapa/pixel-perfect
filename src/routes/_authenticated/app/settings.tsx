import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-session";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, KeyRound, UserPlus, ShieldCheck } from "lucide-react";
import {
  createStaffMember,
  deleteStaffMember,
  resetStaffPassword,
  updateStaffRoles,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Sentinel VMS" }] }),
  component: Settings,
});

type Role = "admin" | "receptionist" | "security" | "host";
const ALL_ROLES: Role[] = ["admin", "receptionist", "security", "host"];

function Settings() {
  const me = useCurrentUser();
  const qc = useQueryClient();

  const createFn = useServerFn(createStaffMember);
  const updateRolesFn = useServerFn(updateStaffRoles);
  const deleteFn = useServerFn(deleteStaffMember);
  const resetFn = useServerFn(resetStaffPassword);

  const users = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, position, department, phone")
        .order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []).map((p) => ({
        ...p,
        roles: (roles?.filter((r) => r.user_id === p.id).map((r) => r.role) ?? []) as Role[],
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: (payload: {
      full_name: string;
      email: string;
      password: string;
      position?: string | null;
      phone?: string | null;
      department?: string | null;
      roles: Role[];
    }) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Staff member created");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateRolesMut = useMutation({
    mutationFn: (payload: { user_id: string; roles: Role[] }) =>
      updateRolesFn({ data: payload }),
    onSuccess: () => {
      toast.success("Roles updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resetMut = useMutation({
    mutationFn: (payload: { user_id: string; password: string }) =>
      resetFn({ data: payload }),
    onSuccess: () => toast.success("Password reset"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Create staff accounts, assign roles, and manage access.
        </p>
      </header>

      <CreateStaffCard onCreate={(p) => createMut.mutateAsync(p)} busy={createMut.isPending} />

      <Card>
        <CardHeader>
          <CardTitle>Staff & roles</CardTitle>
          <CardDescription>
            Toggle role chips to grant or revoke access. Reset a password or remove an account from the right.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Roles</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data?.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{u.full_name}</div>
                      {(u.position || u.department) && (
                        <div className="text-[11px] text-muted-foreground">
                          {[u.position, u.department].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map((r) => {
                          const on = u.roles.includes(r);
                          const isSelf = u.id === me.userId;
                          const disable = isSelf && r === "admin" && on; // can't remove own admin
                          return (
                            <button
                              key={r}
                              disabled={disable || updateRolesMut.isPending}
                              onClick={() => {
                                const next = on
                                  ? u.roles.filter((x) => x !== r)
                                  : [...u.roles, r];
                                if (next.length === 0) {
                                  toast.error("User must have at least one role");
                                  return;
                                }
                                updateRolesMut.mutate({ user_id: u.id, roles: next });
                              }}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border transition-colors disabled:opacity-50 ${
                                on
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top text-right">
                      <RowActions
                        userId={u.id}
                        email={u.email}
                        isSelf={u.id === me.userId}
                        onReset={(pw) => resetMut.mutateAsync({ user_id: u.id, password: pw })}
                        onDelete={() => deleteMut.mutateAsync(u.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateStaffCard({
  onCreate,
  busy,
}: {
  onCreate: (p: {
    full_name: string;
    email: string;
    password: string;
    position?: string | null;
    phone?: string | null;
    department?: string | null;
    roles: Role[];
  }) => Promise<unknown>;
  busy: boolean;
}) {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [roles, setRoles] = useState<Role[]>(["host"]);

  const toggle = (r: Role) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const submit = async () => {
    if (!full_name.trim() || !email.trim() || password.length < 8 || roles.length === 0) {
      toast.error("Name, email, password (8+ chars) and at least one role required");
      return;
    }
    await onCreate({
      full_name: full_name.trim(),
      email: email.trim(),
      password,
      position: position.trim() || null,
      phone: phone.trim() || null,
      department: department.trim() || null,
      roles,
    });
    setName(""); setEmail(""); setPassword(""); setPosition(""); setPhone(""); setDepartment("");
    setRoles(["host"]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Create new staff member
        </CardTitle>
        <CardDescription>
          New users are activated immediately — share the email + password with them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" required value={full_name} onChange={setName} />
        <Field label="Email" required type="email" value={email} onChange={setEmail} />
        <Field label="Initial password (8+ chars)" required type="text" value={password} onChange={setPassword} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Position / title" value={position} onChange={setPosition} />
        <Field label="Department" value={department} onChange={setDepartment} />
        <div className="space-y-2 md:col-span-2">
          <Label>Roles *</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => {
              const on = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Admin = full access · Receptionist = front-desk check-in/out & badges · Security = gate check-in/out, badges & escort · Host = receive & approve own visits
          </p>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create staff member"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RowActions({
  userId: _userId,
  email,
  isSelf,
  onReset,
  onDelete,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
  onReset: (pw: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [resetting, setResetting] = useState(false);
  const [pw, setPw] = useState("");

  if (resetting) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password"
          className="h-8 w-40"
        />
        <Button
          size="sm"
          onClick={async () => {
            if (pw.length < 8) {
              toast.error("Min 8 characters");
              return;
            }
            await onReset(pw);
            setPw("");
            setResetting(false);
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setResetting(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => setResetting(true)} title="Reset password">
        <KeyRound className="h-3.5 w-3.5" />
      </Button>
      {!isSelf && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Permanently delete ${email}?`)) onDelete();
          }}
          title="Delete user"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
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
