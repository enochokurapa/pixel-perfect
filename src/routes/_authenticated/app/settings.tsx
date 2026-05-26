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
import { Trash2, KeyRound, UserPlus, ShieldCheck, Building2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  admin: {
    label: "Admin",
    description:
      "Full control. Manages branches, staff, roles, badges, blacklist, all visits and settings. Can create other admins.",
  },
  receptionist: {
    label: "Receptionist",
    description:
      "Front-desk: register walk-ins, check visitors in & out, assign badges, manage assets.",
  },
  security: {
    label: "Security",
    description:
      "Gate operations: check-in/out at gate, verify badges & assets, escort visitors, view blacklist.",
  },
  host: {
    label: "Host",
    description:
      "Receive own visitors: approve/reject pre-registered visits, get arrival notifications, extend stay.",
  },
};

function RoleChecklist({
  selected,
  onChange,
  disabledRoles = [],
  busy,
}: {
  selected: Role[];
  onChange: (next: Role[]) => void;
  disabledRoles?: Role[];
  busy?: boolean;
}) {
  return (
    <div className="space-y-2">
      {ALL_ROLES.map((r) => {
        const on = selected.includes(r);
        const isDisabled = disabledRoles.includes(r) || busy;
        return (
          <label
            key={r}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-2.5 text-sm transition-colors ${
              on ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
            } ${isDisabled ? "opacity-60" : ""}`}
          >
            <Checkbox
              checked={on}
              disabled={isDisabled}
              onCheckedChange={(c: boolean | "indeterminate") => {
                const next = c === true ? [...selected, r] : selected.filter((x) => x !== r);
                if (next.length === 0) {
                  toast.error("User must have at least one role");
                  return;
                }
                onChange(next);
              }}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium capitalize">{ROLE_INFO[r].label}</div>
              <div className="text-xs text-muted-foreground">{ROLE_INFO[r].description}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

type Branch = { id: string; name: string; location: string | null };

function Settings() {
  const me = useCurrentUser();
  const qc = useQueryClient();

  const createFn = useServerFn(createStaffMember);
  const updateRolesFn = useServerFn(updateStaffRoles);
  const deleteFn = useServerFn(deleteStaffMember);
  const resetFn = useServerFn(resetStaffPassword);

  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const users = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, position, department, phone, branch_id")
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
      branch_id?: string | null;
      roles: Role[];
    }) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Staff member created");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateRolesMut = useMutation({
    mutationFn: (payload: { user_id: string; roles: Role[] }) => updateRolesFn({ data: payload }),
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
    mutationFn: (payload: { user_id: string; password: string }) => resetFn({ data: payload }),
    onSuccess: () => toast.success("Password reset"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateProfileMut = useMutation({
    mutationFn: async (p: {
      id: string;
      branch_id: string | null;
      position: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ branch_id: p.branch_id, position: p.position })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage branches, staff accounts, roles, and positions.
        </p>
      </header>

      <BranchesCard branches={branches.data ?? []} />

      <CreateStaffCard
        branches={branches.data ?? []}
        onCreate={(p) => createMut.mutateAsync(p)}
        busy={createMut.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle>Staff & roles</CardTitle>
          <CardDescription>
            Toggle role chips to grant or revoke access. Assign a branch & position per staff member.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Branch / Position</th>
                  <th className="px-5 py-3 text-left">Roles</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data?.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium">{u.full_name}</div>
                      {u.department && (
                        <div className="text-[11px] text-muted-foreground">{u.department}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3 align-top">
                      <BranchPositionEditor
                        branches={branches.data ?? []}
                        branchId={u.branch_id ?? null}
                        position={u.position ?? ""}
                        onSave={(branch_id, position) =>
                          updateProfileMut.mutateAsync({ id: u.id, branch_id, position })
                        }
                      />
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          )}
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={updateRolesMut.isPending}
                            >
                              Edit roles
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-96">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Role permissions
                            </div>
                            <RoleChecklist
                              selected={u.roles}
                              disabledRoles={
                                u.id === me.userId && u.roles.includes("admin") ? ["admin"] : []
                              }
                              busy={updateRolesMut.isPending}
                              onChange={(next) =>
                                updateRolesMut.mutate({ user_id: u.id, roles: next })
                              }
                            />
                            {u.id === me.userId && (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                You can't remove your own Admin role here (locked for safety).
                              </p>
                            )}
                          </PopoverContent>
                        </Popover>
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

function BranchesCard({ branches }: { branches: Branch[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const addMut = useMutation({
    mutationFn: async (p: { name: string; location: string | null }) => {
      const { error } = await supabase.from("branches").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch added");
      setName("");
      setLocation("");
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch removed");
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Branches
        </CardTitle>
        <CardDescription>Add the office branches/locations of your organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>Branch name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HQ" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, address"
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || addMut.isPending}
              onClick={() =>
                addMut.mutate({ name: name.trim(), location: location.trim() || null })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add branch
            </Button>
          </div>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No branches yet. Add your first one above.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="font-medium">{b.name}</div>
                  {b.location && (
                    <div className="text-xs text-muted-foreground">{b.location}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Remove branch "${b.name}"?`)) delMut.mutate(b.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BranchPositionEditor({
  branches,
  branchId,
  position,
  onSave,
}: {
  branches: Branch[];
  branchId: string | null;
  position: string;
  onSave: (branchId: string | null, position: string | null) => Promise<unknown>;
}) {
  const [b, setB] = useState<string>(branchId ?? "");
  const [p, setP] = useState<string>(position);
  const dirty = (b || null) !== (branchId || null) || (p || "") !== (position || "");
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        <option value="">— No branch —</option>
        {branches.map((br) => (
          <option key={br.id} value={br.id}>
            {br.name}
          </option>
        ))}
      </select>
      <Input
        value={p}
        onChange={(e) => setP(e.target.value)}
        placeholder="Position / title"
        className="h-8 text-xs"
      />
      {dirty && (
        <Button
          size="sm"
          className="h-7 self-start text-xs"
          onClick={() => onSave(b || null, p.trim() || null)}
        >
          Save
        </Button>
      )}
    </div>
  );
}

function CreateStaffCard({
  onCreate,
  busy,
  branches,
}: {
  onCreate: (p: {
    full_name: string;
    email: string;
    password: string;
    position?: string | null;
    phone?: string | null;
    department?: string | null;
    branch_id?: string | null;
    roles: Role[];
  }) => Promise<unknown>;
  busy: boolean;
  branches: Branch[];
}) {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [branchId, setBranchId] = useState("");
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
      branch_id: branchId || null,
      roles,
    });
    setName("");
    setEmail("");
    setPassword("");
    setPosition("");
    setPhone("");
    setDepartment("");
    setBranchId("");
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
        <Field
          label="Initial password (8+ chars)"
          required
          type="text"
          value={password}
          onChange={setPassword}
        />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Position / title" value={position} onChange={setPosition} />
        <Field label="Department" value={department} onChange={setDepartment} />
        <div className="space-y-2">
          <Label>Branch</Label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">— No branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Roles <span className="text-destructive">*</span></Label>
          <p className="text-[11px] text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Tick every role this person should have. You can grant Admin to create another administrator.
          </p>
          <RoleChecklist selected={roles} onChange={setRoles} />
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
