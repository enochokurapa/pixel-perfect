import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

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

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Eng."];

function ReportsPage() {
  const me = useCurrentUser();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [salutation, setSalutation] = useState<string>("all");
  const [search, setSearch] = useState("");

  const scopedBranch = !me.canViewAllBranches ? me.branchId : null;

  const visits = useQuery({
    enabled: me.canViewReports,
    queryKey: ["reports", from, to, type, status, scopedBranch ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select(
          "id, visit_type, visit_mode, status, approval, check_in_at, check_out_at, created_at, badge_number, vehicle_plate, purpose, branch_id, visitor:visitors(full_name, phone, company, salutation), host:profiles(full_name)",
        )
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (type !== "all") q = q.eq("visit_type", type as "guest" | "supplier" | "contractor");
      if (status !== "all") q = q.eq("status", status as "pending" | "checked_in" | "checked_out" | "overstayed");
      if (scopedBranch) q = q.eq("branch_id", scopedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = visits.data ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((v) => {
      if (salutation !== "all" && (v.visitor?.salutation ?? "") !== salutation) return false;
      if (!s) return true;
      return (
        v.visitor?.full_name?.toLowerCase().includes(s) ||
        v.visitor?.phone?.toLowerCase().includes(s) ||
        v.visitor?.company?.toLowerCase().includes(s) ||
        v.visitor?.salutation?.toLowerCase().includes(s) ||
        v.host?.full_name?.toLowerCase().includes(s) ||
        v.badge_number?.toLowerCase().includes(s) ||
        v.purpose?.toLowerCase().includes(s)
      );
    });
  }, [visits.data, search, salutation]);

  const agg = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byVisitor: Record<string, { name: string; phone: string; count: number }> = {};
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, visits: 0 }));
    rows.forEach((v) => {
      byType[v.visit_type] = (byType[v.visit_type] ?? 0) + 1;
      byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
      const c = v.visitor?.company ?? "Unknown";
      byCompany[c] = (byCompany[c] ?? 0) + 1;
      if (v.visitor?.phone) {
        const k = v.visitor.phone;
        byVisitor[k] = byVisitor[k]
          ? { ...byVisitor[k], count: byVisitor[k].count + 1 }
          : { name: v.visitor.full_name, phone: k, count: 1 };
      }
      const hourSource = v.check_in_at ?? v.created_at;
      if (hourSource) byHour[new Date(hourSource).getHours()].visits += 1;
    });
    return {
      byType,
      byStatus,
      byCompany: Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10),
      frequent: Object.values(byVisitor).sort((a, b) => b.count - a.count).slice(0, 10),
      byHour,
    };
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      "Created", "Salutation", "Visitor", "Phone", "Company", "Host", "Type", "Mode",
      "Status", "Approval", "Badge", "Vehicle", "Check-in", "Check-out", "Purpose",
    ];
    const escape = (s: unknown) => {
      const str = s == null ? "" : String(s);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.join(",")];
    rows.forEach((v) => {
      lines.push([
        v.created_at, v.visitor?.salutation, v.visitor?.full_name, v.visitor?.phone, v.visitor?.company,
        v.host?.full_name, v.visit_type, v.visit_mode, v.status, v.approval,
        v.badge_number, v.vehicle_plate, v.check_in_at, v.check_out_at, v.purpose,
      ].map(escape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!me.canViewReports) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view reports. Ask an administrator for the “View &amp; export reports” role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {scopedBranch ? "Scoped to your branch." : "All branches."} Filter, search and export.
          </p>
        </div>
        <Button onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV ({rows.length})
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Name, phone, company, salutation, host, badge…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Salutation</Label>
            <Select value={salutation} onValueChange={setSalutation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By visitor type</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(agg.byType).map(([k, v]) => <Row key={k} label={k} value={v} max={rows.length} />)}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(agg.byStatus).map(([k, v]) => <Row key={k} label={k.replace("_", " ")} value={v} max={rows.length} />)}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top companies</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {agg.byCompany.map(([k, v]) => <Row key={k} label={k} value={v} max={agg.byCompany[0]?.[1] ?? 1} />)}
            {agg.byCompany.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frequent visitors</CardTitle>
            <CardDescription>Top 10 by visit count in range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agg.frequent.map((v) => (
              <Row key={v.phone} label={`${v.name} · ${v.phone}`} value={v.count} max={agg.frequent[0]?.count ?? 1} />
            ))}
            {agg.frequent.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peak hours</CardTitle>
          <CardDescription>Distribution of arrivals across the 24-hour day.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={1} />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(4, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="capitalize">{label}</span><span className="tabular-nums font-medium">{value}</span></div>
      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
