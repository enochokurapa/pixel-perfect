import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Link } from "@tanstack/react-router";

export type TileKey =
  | "inside"
  | "today"
  | "overstay"
  | "badgesIssued"
  | "badgesUnissued"
  | "withAssets";

const TITLES: Record<TileKey, string> = {
  inside: "Visitors currently inside",
  today: "Today's visits",
  overstay: "Overstayed visitors",
  badgesIssued: "Badges currently issued",
  badgesUnissued: "Unissued (available) badges",
  withAssets: "Visits with assets",
};

function fmtDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function TileDetailModal({
  tile,
  onClose,
  branchId,
}: {
  tile: TileKey | null;
  onClose: () => void;
  branchId?: string | null;
}) {
  const open = tile !== null;

  const q = useQuery({
    queryKey: ["tile-detail", tile, branchId ?? "all"],
    enabled: open,
    queryFn: async () => {

      if (!tile) return [];
      const now = Date.now();
      if (tile === "badgesIssued" || tile === "badgesUnissued") {
        const status = tile === "badgesIssued" ? "issued" : "available";
        const { data, error } = await supabase
          .from("badges")
          .select("badge_number, status, notes, created_at")
          .eq("status", status)
          .order("badge_number");
        if (error) throw error;
        return (data ?? []).map((b) => ({
          kind: "badge" as const,
          badge_number: b.badge_number,
          status: b.status,
          notes: b.notes ?? "",
        }));
      }

      let query = supabase
        .from("visits")
        .select(
          "id, status, purpose, check_in_at, created_at, badge_number, expected_duration_minutes, visit_type, visitor:visitors(full_name, company, phone), host:profiles(full_name)",
        )
        .order("created_at", { ascending: false });

      if (tile === "inside" || tile === "overstay") {
        query = query.eq("status", "checked_in");
      } else if (tile === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        query = query.gte("created_at", start.toISOString());
      } else if (tile === "withAssets") {
        const { data: assetRows } = await supabase
          .from("visit_assets")
          .select("visit_id");
        const ids = Array.from(new Set((assetRows ?? []).map((a) => a.visit_id)));
        if (ids.length === 0) return [];
        query = query.in("id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      let rows = data ?? [];
      if (tile === "overstay") {
        rows = rows.filter((v) => {
          if (!v.check_in_at) return false;
          const due =
            new Date(v.check_in_at).getTime() +
            (v.expected_duration_minutes ?? 180) * 60000;
          return due < now;
        });
      }
      return rows.map((v) => {
        const checkIn = v.check_in_at ? new Date(v.check_in_at).getTime() : null;
        const elapsed = checkIn ? now - checkIn : null;
        const due = checkIn
          ? checkIn + (v.expected_duration_minutes ?? 180) * 60000
          : null;
        const over = due ? now - due : null;
        return {
          kind: "visit" as const,
          id: v.id,
          name: v.visitor?.full_name ?? "Unknown",
          company: v.visitor?.company ?? "",
          phone: v.visitor?.phone ?? "",
          host: v.host?.full_name ?? "—",
          purpose: v.purpose,
          type: v.visit_type,
          status: v.status,
          badge: v.badge_number ?? "",
          checkInAt: v.check_in_at,
          insideFor: elapsed != null ? fmtDuration(elapsed) : "—",
          overstayBy: over != null && over > 0 ? fmtDuration(over) : "—",
          expectedMins: v.expected_duration_minutes ?? 180,
        };
      });
    },
  });

  const rows = q.data ?? [];
  const isBadge = tile === "badgesIssued" || tile === "badgesUnissued";
  const isVisitor = !isBadge;
  const showOverstay = tile === "overstay";

  const downloadExcel = () => {
    const data = rows.map((r: any) => {
      if (r.kind === "badge") {
        return {
          "Badge #": r.badge_number,
          Status: r.status,
          Notes: r.notes,
        };
      }
      const base: any = {
        Name: r.name,
        Company: r.company,
        Phone: r.phone,
        Host: r.host,
        Purpose: r.purpose,
        Type: r.type,
        Status: r.status,
        "Badge #": r.badge,
        "Check-in": r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "—",
        "Inside for": r.insideFor,
      };
      if (showOverstay) base["Overstayed by"] = r.overstayBy;
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${tile}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(tile ? TITLES[tile] : "Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    let head: string[][];
    let body: string[][];
    if (isBadge) {
      head = [["Badge #", "Status", "Notes"]];
      body = rows.map((r: any) => [r.badge_number, r.status, r.notes]);
    } else {
      head = [
        [
          "Name",
          "Company",
          "Host",
          "Purpose",
          "Type",
          "Status",
          "Badge",
          "Check-in",
          "Inside for",
          ...(showOverstay ? ["Overstayed by"] : []),
        ],
      ];
      body = rows.map((r: any) => [
        r.name,
        r.company,
        r.host,
        r.purpose,
        r.type,
        r.status,
        r.badge,
        r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "—",
        r.insideFor,
        ...(showOverstay ? [r.overstayBy] : []),
      ]);
    }
    autoTable(doc, { head, body, startY: 28, styles: { fontSize: 8 } });
    doc.save(`${tile}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{tile ? TITLES[tile] : ""}</DialogTitle>
          <DialogDescription>
            {rows.length} {rows.length === 1 ? "record" : "records"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={downloadExcel} disabled={!rows.length}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPdf} disabled={!rows.length}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {q.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No records to show.
            </div>
          ) : isBadge ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Badge #</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r: any, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">#{r.badge_number}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Visitor</th>
                  <th className="px-3 py-2">Host / Purpose</th>
                  <th className="px-3 py-2">Check-in</th>
                  <th className="px-3 py-2">Inside for</th>
                  {showOverstay && <th className="px-3 py-2">Overstayed by</th>}
                  <th className="px-3 py-2">Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link
                        to="/app/visits/$id"
                        params={{ id: r.id }}
                        onClick={onClose}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      {r.company && (
                        <div className="text-xs text-muted-foreground">{r.company}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.host}</div>
                      <div className="text-xs text-muted-foreground">{r.purpose}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.insideFor}</td>
                    {showOverstay && (
                      <td className="px-3 py-2 tabular-nums text-warning-foreground">
                        {r.overstayBy}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {r.badge ? <Badge variant="outline">#{r.badge}</Badge> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
