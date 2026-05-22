import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-session";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Sentinel VMS" }] }),
  component: Settings,
});

function Settings() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const users = useQuery({
    enabled: me.isAdmin,
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []).map((p) => ({ ...p, roles: roles?.filter((r) => r.user_id === p.id).map((r) => r.role) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: string; role: "admin" | "receptionist" | "host"; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!me.isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admins only.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage staff roles and access.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Staff & roles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-3 text-left">Name</th><th className="px-5 py-3 text-left">Email</th><th className="px-5 py-3 text-left">Roles</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.full_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(["admin", "receptionist", "host"] as const).map((r) => {
                        const on = u.roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => setRole.mutate({ userId: u.id, role: r, on: !on })}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: ask staff to sign up first — they'll be created as Host. Toggle Admin/Receptionist here as needed.
        Email: <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 max-w-xs inline-block" placeholder="Find by email" />
      </p>
    </div>
  );
}
