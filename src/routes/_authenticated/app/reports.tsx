import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import { useEffectiveBranchFilter } from "@/hooks/use-branch-scope";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({ meta: [{ title: "Reports — Sentinel VMS" }] }),
  component: ReportsPage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

type VisitRow = {
  id: string;
  visit_type: string;
  visit_mode: string;
  status: string;
  approval: string;
  pre_registered: boolean;
  kiosk_self_registered: boolean | null;
  check_in_at: string | null;
  check_out_at: string | null;
  created_at: string;
  badge_number: string | null;
  vehicle_plate: string | null;
  expected_duration_minutes: number;
  purpose: string;
  branch_id: string | null;
  visitor: { full_name: string; phone: string; company: string | null } | null;
  host: { full_name: string; department: string | null } | null;
  branch: { name: string } | null;
};

function ReportsPage() {
  const me = useCurrentUser();
  const branchFilter = useEffectiveBranchFilter();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [tab, setTab] = useState("overview");

  const visits = useQuery({
    enabled: me.canViewReports,
    queryKey: ["reports", from, to, type, status, branchFilter],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select(
          "id, visit_type, visit_mode, status, approval, pre_registered, kiosk_self_registered, check_in_at, check_out_at, created_at, badge_number, vehicle_plate, expected_duration_minutes, purpose, branch_id, visitor:visitors(full_name, phone, company), host:profiles(full_name, department), branch:branches(name)",
        )
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (branchFilter.kind === "eq") q = q.eq("branch_id", branchFilter.branchId);
      else if (branchFilter.kind === "in" && branchFilter.branchIds.length > 0)
        q = q.in("branch_id", branchFilter.branchIds);
      else if (branchFilter.kind === "in") return [] as VisitRow[];
      if (type !== "all") q = q.eq("visit_type", type as "guest" | "supplier" | "contractor");
      if (status !== "all") q = q.eq("status", status as "pending" | "checked_in" | "checked_out" | "overstayed");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as VisitRow[];
    },
  });

  if (!me.canViewReports) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view reports.
        </p>
      </div>
    );
  }

  const rows = visits.data ?? [];

  const agg = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byHost: Record<string, { name: string; dept: string | null; count: number }> = {};
    const byDept: Record<string, number> = {};
    const byVisitor: Record<string, { name: string; phone: string; count: number }> = {};
    const byBranch: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byWeek: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byHour: number[] = Array.from({ length: 24 }, () => 0);
    const byVehicleDay: Record<string, number> = {};
    const byVehicleCompany: Record<string, number> = {};
    let walkIn = 0;
    let preReg = 0;
    rows.forEach((v) => {
      byType[v.visit_type] = (byType[v.visit_type] ?? 0) + 1;
      byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
      const c = v.visitor?.company ?? "Unknown";
      byCompany[c] = (byCompany[c] ?? 0) + 1;
      if (v.host?.full_name) {
        const k = v.host.full_name;
        byHost[k] = byHost[k]
          ? { ...byHost[k], count: byHost[k].count + 1 }
          : { name: k, dept: v.host.department ?? null, count: 1 };
      }
      const dept = v.host?.department ?? "Unassigned";
      byDept[dept] = (byDept[dept] ?? 0) + 1;
      if (v.visitor?.phone) {
        const k = v.visitor.phone;
        byVisitor[k] = byVisitor[k]
          ? { ...byVisitor[k], count: byVisitor[k].count + 1 }
          : { name: v.visitor.full_name, phone: k, count: 1 };
      }
      const bname = v.branch?.name ?? "Unassigned";
      byBranch[bname] = (byBranch[bname] ?? 0) + 1;
      const d = new Date(v.created_at);
      const day = d.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      // ISO week
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const wk = weekStart.toISOString().slice(0, 10);
      byWeek[wk] = (byWeek[wk] ?? 0) + 1;
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[mo] = (byMonth[mo] ?? 0) + 1;
      const hourSource = v.check_in_at ?? v.created_at;
      if (hourSource) byHour[new Date(hourSource).getHours()] += 1;
      if (v.vehicle_plate) {
        byVehicleDay[day] = (byVehicleDay[day] ?? 0) + 1;
        byVehicleCompany[c] = (byVehicleCompany[c] ?? 0) + 1;
      }
      if (v.pre_registered) preReg += 1;
      else walkIn += 1;
    });
    return {
      byType,
      byStatus,
      byCompany: Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15),
      byHost: Object.values(byHost).sort((a, b) => b.count - a.count).slice(0, 15),
      byDept: Object.entries(byDept).sort((a, b) => b[1] - a[1]),
      frequent: Object.values(byVisitor).sort((a, b) => b.count - a.count).slice(0, 15),
      byBranch: Object.entries(byBranch).sort((a, b) => b[1] - a[1]),
      byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)),
      byWeek: Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b)),
      byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)),
      byHour,
      byVehicleDay: Object.entries(byVehicleDay).sort(([a], [b]) => a.localeCompare(b)),
      byVehicleCompany: Object.entries(byVehicleCompany).sort((a, b) => b[1] - a[1]).slice(0, 15),
      walkIn,
      preReg,
    };
  }, [rows]);

  const now = Date.now();
  const inside = rows.filter((r) => r.status === "checked_in");
  const overstayed = inside.filter((r) => {
    if (!r.check_in_at) return false;
    return new Date(r.check_in_at).getTime() + r.expected_duration_minutes * 60_000 < now;
  });
  const unapproved = rows.filter((r) => r.approval === "pending" || r.approval === "rejected");
  const missed = rows.filter(
    (r) =>
      r.pre_registered &&
      !r.check_in_at &&
      new Date(r.created_at).getTime() + r.expected_duration_minutes * 60_000 < now,
  );

  const blacklistedVisitors = useQuery({
    enabled: me.canViewReports,
    queryKey: ["reports", "blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist")
        .select("reason, created_at, active, visitor:visitors(full_name, phone, company)")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportRows = (filename: string, headers: string[], data: unknown[][]) => {
    const escape = (s: unknown) => {
      const str = s == null ? "" : String(s);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.join(",")];
    data.forEach((row) => lines.push(row.map(escape).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFull = () =>
    exportRows(
      `visits_${from}_to_${to}.csv`,
      ["Created", "Visitor", "Phone", "Company", "Host", "Department", "Branch", "Type", "Mode", "Pre-registered", "Status", "Approval", "Badge", "Vehicle", "Check-in", "Check-out", "Purpose"],
      rows.map((v) => [
        v.created_at, v.visitor?.full_name, v.visitor?.phone, v.visitor?.company,
        v.host?.full_name, v.host?.department, v.branch?.name,
        v.visit_type, v.visit_mode, v.pre_registered ? "Yes" : "No",
        v.status, v.approval, v.badge_number, v.vehicle_plate,
        v.check_in_at, v.check_out_at, v.purpose,
      ]),
    );

  const peakMax = Math.max(1, ...agg.byHour);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} visits in selected range · scoped to active branch.
          </p>
        </div>
        <Button onClick={exportFull} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export full CSV
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Visitor type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checked_in">Checked-in</SelectItem>
                <SelectItem value="checked_out">Checked-out</SelectItem>
                <SelectItem value="overstayed">Overstayed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="now">Currently inside</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="By visitor type" rows={Object.entries(agg.byType).map(([k, v]) => [k, v])} />
            <ListCard title="By status" rows={Object.entries(agg.byStatus).map(([k, v]) => [k.replace("_", " "), v])} />
            <ListCard title="Walk-ins vs Pre-registered" rows={[["Walk-in", agg.walkIn], ["Pre-registered", agg.preReg]]} />
            <ListCard title="Visits per branch" rows={agg.byBranch} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Peak visitation hours</CardTitle>
              <CardDescription>Arrivals by hour-of-day.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {agg.byHour.map((count, h) => (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/70 transition-all"
                      style={{ height: `${(count / peakMax) * 100}%` }}
                      title={`${h}:00 — ${count} visits`}
                    />
                    <span className="text-[10px] text-muted-foreground tabular-nums">{h}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <ListCard title="Visitors per day" rows={agg.byDay} />
            <ListCard title="Visitors per week" rows={agg.byWeek.map(([k, v]) => [`Wk of ${k}`, v])} />
            <ListCard title="Visitors per month" rows={agg.byMonth} />
          </div>
        </TabsContent>

        <TabsContent value="people" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Most visited hosts (Visits per employee)" rows={agg.byHost.map((h) => [`${h.name}${h.dept ? ` · ${h.dept}` : ""}`, h.count])} />
            <ListCard title="Visits per department" rows={agg.byDept} />
            <ListCard title="Frequent visitors" rows={agg.frequent.map((f) => [`${f.name} · ${f.phone}`, f.count])} />
            <ListCard title="Frequent companies" rows={agg.byCompany} />
          </div>
        </TabsContent>

        <TabsContent value="now" className="space-y-4 pt-4">
          <VisitTable
            title={`Currently inside (${inside.length})`}
            rows={inside}
            onExport={() => exportRows(
              "currently_inside.csv",
              ["Visitor", "Company", "Host", "Branch", "Check-in", "Badge"],
              inside.map((v) => [v.visitor?.full_name, v.visitor?.company, v.host?.full_name, v.branch?.name, v.check_in_at, v.badge_number]),
            )}
          />
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Vehicle entries by date" rows={agg.byVehicleDay} />
            <ListCard title="Vehicle entries by company" rows={agg.byVehicleCompany} />
          </div>
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 pt-4">
          <VisitTable
            title={`Overstayed visitors (${overstayed.length})`}
            rows={overstayed}
            onExport={() => exportRows(
              "overstayed.csv",
              ["Visitor", "Host", "Check-in", "Expected mins"],
              overstayed.map((v) => [v.visitor?.full_name, v.host?.full_name, v.check_in_at, v.expected_duration_minutes]),
            )}
          />
          <VisitTable
            title={`Unapproved entries (${unapproved.length})`}
            rows={unapproved}
            onExport={() => exportRows(
              "unapproved.csv",
              ["Visitor", "Host", "Created", "Approval"],
              unapproved.map((v) => [v.visitor?.full_name, v.host?.full_name, v.created_at, v.approval]),
            )}
          />
          <VisitTable
            title={`Missed visitor appointments (${missed.length})`}
            rows={missed}
            onExport={() => exportRows(
              "missed.csv",
              ["Visitor", "Host", "Scheduled"],
              missed.map((v) => [v.visitor?.full_name, v.host?.full_name, v.created_at]),
            )}
          />
        </TabsContent>

        <TabsContent value="blacklist" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Blacklisted visitors ({blacklistedVisitors.data?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left">Visitor</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-left">Company</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                    <th className="px-5 py-3 text-left">Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(blacklistedVisitors.data ?? []).map((b, i) => {
                    const v = (b as { visitor?: { full_name: string; phone: string; company: string | null } | null }).visitor;
                    return (
                      <tr key={i}>
                        <td className="px-5 py-3">{v?.full_name ?? "—"}</td>
                        <td className="px-5 py-3">{v?.phone ?? "—"}</td>
                        <td className="px-5 py-3">{v?.company ?? "—"}</td>
                        <td className="px-5 py-3">{b.reason}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        {rows.map(([k, v]) => {
          const pct = Math.max(4, Math.round((v / max) * 100));
          return (
            <div key={k}>
              <div className="flex justify-between text-sm">
                <span className="capitalize truncate pr-2">{k}</span>
                <span className="tabular-nums font-medium">{v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function VisitTable({
  title,
  rows,
  onExport,
}: {
  title: string;
  rows: VisitRow[];
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={onExport} disabled={rows.length === 0}>
          <Download className="mr-1 h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Visitor</th>
                  <th className="px-4 py-2 text-left">Company</th>
                  <th className="px-4 py-2 text-left">Host</th>
                  <th className="px-4 py-2 text-left">Branch</th>
                  <th className="px-4 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.visitor?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.visitor?.company ?? "—"}</td>
                    <td className="px-4 py-2">{r.host?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.branch?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.check_in_at ?? r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
