import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  LogIn,
  LogOut,
  AlertTriangle,
  Laptop,
  BadgeCheck,
  UserPlus,
  BadgeMinus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { TileDetailModal, type TileKey } from "@/components/tile-detail-modal";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Sentinel VMS" }] }),
  component: Dashboard,
});

const PAGE_SIZE = 6;

function Dashboard() {
  const me = useCurrentUser();
  const [page, setPage] = useState(0);
  const [openTile, setOpenTile] = useState<TileKey | null>(null);

  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const now = new Date();
      const [insideRows, today, badgesIssued, badgesAvailable, withAssets] = await Promise.all([
        supabase
          .from("visits")
          .select("id, check_in_at, expected_duration_minutes")
          .eq("status", "checked_in"),
        supabase
          .from("visits")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("badges").select("id", { count: "exact", head: true }).eq("status", "issued"),
        supabase
          .from("badges")
          .select("id", { count: "exact", head: true })
          .eq("status", "available"),
        supabase.from("visit_assets").select("visit_id", { count: "exact", head: true }),
      ]);
      const inside = insideRows.data ?? [];
      const overstay = inside.filter((v) => {
        if (!v.check_in_at) return false;
        const due =
          new Date(v.check_in_at).getTime() + (v.expected_duration_minutes ?? 180) * 60_000;
        return due < now.getTime();
      }).length;
      return {
        inside: inside.length,
        today: today.count ?? 0,
        overstay,
        badgesIssued: badgesIssued.count ?? 0,
        badgesUnissued: badgesAvailable.count ?? 0,
        withAssets: withAssets.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  // For charts — current week (Mon–Sat)
  const chartData = useQuery({
    queryKey: ["dashboard", "charts"],
    queryFn: async () => {
      const now = new Date();
      const dow = now.getDay();
      const daysSinceMon = (dow + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysSinceMon);
      monday.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("visits")
        .select("created_at, visit_type, status")
        .gte("created_at", monday.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const { dailyData, typeData, statusData } = useMemo(() => {
    const rows = chartData.data ?? [];
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = labels.map((day) => ({ day, visits: 0 }));
    const now = new Date();
    const dow = now.getDay();
    const daysSinceMon = (dow + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMon);
    monday.setHours(0, 0, 0, 0);
    rows.forEach((r) => {
      const created = new Date(r.created_at);
      const idx = Math.floor(
        (new Date(created).setHours(0, 0, 0, 0) - monday.getTime()) / 86400000,
      );
      if (idx >= 0 && idx < 6) days[idx].visits += 1;
    });

    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    rows.forEach((r) => {
      typeCounts[r.visit_type] = (typeCounts[r.visit_type] ?? 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    });
    return {
      dailyData: days,
      typeData: Object.entries(typeCounts).map(([name, value]) => ({ name, value })),
      statusData: Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace("_", " "),
        value,
      })),
    };
  }, [chartData.data]);

  const totalCount = useQuery({
    queryKey: ["dashboard", "recent-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("visits")
        .select(
          "id, status, purpose, check_in_at, created_at, visit_type, badge_number, visitor:visitors(full_name, company), host:profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data;
    },
  });

  const pendingApprovals = useQuery({
    queryKey: ["dashboard", "pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select(
          "id, purpose, created_at, visitor:visitors(full_name, company), host:profiles(full_name)",
        )
        .eq("approval", "pending")
        .eq("pre_registered", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const totalPages = Math.max(1, Math.ceil((totalCount.data ?? 0) / PAGE_SIZE));

  const PIE_COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(280, 70%, 55%)"];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Welcome, {me.profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Live overview of visitor activity across the premises.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to="/app/register">
              <UserPlus className="mr-2 h-4 w-4" />
              Register new visitor
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/app/pre-register">Pre-register</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Visitors inside" value={stats.data?.inside} icon={Users} tone="info" />
        <StatCard label="Today's visits" value={stats.data?.today} icon={LogIn} tone="default" />
        <StatCard label="Overstayed" value={stats.data?.overstay} icon={AlertTriangle} tone="warning" />
        <StatCard
          label="Badges issued"
          value={stats.data?.badgesIssued}
          icon={BadgeCheck}
          tone="default"
        />
        <StatCard
          label="Unissued badges"
          value={stats.data?.badgesUnissued}
          icon={BadgeMinus}
          tone="info"
        />
        <StatCard label="With assets" value={stats.data?.withAssets} icon={Laptop} tone="default" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visits — this week (Mon–Sat)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="visits" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visit type breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {typeData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Status distribution (this week)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {statusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {(pendingApprovals.data?.length ?? 0) > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Pending approvals ({pendingApprovals.data?.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {pendingApprovals.data?.map((v) => (
                <Link
                  key={v.id}
                  to="/app/visits/$id"
                  params={{ id: v.id }}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-3 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">
                      {v.visitor?.full_name}
                      {v.visitor?.company ? (
                        <span className="text-muted-foreground"> · {v.visitor.company}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Host: {v.host?.full_name ?? "—"} · {v.purpose}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-warning/40 text-warning-foreground">
                    Review
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent visits</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/visitors">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : recent.data?.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No visits yet. Register the first one.
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {recent.data?.map((v) => (
                  <Link
                    key={v.id}
                    to="/app/visits/$id"
                    params={{ id: v.id }}
                    className="-mx-2 flex items-center justify-between rounded px-2 py-3 hover:bg-muted/40"
                  >
                    <div>
                      <div className="font-medium">
                        {v.visitor?.full_name ?? "Unknown"}
                        {v.visitor?.company ? (
                          <span className="text-muted-foreground"> · {v.visitor.company}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Host: {v.host?.full_name ?? "—"} · {v.purpose}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {v.badge_number && <Badge variant="outline">#{v.badge_number}</Badge>}
                      <StatusBadge status={v.status} />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages} · {totalCount.data ?? 0} total
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: any;
  tone: "default" | "info" | "warning";
}) {
  const toneClass = {
    default: "bg-secondary text-secondary-foreground",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-10 w-10 place-items-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
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
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

export { LogOut };
