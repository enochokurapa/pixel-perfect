import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, X, UserPlus, CheckCircle2, XCircle, LogIn, LogOut, ShieldAlert, Clock, Activity, Camera, IdCard } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import { useBranchScope, useEffectiveBranchFilter } from "@/hooks/use-branch-scope";
import { exportCsv, exportExcel, exportPdf, exportPhotoPdf, type ExportRow } from "@/lib/visit-export";
import { formatActionLabel, formatDetails } from "@/lib/audit-format";


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
  host_name: string | null;
  vehicle_plate: string | null;
  expected_duration_minutes: number;
  purpose: string;
  branch_id: string | null;
  assets_verified: boolean | null;
  badge_returned: boolean | null;
  rejection_reason: string | null;
  face_photo_url: string | null;
  id_photo_url: string | null;
  id_photo_type: string | null;
  photos_captured_at: string | null;
  visitor: { full_name: string; phone: string; company: string | null } | null;
  host: { full_name: string; department: string | null } | null;
  branch: { name: string } | null;
};

const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : "");

const toVisitExportRows = (rows: VisitRow[]): ExportRow[] =>
  rows.map((v) => ({
    Created: fmtDate(v.created_at),
    Visitor: v.visitor?.full_name ?? "",
    Phone: v.visitor?.phone ?? "",
    Company: v.visitor?.company ?? "",
    Host: v.host?.full_name ?? v.host_name ?? "",
    Department: v.host?.department ?? "",
    Branch: v.branch?.name ?? "",
    Type: v.visit_type,
    Mode: v.visit_mode,
    "Pre-registered": v.pre_registered ? "Yes" : "No",
    Status: v.approval === "not_approved" ? "rejected" : v.status,
    Approval: v.approval,
    Badge: v.badge_number ?? "",
    Vehicle: v.vehicle_plate ?? "",
    "Check-in": fmtDate(v.check_in_at),
    "Check-out": fmtDate(v.check_out_at),
    Purpose: v.purpose,
  }));

const csvExport = (filename: string, data: ExportRow[]) => {
  const headers = data.length ? Object.keys(data[0]) : [];
  const escape = (s: unknown) => {
    const str = s == null ? "" : String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  data.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function ReportsPage() {
  const me = useCurrentUser();
  const branchFilter = useEffectiveBranchFilter();
  const branchScope = useBranchScope();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [purpose, setPurpose] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("all");
  const [badgeReturned, setBadgeReturned] = useState<string>("all");
  const [preReg, setPreReg] = useState<string>("all");
  const [tab, setTab] = useState("overview");
  const canOpenReports = me.canViewReports || me.canViewPhotoReports || me.canViewAuditLog;
  const allowedTabs = useMemo(() => {
    const tabs: string[] = [];
    if (me.canViewReports) tabs.push("overview", "trends", "people", "now", "operations", "approvals", "vehicles", "exceptions", "timeline", "blacklist");
    if (me.canViewPhotoReports) tabs.push("photos", "ids");
    if (me.canViewAuditLog) tabs.push("audit");
    return tabs;
  }, [me.canViewReports, me.canViewPhotoReports, me.canViewAuditLog]);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(tab)) setTab(allowedTabs[0]);
  }, [allowedTabs, tab]);
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0] ?? tab;

  const resetFilters = () => {
    setFrom(daysAgo(30));
    setTo(todayISO());
    setType("all");
    setStatus("all");
    setPurpose("");
    setBranchId("all");
    setBadgeReturned("all");
    setPreReg("all");
  };

  const visits = useQuery({
    enabled: me.canViewReports || me.canViewPhotoReports,
    queryKey: ["reports", from, to, type, status, purpose, branchId, badgeReturned, preReg, branchFilter],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select(
          "id, visit_type, visit_mode, status, approval, pre_registered, kiosk_self_registered, check_in_at, check_out_at, created_at, badge_number, host_name, vehicle_plate, expected_duration_minutes, purpose, branch_id, assets_verified, badge_returned, rejection_reason, face_photo_url, id_photo_url, id_photo_type, photos_captured_at, visitor:visitors(full_name, phone, company), host:profiles(full_name, department), branch:branches(name)",
        )
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(2000);
      // Branch filter: explicit override OR scope-based
      if (branchId !== "all") {
        q = q.eq("branch_id", branchId);
      } else if (branchFilter.kind === "eq") {
        q = q.eq("branch_id", branchFilter.branchId);
      } else if (branchFilter.kind === "in" && branchFilter.branchIds.length > 0) {
        q = q.in("branch_id", branchFilter.branchIds);
      } else if (branchFilter.kind === "in") {
        return [] as VisitRow[];
      }
      if (type !== "all") q = q.eq("visit_type", type as "guest" | "supplier" | "contractor");
      if (status === "rejected") q = q.eq("approval", "not_approved");
      else if (status !== "all") q = q.eq("status", status as "pending" | "checked_in" | "checked_out" | "overstayed");
      if (purpose.trim()) q = q.ilike("purpose", `%${purpose.trim()}%`);
      if (badgeReturned === "returned") q = q.eq("badge_returned", true).not("badge_number", "is", null);
      else if (badgeReturned === "outstanding") q = q.eq("badge_returned", false).not("badge_number", "is", null);
      else if (badgeReturned === "with_badge") q = q.not("badge_number", "is", null);
      else if (badgeReturned === "no_badge") q = q.is("badge_number", null);
      if (preReg === "yes") q = q.eq("pre_registered", true);
      else if (preReg === "no") q = q.eq("pre_registered", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as VisitRow[];
    },
  });

  const rows = visits.data ?? [];


  const agg = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byMode: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byHost: Record<string, { name: string; dept: string | null; count: number }> = {};
    const byDept: Record<string, number> = {};
    const byVisitor: Record<string, { name: string; phone: string; count: number }> = {};
    const byBranch: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byWeek: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byDow: number[] = Array.from({ length: 7 }, () => 0);
    const byHour: number[] = Array.from({ length: 24 }, () => 0);
    const byVehicleDay: Record<string, number> = {};
    const byVehicleCompany: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    const byRejectionReason: Record<string, number> = {};
    const visitorVisits: Record<string, number> = {};
    let walkIn = 0;
    let preReg = 0;
    let kioskSelf = 0;
    let checkedOut = 0;
    let totalDurationMin = 0;
    let badgeIssued = 0;
    let badgeReturned = 0;
    let assetsVerifiedCount = 0;
    let vehicleCount = 0;
    let noShow = 0;
    let approvalRequired = 0;
    let approvalApproved = 0;
    let approvalRejected = 0;
    let approvalPending = 0;
    let totalApprovalWaitMin = 0;
    let approvalWaitSamples = 0;
    const now = Date.now();
    rows.forEach((v) => {
      byType[v.visit_type] = (byType[v.visit_type] ?? 0) + 1;
      byMode[v.visit_mode] = (byMode[v.visit_mode] ?? 0) + 1;
      const displayStatus = v.approval === "not_approved" ? "rejected" : v.status;
      byStatus[displayStatus] = (byStatus[displayStatus] ?? 0) + 1;
      const c = v.visitor?.company ?? "Unknown";
      byCompany[c] = (byCompany[c] ?? 0) + 1;
      const hostName = v.host?.full_name ?? v.host_name;
      if (hostName) {
        const k = hostName;
        byHost[k] = byHost[k]
          ? { ...byHost[k], count: byHost[k].count + 1 }
          : { name: k, dept: v.host?.department ?? null, count: 1 };
      }
      const dept = v.host?.department ?? (v.host_name ? "Manual host" : "Unassigned");
      byDept[dept] = (byDept[dept] ?? 0) + 1;
      if (v.visitor?.phone) {
        const k = v.visitor.phone;
        byVisitor[k] = byVisitor[k]
          ? { ...byVisitor[k], count: byVisitor[k].count + 1 }
          : { name: v.visitor.full_name, phone: k, count: 1 };
        visitorVisits[k] = (visitorVisits[k] ?? 0) + 1;
      }
      const bname = v.branch?.name ?? "Unassigned";
      byBranch[bname] = (byBranch[bname] ?? 0) + 1;
      const d = new Date(v.created_at);
      const day = d.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const wk = weekStart.toISOString().slice(0, 10);
      byWeek[wk] = (byWeek[wk] ?? 0) + 1;
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[mo] = (byMonth[mo] ?? 0) + 1;
      byDow[d.getDay()] += 1;
      const hourSource = v.check_in_at ?? v.created_at;
      if (hourSource) byHour[new Date(hourSource).getHours()] += 1;
      if (v.vehicle_plate) {
        byVehicleDay[day] = (byVehicleDay[day] ?? 0) + 1;
        byVehicleCompany[c] = (byVehicleCompany[c] ?? 0) + 1;
        vehicleCount += 1;
      }
      if (v.purpose) byPurpose[v.purpose] = (byPurpose[v.purpose] ?? 0) + 1;
      if (v.pre_registered) preReg += 1; else walkIn += 1;
      if (v.kiosk_self_registered) kioskSelf += 1;
      if (v.badge_number) badgeIssued += 1;
      if (v.check_in_at && v.check_out_at) {
        checkedOut += 1;
        totalDurationMin += (new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000;
      }
      if (v.assets_verified) assetsVerifiedCount += 1;
      if (v.pre_registered && !v.check_in_at && new Date(v.created_at).getTime() + v.expected_duration_minutes * 60_000 < now) {
        noShow += 1;
      }
      if (v.approval === "pending") { approvalRequired += 1; approvalPending += 1; }
      else if (v.approval === "approved") { approvalRequired += 1; approvalApproved += 1; }
      else if (v.approval === "not_approved") {
        approvalRequired += 1; approvalRejected += 1;
        const rr = v.rejection_reason?.trim() || "Unspecified";
        byRejectionReason[rr] = (byRejectionReason[rr] ?? 0) + 1;
      }
      if (v.approval === "approved" && v.check_in_at) {
        totalApprovalWaitMin += (new Date(v.check_in_at).getTime() - new Date(v.created_at).getTime()) / 60000;
        approvalWaitSamples += 1;
      }
      if (v.badge_number && v.badge_returned) badgeReturned += 1;
    });

    const uniqueVisitors = Object.keys(visitorVisits).length;
    const returningVisitors = Object.values(visitorVisits).filter((n) => n > 1).length;
    return {
      byType, byStatus, byMode,
      byCompany: Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15),
      byHost: Object.values(byHost).sort((a, b) => b.count - a.count).slice(0, 15),
      byDept: Object.entries(byDept).sort((a, b) => b[1] - a[1]),
      frequent: Object.values(byVisitor).sort((a, b) => b.count - a.count).slice(0, 15),
      byBranch: Object.entries(byBranch).sort((a, b) => b[1] - a[1]),
      byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)),
      byWeek: Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b)),
      byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)),
      byDow, byHour,
      byVehicleDay: Object.entries(byVehicleDay).sort(([a], [b]) => a.localeCompare(b)),
      byVehicleCompany: Object.entries(byVehicleCompany).sort((a, b) => b[1] - a[1]).slice(0, 15),
      byPurpose: Object.entries(byPurpose).sort((a, b) => b[1] - a[1]).slice(0, 15),
      byRejectionReason: Object.entries(byRejectionReason).sort((a, b) => b[1] - a[1]),
      walkIn, preReg, kioskSelf, checkedOut, totalDurationMin,
      badgeIssued, badgeReturned, assetsVerifiedCount, vehicleCount, noShow,
      approvalRequired, approvalApproved, approvalRejected, approvalPending,
      avgApprovalWaitMin: approvalWaitSamples > 0 ? totalApprovalWaitMin / approvalWaitSamples : 0,
      avgDurationMin: checkedOut > 0 ? totalDurationMin / checkedOut : 0,
      uniqueVisitors, returningVisitors,
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

  const timeline = useQuery({
    enabled: me.canViewReports,
    queryKey: ["reports", "timeline", branchFilter],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();
      let q = supabase
        .from("visits")
        .select(
          "id, created_at, check_in_at, check_out_at, approval, status, pre_registered, rejection_reason, visitor:visitors(full_name, company), host:profiles(full_name)",
        )
        .gte("updated_at", sinceISO)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (branchFilter.kind === "eq") q = q.eq("branch_id", branchFilter.branchId);
      else if (branchFilter.kind === "in" && branchFilter.branchIds.length > 0) q = q.in("branch_id", branchFilter.branchIds);
      const [{ data: visits }, { data: blacklist }] = await Promise.all([
        q,
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

  if (!canOpenReports) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view reports.
        </p>
      </div>
    );
  }


  const fullExportRows = toVisitExportRows(rows);
  const baseName = `visits_${from}_to_${to}`;

  const blacklistExportRows: ExportRow[] = (blacklistedVisitors.data ?? []).map((b) => {
    const v = (b as { visitor?: { full_name: string; phone: string; company: string | null } | null }).visitor;
    return {
      Visitor: v?.full_name ?? "",
      Phone: v?.phone ?? "",
      Company: v?.company ?? "",
      Reason: (b as { reason: string }).reason,
      Since: fmtDate((b as { created_at: string }).created_at),
    };
  });

  const peakMax = Math.max(1, ...agg.byHour);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {visits.isLoading ? "Loading…" : `${rows.length} visits in selected range`} · scoped to active branch.
          </p>
        </div>
        {me.canViewReports && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => csvExport(`${baseName}.csv`, fullExportRows)} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> All visits CSV
            </Button>
            <Button variant="outline" onClick={() => exportExcel(baseName, fullExportRows, "Visits")} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> All visits Excel
            </Button>
            <Button onClick={() => exportPdf(baseName, `Visits report ${from} to ${to}`, fullExportRows)} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> All visits PDF
            </Button>
          </div>
        )}
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Quick range</Label>
            <Select
              value="custom"
              onValueChange={(v) => {
                if (v === "today") { setFrom(todayISO()); setTo(todayISO()); }
                else if (v === "7") { setFrom(daysAgo(7)); setTo(todayISO()); }
                else if (v === "30") { setFrom(daysAgo(30)); setTo(todayISO()); }
                else if (v === "90") { setFrom(daysAgo(90)); setTo(todayISO()); }
                else if (v === "365") { setFrom(daysAgo(365)); setTo(todayISO()); }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Custom" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All allowed branches</SelectItem>
                {branchScope.availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
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
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="checked_in">Checked-in</SelectItem>
                <SelectItem value="checked_out">Checked-out</SelectItem>
                <SelectItem value="overstayed">Overstayed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Purpose contains</Label>
            <Input placeholder="e.g. meeting" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Badge / returned</Label>
            <Select value={badgeReturned} onValueChange={setBadgeReturned}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="with_badge">With badge</SelectItem>
                <SelectItem value="no_badge">No badge</SelectItem>
                <SelectItem value="returned">Badge returned</SelectItem>
                <SelectItem value="outstanding">Badge outstanding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Registration</Label>
            <Select value={preReg} onValueChange={setPreReg}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Pre-registered</SelectItem>
                <SelectItem value="no">Walk-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {(me.canViewReports || me.canViewPhotoReports) && visits.isError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load report data: {visits.error instanceof Error ? visits.error.message : "Unknown error"}
          </CardContent>
        </Card>
      )}
      {(me.canViewReports || me.canViewPhotoReports) && !visits.isLoading && rows.length === 0 && !visits.isError && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No visits match the current filters. Try widening the date range or clearing filters.
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {me.canViewReports && <TabsTrigger value="overview">Overview</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="trends">Trends</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="people">People</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="now">Currently inside</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="operations">Operations</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="exceptions">Exceptions</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
          {me.canViewReports && <TabsTrigger value="blacklist">Blacklist</TabsTrigger>}
          {me.canViewPhotoReports && <TabsTrigger value="photos">Visitor photos</TabsTrigger>}
          {me.canViewPhotoReports && <TabsTrigger value="ids">Visitor IDs</TabsTrigger>}
          {me.canViewAuditLog && <TabsTrigger value="audit">Audit log</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <Kpi label="Total visits" value={rows.length} />
            <Kpi label="Unique visitors" value={agg.uniqueVisitors} />
            <Kpi label="Returning visitors" value={agg.returningVisitors} hint={agg.uniqueVisitors ? `${Math.round((agg.returningVisitors / agg.uniqueVisitors) * 100)}% of unique` : undefined} />
            <Kpi label="Walk-in vs Pre-reg" value={`${agg.walkIn} / ${agg.preReg}`} />
            <Kpi label="Kiosk self-registered" value={agg.kioskSelf} />
            <Kpi label="Avg visit duration" value={fmtMinutes(agg.avgDurationMin)} hint={`${agg.checkedOut} completed`} />
            <Kpi label="Avg approval wait" value={fmtMinutes(agg.avgApprovalWaitMin)} hint={`${agg.approvalApproved} approved`} />
            <Kpi label="No-shows (pre-reg)" value={agg.noShow} />
            <Kpi label="Badges issued" value={agg.badgeIssued} hint={`${agg.badgeReturned} returned`} />
            <Kpi label="Assets verified" value={agg.assetsVerifiedCount} />
            <Kpi label="Vehicle entries" value={agg.vehicleCount} />
            <Kpi label="Currently inside" value={inside.length} hint={`${overstayed.length} overstayed`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="By visitor type" rows={Object.entries(agg.byType).map(([k, v]) => [k, v])} />
            <ListCard title="By status" rows={Object.entries(agg.byStatus).map(([k, v]) => [k.replace("_", " "), v])} />
            <ListCard title="By visit mode" rows={Object.entries(agg.byMode).map(([k, v]) => [k.replace("_", " "), v])} />
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
          <ListCard
            title="Visitors by day-of-week"
            rows={["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => [d, agg.byDow[i]])}
          />
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
          <VisitTable title={`Currently inside (${inside.length})`} rows={inside} filename="currently_inside" />
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Visit purposes" rows={agg.byPurpose} />
            <ListCard
              title="Badge utilization"
              rows={[
                ["Issued", agg.badgeIssued],
                ["Returned", agg.badgeReturned],
                ["Outstanding", Math.max(0, agg.badgeIssued - agg.badgeReturned)],
              ]}
            />
            <ListCard
              title="Asset verification"
              rows={[
                ["Verified", agg.assetsVerifiedCount],
                ["Not verified", Math.max(0, rows.length - agg.assetsVerifiedCount)],
              ]}
            />
            <ListCard
              title="Registration channel"
              rows={[
                ["Walk-in", agg.walkIn],
                ["Pre-registered", agg.preReg],
                ["Kiosk self-registered", agg.kioskSelf],
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Kpi label="Approval required" value={agg.approvalRequired} />
            <Kpi label="Approved" value={agg.approvalApproved} />
            <Kpi label="Rejected" value={agg.approvalRejected} />
            <Kpi label="Pending" value={agg.approvalPending} />
          </div>
          <ListCard title="Rejection reasons" rows={agg.byRejectionReason} />
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Vehicle entries by date" rows={agg.byVehicleDay} />
            <ListCard title="Vehicle entries by company" rows={agg.byVehicleCompany} />
          </div>
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 pt-4">
          <VisitTable title={`Overstayed visitors (${overstayed.length})`} rows={overstayed} filename="overstayed" />
          <VisitTable title={`Unapproved entries (${unapproved.length})`} rows={unapproved} filename="unapproved" />
          <VisitTable title={`Missed visitor appointments (${missed.length})`} rows={missed} filename="missed_appointments" />
        </TabsContent>


        <TabsContent value="blacklist" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Blacklisted visitors ({blacklistedVisitors.data?.length ?? 0})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={blacklistExportRows.length === 0} onClick={() => exportCsv("blacklist", blacklistExportRows)}>
                  <Download className="mr-1 h-3.5 w-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" disabled={blacklistExportRows.length === 0} onClick={() => exportExcel("blacklist", blacklistExportRows, "Blacklist")}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Excel
                </Button>
                <Button size="sm" variant="outline" disabled={blacklistExportRows.length === 0} onClick={() => exportPdf("blacklist", "Blacklisted visitors", blacklistExportRows)}>
                  <Download className="mr-1 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
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

        <TabsContent value="timeline" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Visitor status timeline (last 7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (timeline.data?.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No recent activity.</div>
              ) : (
                <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
                  {timeline.data?.map((e) => {
                    const meta = TIMELINE_META[e.kind];
                    const Icon = meta.icon;
                    const inner = (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {e.visitor}
                            {e.company ? <span className="text-muted-foreground"> · {e.company}</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className={`font-medium ${meta.text}`}>{meta.label}</span> · {e.detail}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {new Date(e.at).toLocaleString()}
                        </div>
                      </div>
                    );
                    return (
                      <li key={e.id} className="relative">
                        <span className={`absolute -left-[34px] grid h-6 w-6 place-items-center rounded-full ${meta.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
                        </span>
                        {e.visitId ? (
                          <Link to="/app/visits/$id" params={{ id: e.visitId }} className="block -mx-2 rounded px-2 py-1 hover:bg-muted/40">
                            {inner}
                          </Link>
                        ) : (
                          <div className="px-2 py-1">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {me.canViewPhotoReports && (
          <TabsContent value="photos" className="space-y-4 pt-4">
            <PhotoReport
              rows={rows.filter((r) => !!r.face_photo_url)}
              variant="face"
              filename={`visitor_photos_${from}_to_${to}`}
            />
          </TabsContent>
        )}
        {me.canViewPhotoReports && (
          <TabsContent value="ids" className="space-y-4 pt-4">
            <PhotoReport
              rows={rows.filter((r) => !!r.id_photo_url)}
              variant="id"
              filename={`visitor_ids_${from}_to_${to}`}
            />
          </TabsContent>
        )}
        {me.canViewAuditLog && (
          <TabsContent value="audit" className="space-y-4 pt-4">
            <AuditLogTab from={from} to={to} branchId={branchId} branchFilter={branchFilter} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const TIMELINE_META: Record<
  "created" | "approved" | "rejected" | "checked_in" | "checked_out" | "blacklisted" | "unblacklisted",
  { label: string; icon: React.ElementType; bg: string; text: string }
> = {
  created: { label: "Registered", icon: UserPlus, bg: "bg-secondary", text: "text-secondary-foreground" },
  approved: { label: "Approved", icon: CheckCircle2, bg: "bg-success/15", text: "text-success" },
  rejected: { label: "Rejected", icon: XCircle, bg: "bg-destructive/15", text: "text-destructive" },
  checked_in: { label: "Checked in", icon: LogIn, bg: "bg-info/15", text: "text-info" },
  checked_out: { label: "Checked out", icon: LogOut, bg: "bg-muted", text: "text-muted-foreground" },
  blacklisted: { label: "Blacklisted", icon: ShieldAlert, bg: "bg-destructive/15", text: "text-destructive" },
  unblacklisted: { label: "Removed from blacklist", icon: Clock, bg: "bg-warning/15", text: "text-warning-foreground" },
};

function fmtMinutes(m: number): string {
  if (!isFinite(m) || m <= 0) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const r = Math.round(m - h * 60);
  return r ? `${h}h ${r}m` : `${h}h`;
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
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
  filename,
}: {
  title: string;
  rows: VisitRow[];
  filename: string;
}) {
  const exportData = toVisitExportRows(rows);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => csvExport(`${filename}.csv`, exportData)} disabled={rows.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportExcel(filename, exportData, title.replace(/\(.*\)/, "").trim().slice(0, 30) || "Report")} disabled={rows.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportPdf(filename, title, exportData)} disabled={rows.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
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
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.visitor?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.visitor?.company ?? "—"}</td>
                    <td className="px-4 py-2">{r.host?.full_name ?? r.host_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.branch?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.check_in_at ?? r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 capitalize">{r.approval === "not_approved" ? "Rejected" : r.status.replace("_", " ")}</td>
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

function useSignedUrls(paths: (string | null | undefined)[]) {
  return useQuery({
    queryKey: ["signed-visitor-photos", paths.filter(Boolean).sort().join("|")],
    enabled: paths.some(Boolean),
    queryFn: async () => {
      const clean = paths.filter((p): p is string => !!p);
      if (clean.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase.storage
        .from("visitor-photos")
        .createSignedUrls(clean, 60 * 15);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((d) => {
        if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      });
      return map;
    },
  });
}

function PhotoReport({
  rows,
  variant,
  filename,
}: {
  rows: VisitRow[];
  variant: "face" | "id";
  filename: string;
}) {
  const paths = rows.map((r) => (variant === "face" ? r.face_photo_url : r.id_photo_url));
  const signed = useSignedUrls(paths);
  const [pdfBusy, setPdfBusy] = useState(false);

  const exportData: ExportRow[] = rows.map((r) => ({
    "Visitor": r.visitor?.full_name ?? "",
    "Phone": r.visitor?.phone ?? "",
    "Company": r.visitor?.company ?? "",
    ...(variant === "id" ? { "ID type": r.id_photo_type ?? "" } : {}),
    "Purpose": r.purpose,
    "Branch": r.branch?.name ?? "",
    "Captured": fmtDate(r.photos_captured_at ?? r.created_at),
    "Photo URL": (() => {
      const path = variant === "face" ? r.face_photo_url : r.id_photo_url;
      return path ? signed.data?.[path] ?? path : "";
    })(),
  }));

  const downloadPdfWithImages = async () => {
    setPdfBusy(true);
    try {
      const items = rows.map((r) => {
        const path = variant === "face" ? r.face_photo_url : r.id_photo_url;
        return {
          imageUrl: path ? signed.data?.[path] : undefined,
          fields: [
            ["Visitor", r.visitor?.full_name ?? "—"],
            ["Phone", r.visitor?.phone ?? "—"],
            ["Company", r.visitor?.company ?? "—"],
            ...(variant === "id" ? [["ID type", (r.id_photo_type ?? "—").replace("_", " ")] as [string, string]] : []),
            ["Purpose", r.purpose],
            ["Branch", r.branch?.name ?? "—"],
            ["Captured", fmtDate(r.photos_captured_at ?? r.created_at)],
          ] as [string, string][],
        };
      });
      await exportPhotoPdf(filename, variant === "face" ? "Visitor photos report" : "Visitor ID report", items);
    } finally {
      setPdfBusy(false);
    }
  };

  const Icon = variant === "face" ? Camera : IdCard;
  const title = variant === "face" ? "Visitor photo report" : "Visitor ID report";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" /> {title} ({rows.length})
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => exportCsv(filename, exportData)}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => exportExcel(filename, exportData, variant === "face" ? "Photos" : "IDs")}>
            <Download className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0 || pdfBusy || signed.isLoading} onClick={downloadPdfWithImages}>
            <Download className="mr-1 h-3.5 w-3.5" /> {pdfBusy ? "Building PDF…" : "PDF (with photos)"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No {variant === "face" ? "visitor photos" : "ID photos"} captured in this range.
          </p>
        ) : signed.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            The photo report data loaded, but photo previews could not be opened. Please try again.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((r) => {
              const path = variant === "face" ? r.face_photo_url : r.id_photo_url;
              const url = path ? signed.data?.[path] : undefined;
              return (
                <Link
                  key={r.id}
                  to="/app/visits/$id"
                  params={{ id: r.id }}
                  className="group overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
                >
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    {url ? (
                      <img src={url} alt={r.visitor?.full_name ?? "Visitor"} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted-foreground">
                        {signed.isLoading ? "Loading…" : "No preview"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-3 text-sm">
                    <div className="font-medium truncate">{r.visitor?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.visitor?.phone ?? ""}
                      {r.visitor?.company ? ` · ${r.visitor.company}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.branch?.name ?? "—"} · {new Date(r.photos_captured_at ?? r.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {variant === "id" ? (r.id_photo_type ?? "ID").replace("_", " ") : r.purpose}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type BranchFilter =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "eq"; branchId: string }
  | { kind: "in"; branchIds: string[] };

function AuditLogTab({
  from,
  to,
  branchId,
  branchFilter,
}: {
  from: string;
  to: string;
  branchId: string;
  branchFilter: BranchFilter;
}) {
  const [action, setAction] = useState<string>("all");
  const q = useQuery({
    queryKey: ["audit-log", from, to, action, branchId, branchFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("id, created_at, actor_name, actor_department, action, entity_type, entity_id, branch_id, details, branch:branches(name)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (branchId !== "all") query = query.eq("branch_id", branchId);
      else if (branchFilter.kind === "eq") query = query.eq("branch_id", branchFilter.branchId);
      else if (branchFilter.kind === "in" && branchFilter.branchIds.length > 0)
        query = query.in("branch_id", branchFilter.branchIds);
      else if (branchFilter.kind === "in") return [];
      if (action !== "all") query = query.eq("action", action);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];
  const actions = Array.from(new Set(rows.map((r) => r.action))).sort();
  const exportRows: ExportRow[] = rows.map((r) => ({
    When: fmtDate(r.created_at),
    User: r.actor_name ?? "",
    Department: r.actor_department ?? "",
    Action: formatActionLabel(r.action),
    Entity: `${r.entity_type ?? ""} ${r.entity_id ?? ""}`.trim(),
    Branch: (r as { branch?: { name?: string } | null }).branch?.name ?? "",
    Details: formatDetails(r.details) || "—",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" /> Audit log ({rows.length})
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="w-48">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{formatActionLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => exportCsv("audit_log", exportRows)}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => exportExcel("audit_log", exportRows, "Audit")}>
            <Download className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => exportPdf("audit_log", "System audit log", exportRows)}>
            <Download className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          <p className="p-6 text-center text-sm text-destructive">
            Failed to load the audit log: {q.error instanceof Error ? q.error.message : "Unknown error"}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No activity yet in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Dept</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Branch</th>
                  <th className="px-4 py-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{r.actor_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.actor_department ?? "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatActionLabel(r.action)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{(r as { branch?: { name?: string } | null }).branch?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-md">
                      {formatDetails(r.details) || "—"}
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

