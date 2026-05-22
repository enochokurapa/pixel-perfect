import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LogIn, LogOut, AlertTriangle, Laptop, BadgeCheck, UserPlus } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Sentinel VMS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const me = useCurrentUser();

  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const now = new Date();
      const [insideRows, today, badges, withAssets] = await Promise.all([
        supabase.from("visits").select("id, check_in_at, expected_duration_minutes").eq("status", "checked_in"),
        supabase.from("visits").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("badges").select("id", { count: "exact", head: true }).eq("status", "issued"),
        supabase.from("visit_assets").select("visit_id", { count: "exact", head: true }),
      ]);
      const inside = insideRows.data ?? [];
      const overstay = inside.filter((v) => {
        if (!v.check_in_at) return false;
        const due = new Date(v.check_in_at).getTime() + (v.expected_duration_minutes ?? 180) * 60_000;
        return due < now.getTime();
      }).length;
      return {
        inside: inside.length,
        today: today.count ?? 0,
        overstay,
        badgesIssued: badges.count ?? 0,
        withAssets: withAssets.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("id, status, purpose, check_in_at, created_at, visit_type, badge_number, visitor:visitors(full_name, company), host:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Welcome, {me.profile?.full_name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-sm text-muted-foreground">Live overview of visitor activity across the premises.</p>
        </div>
        {me.canRegister && (
          <Button asChild>
            <Link to="/app/register"><UserPlus className="mr-2 h-4 w-4" />Register visitor</Link>
          </Button>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Visitors inside" value={stats.data?.inside} icon={Users} tone="info" />
        <StatCard label="Today's visits" value={stats.data?.today} icon={LogIn} tone="default" />
        <StatCard label="Overstayed" value={stats.data?.overstay} icon={AlertTriangle} tone="warning" />
        <StatCard label="Badges issued" value={stats.data?.badgesIssued} icon={BadgeCheck} tone="default" />
        <StatCard label="With assets" value={stats.data?.withAssets} icon={Laptop} tone="default" />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent visits</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link to="/app/visitors">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : recent.data?.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No visits yet. Register the first one.</div>
          ) : (
            <div className="divide-y divide-border">
              {recent.data?.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{v.visitor?.full_name ?? "Unknown"}{v.visitor?.company ? <span className="text-muted-foreground"> · {v.visitor.company}</span> : null}</div>
                    <div className="text-xs text-muted-foreground">Host: {v.host?.full_name ?? "—"} · {v.purpose}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.badge_number && <Badge variant="outline">#{v.badge_number}</Badge>}
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number | undefined; icon: any; tone: "default" | "info" | "warning" }) {
  const toneClass = {
    default: "bg-secondary text-secondary-foreground",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-10 w-10 place-items-center rounded-md ${toneClass}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-semibold tabular-nums">{value ?? "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
    checked_in: { label: "Inside", cls: "bg-success/15 text-success" },
    checked_out: { label: "Checked out", cls: "bg-secondary text-secondary-foreground" },
    overstayed: { label: "Overstayed", cls: "bg-warning/20 text-warning-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-secondary" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

// also exported for re-use
export { LogOut };
