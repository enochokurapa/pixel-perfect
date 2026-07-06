import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, ExternalLink, FileSpreadsheet, FileText, LogOut } from "lucide-react";
import { exportCsv, exportDetailPdf, exportExcel, type ExportRow } from "@/lib/visit-export";
import { formatActionLabel, formatDetails } from "@/lib/audit-format";
import { logActivity } from "@/lib/activity-log";
import { useCurrentUser } from "@/hooks/use-session";

type Props = {
  visitId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function VisitorDetailDialog({ visitId, open, onOpenChange }: Props) {
  const me = useCurrentUser();
  const qc = useQueryClient();

  const visit = useQuery({
    enabled: open && !!visitId,
    queryKey: ["visitor-detail", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, visitor:visitors(*), host:profiles(full_name, email, department), branch:branches(name)")
        .eq("id", visitId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const audit = useQuery({
    enabled: open && !!visitId,
    queryKey: ["visitor-detail-audit", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("created_at, actor_name, actor_department, action, details")
        .eq("entity_type", "visit")
        .eq("entity_id", visitId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const v = visit.data;

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [badgeReturned, setBadgeReturned] = useState(false);
  const [assetsVerified, setAssetsVerified] = useState(false);
  const [notes, setNotes] = useState("");

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!v) return;
      if (v.badge_number && !badgeReturned) throw new Error("Please confirm the badge was returned.");
      if (!assetsVerified) throw new Error("Please confirm assets were verified.");
      const { error } = await supabase
        .from("visits")
        .update({
          status: "checked_out",
          check_out_at: new Date().toISOString(),
          badge_returned: badgeReturned,
          assets_verified: assetsVerified,
          checkout_notes: notes.trim() || null,
        })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
      // Belt-and-braces: the sync_badge_status_from_visit DB trigger already
      // returns the badge to "available" when badge_returned = true, but we
      // also do it here so the UI reflects it immediately even if the trigger
      // is temporarily disabled.
      if (v.badge_number && v.branch_id && badgeReturned) {
        await supabase
          .from("badges")
          .update({ status: "available" })
          .eq("badge_number", v.badge_number)
          .eq("branch_id", v.branch_id);
      }
      await logActivity({
        action: "visit.check_out",
        entityType: "visit",
        entityId: v.id,
        branchId: v.branch_id,
        details: {
          visitor: v.visitor?.full_name,
          badge_number: v.badge_number,
          badge_returned: badgeReturned,
          assets_verified: assetsVerified,
        },
      });
    },
    onSuccess: () => {
      toast.success("Visitor checked out");
      setCheckoutOpen(false);
      setBadgeReturned(false);
      setAssetsVerified(false);
      setNotes("");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to check out"),
  });

  const detailRows = (): [string, string][] =>
    !v
      ? []
      : [
          ["Visitor", v.visitor?.full_name ?? "—"],
          ["Phone", v.visitor?.phone ?? "—"],
          ["Email", v.visitor?.email ?? "—"],
          ["Company", v.visitor?.company ?? "—"],
          ["ID type", v.visitor?.id_type ?? "—"],
          ["ID number", v.visitor?.id_number ?? "—"],
          ["Host", v.host?.full_name ?? v.host_name ?? "—"],
          ["Department", v.host?.department ?? "—"],
          ["Branch", v.branch?.name ?? "—"],
          ["Purpose", v.purpose ?? "—"],
          ["Visit type", v.visit_type ?? "—"],
          ["Visit mode", v.visit_mode ?? "—"],
          ["Badge", v.badge_number ?? "—"],
          ["Vehicle plate", v.vehicle_plate ?? "—"],
          ["Vehicle type", v.vehicle_type ?? "—"],
          ["Status", v.approval === "not_approved" ? "Rejected" : v.status],
          ["Approval", v.approval ?? "—"],
          ["Check-in", v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "—"],
          ["Check-out", v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "—"],
        ];

  const auditExportRows = (): ExportRow[] =>
    (audit.data ?? []).map((a) => ({
      When: new Date(a.created_at).toLocaleString(),
      User: a.actor_name ?? "",
      Department: a.actor_department ?? "",
      Action: formatActionLabel(a.action),
      Details: formatDetails(a.details) || "—",
    }));

  const filenameBase = v ? `visit-${(v.visitor?.full_name ?? "detail").replace(/\s+/g, "_")}` : "visit";

  const downloadCsv = () => {
    const rows: ExportRow[] = detailRows().map(([Field, Value]) => ({ Field, Value }));
    const audits = auditExportRows();
    const combined: ExportRow[] = [
      ...rows,
      { Field: "", Value: "" },
      { Field: "Audit trail", Value: "" },
      ...audits.map((a) => ({
        Field: `${a.When} — ${a.User}${a.Department ? ` (${a.Department})` : ""}`,
        Value: `${a.Action}${a.Details && a.Details !== "—" ? ` — ${a.Details}` : ""}`,
      })),
    ];
    exportCsv(filenameBase, combined);
  };

  const downloadPdf = () => {
    const auditFields: [string, string][] = (audit.data ?? []).length
      ? (audit.data ?? []).map((a) => {
          const who = `${a.actor_name ?? "Unknown"}${a.actor_department ? ` (${a.actor_department})` : ""}`;
          const when = new Date(a.created_at).toLocaleString();
          const details = formatDetails(a.details);
          const value = `${formatActionLabel(a.action)} by ${who}${details ? `. ${details}` : ""}`;
          return [when, value];
        })
      : [["Audit trail", "No activity recorded yet"]];
    exportDetailPdf(filenameBase, `Visit report — ${v?.visitor?.full_name ?? ""}`, [
      { heading: "Visitor & visit", rows: detailRows() },
      { heading: "Audit trail", rows: auditFields },
    ]);
  };


  const downloadExcel = () => {
    const rows: ExportRow[] = detailRows().map(([Field, Value]) => ({ Field, Value }));
    exportExcel(filenameBase, rows, "Visit");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{v?.visitor?.full_name ?? "Visitor"}</DialogTitle>
          <DialogDescription>
            {v ? (
              <>
                {v.visit_type} · {v.visit_mode?.replace("_", " ")} · {v.branch?.name ?? "—"}
              </>
            ) : (
              "Loading…"
            )}
          </DialogDescription>
        </DialogHeader>

        {visit.isLoading || !v ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading visitor details…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadCsv}>
                <Download className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={downloadExcel}>
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPdf}>
                <FileText className="mr-1 h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/visits/$id" params={{ id: v.id }} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open full page
                </Link>
              </Button>
              {v.status === "checked_in" && me.canCheckout && !checkoutOpen && (
                <Button size="sm" onClick={() => setCheckoutOpen(true)}>
                  <LogOut className="mr-1 h-3.5 w-3.5" /> Check out
                </Button>
              )}
            </div>

            {checkoutOpen && (
              <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="text-sm font-medium">Check-out verification</div>
                {v.badge_number && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={badgeReturned} onCheckedChange={(c) => setBadgeReturned(c === true)} className="mt-0.5" />
                    <span>Badge #{v.badge_number} returned</span>
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={assetsVerified} onCheckedChange={(c) => setAssetsVerified(c === true)} className="mt-0.5" />
                  <span>Assets verified (or none brought in)</span>
                </label>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCheckoutOpen(false)} disabled={checkOut.isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => checkOut.mutate()} disabled={checkOut.isPending}>
                    {checkOut.isPending ? "Checking out…" : "Confirm check-out"}
                  </Button>
                </div>
              </div>
            )}

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="audit">Audit trail ({audit.data?.length ?? 0})</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="pt-3">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  {detailRows().map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                      <div className="mt-0.5 font-medium break-words">{value}</div>
                    </div>
                  ))}
                </div>
                {v.rejection_reason && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <strong>Rejection reason:</strong> {v.rejection_reason}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="audit" className="pt-3">
                {audit.isLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
                ) : (audit.data?.length ?? 0) === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No activity has been recorded for this visit yet.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {audit.data!.map((a, i) => (
                      <li key={i} className="rounded-md border bg-card p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="text-sm font-medium">{a.action}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {a.actor_name ?? "—"}
                          {a.actor_department ? ` · ${a.actor_department}` : ""}
                        </div>
                        {a.details && Object.keys(a.details).length > 0 && (
                          <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                            {JSON.stringify(a.details, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
