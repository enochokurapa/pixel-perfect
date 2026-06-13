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
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import { useBranchScope, useEffectiveBranchFilter } from "@/hooks/use-branch-scope";
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
  LineChart,
  Line,
} from "recharts";
import { TileDetailModal, type TileKey } from "@/components/tile-detail-modal";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Sentinel VMS" }] }),
  component: Dashboard,
});

const PAGE_SIZE = 6;

function Dashboard() {
  const me = useCurrentUser();
  const branchScope = useBranchScope();
  const branchFilter = useEffectiveBranchFilter();
  const [page, setPage] = useState(0);
  const [openTile, setOpenTile] = useState<TileKey | null>(null);
  const scopedBranch = branchFilter.kind === "eq" ? branchFilter.branchId : null;
  const scopedIn = branchFilter.kind === "in" ? branchFilter.branchIds : null;
  const applyBranch = <T extends { eq: (col: string, val: string) => T; in: (col: string, val: string[]) => T }>(
    q: T,
  ): T => {
    if (scopedBranch) return q.eq("branch_id", scopedBranch);
    // Strict: an empty allowed-branch list must return no rows, never all rows
    if (scopedIn) return q.in("branch_id", scopedIn);
    return q;
  };

  const stats = useQuery({
    queryKey: ["dashboard", "stats", branchFilter],
    queryFn: async () => {
      const now = new Date();
      const insideQ = applyBranch(
        supabase
          .from("visits")
          .select("id, check_in_at, expected_duration_minutes")
          .eq("status", "checked_in"),
      );
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayQ = applyBranch(
        supabase
          .from("visits")
          .select("id", { count: "exact", head: true })
          .gte("check_in_at", todayStart.toISOString())
          .not("check_in_at", "is", null),
      );
      const preRegQ = applyBranch(
        supabase
          .from("visits")
          .select("id", { count: "exact", head: true })
          .eq("pre_registered", true)
          .eq("status", "pending")
          .neq("approval", "not_approved")
          .is("check_in_at", null),
      );
      const todayAssetsVisitsQ = applyBranch(
        supabase
          .from("visits")
          .select("id")
          .gte("check_in_at", todayStart.toISOString())
          .not("check_in_at", "is", null),
      );
      const [insideRows, today, badgesIssued, badgesAvailable, todayInVisits, preRegPending] = await Promise.all([
        insideQ,
        todayQ,
        applyBranch(supabase.from("badges").select("id", { count: "exact", head: true }).eq("status", "issued")),
        applyBranch(supabase.from("badges").select("id", { count: "exact", head: true }).eq("status", "available")),
        todayAssetsVisitsQ,
        preRegQ,
      ]);
      const inside = insideRows.data ?? [];
      const overstay = inside.filter((v) => {
        if (!v.check_in_at) return false;
        const due =
          new Date(v.check_in_at).getTime() + (v.expected_duration_minutes ?? 180) * 60_000;
        return due < now.getTime();
      }).length;
      // Count today's checked-in visits that have at least one asset
      const todayVisitIds = (todayInVisits.data ?? []).map((v) => v.id);
      let withAssetsCount = 0;
      if (todayVisitIds.length > 0) {
        const { data: assetRows } = await supabase
          .from("visit_assets")
          .select("visit_id")
          .in("visit_id", todayVisitIds);
        withAssetsCount = new Set((assetRows ?? []).map((a) => a.visit_id)).size;
      }
      return {
        inside: inside.length,
        today: today.count ?? 0,
        overstay,
        badgesIssued: badgesIssued.count ?? 0,
        badgesUnissued: badgesAvailable.count ?? 0,
        withAssets: withAssetsCount,
        preReg: preRegPending.count ?? 0,
      };


    },
    refetchInterval: 60_000,
  });

  // For charts — current week (Mon–Sat)
  const chartData = useQuery({
    queryKey: ["dashboard", "charts", branchFilter],
    queryFn: async () => {
      const now = new Date();
      const dow = now.getDay();
      const daysSinceMon = (dow + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysSinceMon);
      monday.setHours(0, 0, 0, 0);
      const q = applyBranch(
        supabase
          .from("visits")
          .select("created_at, visit_type, status, branch_id, host:profiles(department)")
          .gte("created_at", monday.toISOString()),
      );
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  // Monthly trend — last 12 months
  const monthlyTrend = useQuery({
    queryKey: ["dashboard", "monthly-trend", branchFilter],
    queryFn: async () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const q = applyBranch(
        supabase
          .from("visits")
          .select("created_at, branch_id")
          .gte("created_at", start.toISOString()),
      );
      const { data, error } = await q;
      if (error) throw error;
      const buckets: { label: string; key: string; count: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        buckets.push({
          label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          key: `${d.getFullYear()}-${d.getMonth()}`,
          count: 0,
        });
      }
      (data ?? []).forEach((r) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) b.count += 1;
      });
      return buckets.map((b) => ({ month: b.label, visits: b.count }));
    },
  });

  // Branch comparison — count per branch
  const branchComparison = useQuery({
    enabled: me.canViewAllBranches || (scopedIn?.length ?? 0) > 1,
    queryKey: ["dashboard", "branch-comparison", branchFilter],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const q = applyBranch(
        supabase
          .from("visits")
          .select("branch_id, branch:branches(name)")
          .gte("created_at", start.toISOString()),
      );
      const { data, error } = await q;
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        const name = (r as { branch?: { name?: string } | null }).branch?.name ?? "Unassigned";
        map[name] = (map[name] ?? 0) + 1;
      });
      return Object.entries(map).map(([name, count]) => ({ name, visits: count }));
    },
  });

  const visibleBranchIds = branchFilter.kind === "eq"
    ? [branchFilter.branchId]
    : branchFilter.kind === "in"
      ? branchFilter.branchIds
      : branchScope.availableBranches.map((b) => b.id);
  const branchDashboards = useQuery({
    enabled: visibleBranchIds.length > 1,
    queryKey: ["dashboard", "branch-cards", visibleBranchIds],
    queryFn: async () => {
      const [{ data: visits }, { data: badges }] = await Promise.all([
        supabase.from("visits").select("branch_id, status, check_in_at, expected_duration_minutes").in("branch_id", visibleBranchIds),
        supabase.from("badges").select("branch_id, status").in("branch_id", visibleBranchIds),
      ]);
      const now = Date.now();
      return visibleBranchIds.map((id) => {
        const branch = branchScope.availableBranches.find((b) => b.id === id);
        const branchVisits = (visits ?? []).filter((v) => v.branch_id === id);
        const inside = branchVisits.filter((v) => v.status === "checked_in");
        const overstay = inside.filter((v) => v.check_in_at && new Date(v.check_in_at).getTime() + (v.expected_duration_minutes ?? 180) * 60_000 < now).length;
        const branchBadges = (badges ?? []).filter((b) => b.branch_id === id);
        return {
          id,
          name: branch?.name ?? "Branch",
          today: branchVisits.filter((v) => new Date(v.check_in_at ?? "").toDateString() === new Date().toDateString()).length,
          inside: inside.length,
          overstay,
          availableBadges: branchBadges.filter((b) => b.status === "available").length,
        };
      });
    },
  });




  const { dailyData, typeData, statusData, departmentData } = useMemo(() => {
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
    const deptCounts: Record<string, number> = {};
    rows.forEach((r) => {
      typeCounts[r.visit_type] = (typeCounts[r.visit_type] ?? 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      const dept = (r as { host?: { department?: string } | null }).host?.department ?? "Unassigned";
      deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
    });
    return {
      dailyData: days,
      typeData: Object.entries(typeCounts).map(([name, value]) => ({ name, value })),
      statusData: Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace("_", " "),
        value,
      })),
      departmentData: Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, visits]) => ({ name, visits })),
    };
  }, [chartData.data]);

  const totalCount = useQuery({
    queryKey: ["dashboard", "recent-count", branchFilter],
    queryFn: async () => {
      const { count, error } = await applyBranch(supabase.from("visits").select("id", { count: "exact", head: true }));
      if (error) throw error;
      return count ?? 0;
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent", page, branchFilter],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await applyBranch(supabase
        .from("visits")
        .select(
          "id, status, approval, purpose, check_in_at, created_at, visit_type, badge_number, host_name, visitor:visitors(full_name, company), host:profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .range(from, to));
      if (error) throw error;
      return data;
    },
  });

  const pendingApprovals = useQuery({
    queryKey: ["dashboard", "pending-approvals"],
    queryFn: async () => {
      const { data, error } = await applyBranch(supabase
        .from("visits")
        .select(
          "id, purpose, created_at, visitor:visitors(full_name, company), host:profiles(full_name)",
        )
        .eq("approval", "pending")
        .eq("pre_registered", true)
        .order("created_at", { ascending: false })
        .limit(8));
      if (error) throw error;
      return data;
    },
  });

  const timeline = useQuery({
    queryKey: ["dashboard", "timeline", branchFilter],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();
      const visitsQ = applyBranch(
        supabase
          .from("visits")
          .select(
            "id, created_at, check_in_at, check_out_at, approval, status, pre_registered, rejection_reason, visitor:visitors(full_name, company), host:profiles(full_name)",
          )
          .gte("updated_at", sinceISO)
          .order("updated_at", { ascending: false })
          .limit(50),
      );
      const [{ data: visits }, { data: blacklist }] = await Promise.all([
        visitsQ,
        supabase
          .from("blacklist")
          .select("id, created_at, reason, active, visitor:visitors(full_name, company)")
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      type Ev = {
        id: string;
        at: string;
        kind: "created" | "approved" | "rejected" | "checked_in" | "checked_out" | "blacklisted" | "unblacklisted";
        visitor: string;
        company: string | null;
        detail: string;
        visitId?: string;
      };
      const events: Ev[] = [];
      (visits ?? []).forEach((v) => {
        const visitorName = (v as { visitor?: { full_name?: string; company?: string | null } | null }).visitor?.full_name ?? "Unknown";
        const company = (v as { visitor?: { company?: string | null } | null }).visitor?.company ?? null;
        const hostName = (v as { host?: { full_name?: string } | null }).host?.full_name ?? "—";
        events.push({ id: `${v.id}-c`, at: v.created_at, kind: "created", visitor: visitorName, company, detail: `${v.pre_registered ? "Pre-registered" : "Registered"} · host ${hostName}`, visitId: v.id });
        if (v.approval === "approved") events.push({ id: `${v.id}-a`, at: v.check_in_at ?? v.created_at, kind: "approved", visitor: visitorName, company, detail: `Approved by ${hostName}`, visitId: v.id });
        if (v.approval === "not_approved") events.push({ id: `${v.id}-r`, at: v.created_at, kind: "rejected", visitor: visitorName, company, detail: v.rejection_reason || "Rejected", visitId: v.id });
        if (v.check_in_at) events.push({ id: `${v.id}-i`, at: v.check_in_at, kind: "checked_in", visitor: visitorName, company, detail: `Checked in · host ${hostName}`, visitId: v.id });
        if (v.check_out_at) events.push({ id: `${v.id}-o`, at: v.check_out_at, kind: "checked_out", visitor: visitorName, company, detail: "Checked out", visitId: v.id });
      });
      (blacklist ?? []).forEach((b) => {
        const visitorName = (b as { visitor?: { full_name?: string; company?: string | null } | null }).visitor?.full_name ?? "Unknown";
        const company = (b as { visitor?: { company?: string | null } | null }).visitor?.company ?? null;
        events.push({
          id: `bl-${b.id}`,
          at: b.created_at,
          kind: b.active ? "blacklisted" : "unblacklisted",
          visitor: visitorName,
          company,
          detail: b.reason,
        });
      });
      return events
        .filter((e) => e.at && new Date(e.at).getTime() >= since.getTime())
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 30);
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

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Pre-registered (pending)" value={stats.data?.preReg} icon={CalendarClock} tone="info" onClick={() => setOpenTile("preReg")} />
        <StatCard label="Today's visits" value={stats.data?.today} icon={LogIn} tone="default" onClick={() => setOpenTile("today")} />
        <StatCard label="Visitors inside" value={stats.data?.inside} icon={Users} tone="info" onClick={() => setOpenTile("inside")} />
        <StatCard label="Overstayed" value={stats.data?.overstay} icon={AlertTriangle} tone="warning" onClick={() => setOpenTile("overstay")} />
        <StatCard label="Badges issued" value={stats.data?.badgesIssued} icon={BadgeCheck} tone="default" onClick={() => setOpenTile("badgesIssued")} />
        <StatCard label="Unissued badges" value={stats.data?.badgesUnissued} icon={BadgeMinus} tone="info" onClick={() => setOpenTile("badgesUnissued")} />
        <StatCard label="With assets (today)" value={stats.data?.withAssets} icon={Laptop} tone="default" onClick={() => setOpenTile("withAssets")} />
      </section>

      <TileDetailModal tile={openTile} onClose={() => setOpenTile(null)} branchId={scopedBranch} branchIds={visibleBranchIds.length > 0 ? visibleBranchIds : null} />

      {(branchDashboards.data?.length ?? 0) > 1 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branchDashboards.data?.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{b.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-2 text-center text-xs">
                <MiniStat label="Inside" value={b.inside} />
                <MiniStat label="Today" value={b.today} />
                <MiniStat label="Overstay" value={b.overstay} />
                <MiniStat label="Badges" value={b.availableBadges} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

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

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly visitor trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="visits" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visits by department (this week)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {departmentData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="visits" fill="hsl(280, 70%, 55%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {(branchComparison.data?.length ?? 0) > 1 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Branch comparison (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchComparison.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="visits" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
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
                        Host: {v.host?.full_name ?? v.host_name ?? "—"} · {v.purpose}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {v.badge_number && <Badge variant="outline">#{v.badge_number}</Badge>}
                      <StatusBadge status={v.status} approval={v.approval} />
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
  onClick,
}: {
  label: string;
  value: number | undefined;
  icon: any;
  tone: "default" | "info" | "warning";
  onClick?: () => void;
}) {
  const toneClass = {
    default: "bg-secondary text-secondary-foreground",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];
  return (
    <Card
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}
    >
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-2">
      <div className="font-display text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function StatusBadge({ status, approval }: { status: string; approval?: string | null }) {
  if (approval === "not_approved") {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
        Rejected
      </span>
    );
  }
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
