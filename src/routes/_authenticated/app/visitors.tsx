import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { StatusBadge } from "./index";
import { exportExcel, exportPdf } from "@/lib/visit-export";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/app/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Sentinel VMS" }] }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const me = useCurrentUser();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const scopedBranch = !me.canViewAllBranches ? me.branchId : null;

  const visits = useQuery({
    queryKey: ["visits", "all", scopedBranch ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("visits")
        .select(
          "id, status, purpose, check_in_at, check_out_at, created_at, visit_type, badge_number, vehicle_plate, branch_id, visitor:visitors(full_name, company, phone, email), host:profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (scopedBranch) query = query.eq("branch_id", scopedBranch);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });


  const filtered = useMemo(() => {
    return visits.data?.filter((v) => {
      if (q) {
        const s = q.toLowerCase();
        const match =
          v.visitor?.full_name.toLowerCase().includes(s) ||
          v.visitor?.company?.toLowerCase().includes(s) ||
          v.purpose.toLowerCase().includes(s) ||
          v.badge_number?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (status !== "all" && v.status !== status) return false;
      if (type !== "all" && v.visit_type !== type) return false;
      if (from && new Date(v.created_at) < new Date(from)) return false;
      if (to && new Date(v.created_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [visits.data, q, status, type, from, to]);

  const toRows = () =>
    (filtered ?? []).map((v) => ({
      Visitor: v.visitor?.full_name ?? "",
      Company: v.visitor?.company ?? "",
      Phone: v.visitor?.phone ?? "",
      Email: v.visitor?.email ?? "",
      Host: v.host?.full_name ?? "",
      Purpose: v.purpose,
      Type: v.visit_type,
      Badge: v.badge_number ?? "",
      Vehicle: v.vehicle_plate ?? "",
      "Check-in": v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "",
      "Check-out": v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "",
      Status: v.status,
    }));

  const resetFilters = () => {
    setQ("");
    setStatus("all");
    setType("all");
    setFrom("");
    setTo("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Visitors</h1>
          <p className="text-sm text-muted-foreground">All visits, most recent first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportExcel("visitors", toRows())}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPdf("visitors", "Visitors", toRows())}>
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button asChild size="lg">
            <Link to="/app/register">+ Register new visitor</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Name, company, badge…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checked_in">Checked in</SelectItem>
                <SelectItem value="checked_out">Checked out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{filtered?.length ?? 0} visits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Visitor</th>
                  <th className="px-5 py-3 text-left">Host</th>
                  <th className="px-5 py-3 text-left">Purpose</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Badge</th>
                  <th className="px-5 py-3 text-left">Check-in</th>
                  <th className="px-5 py-3 text-left">Check-out</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered?.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link
                        to="/app/visits/$id"
                        params={{ id: v.id }}
                        className="font-medium hover:underline"
                      >
                        {v.visitor?.full_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {v.visitor?.company ?? v.visitor?.phone}
                      </div>
                    </td>
                    <td className="px-5 py-3">{v.host?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 max-w-xs truncate">{v.purpose}</td>
                    <td className="px-5 py-3 capitalize">{v.visit_type}</td>
                    <td className="px-5 py-3">{v.badge_number ? `#${v.badge_number}` : "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/app/visits/$id" params={{ id: v.id }}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No visits found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
