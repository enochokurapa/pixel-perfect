import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { StatusBadge } from "./index";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Sentinel VMS" }] }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const visits = useQuery({
    queryKey: ["visits", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select(
          "id, status, purpose, check_in_at, check_out_at, created_at, visit_type, badge_number, vehicle_plate, visitor:visitors(full_name, company, phone), host:profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const checkOut = useMutation({
    mutationFn: async (visit: { id: string; badge_number: string | null }) => {
      const { error } = await supabase
        .from("visits")
        .update({
          status: "checked_out",
          check_out_at: new Date().toISOString(),
        })
        .eq("id", visit.id);
      if (error) throw error;
      if (visit.badge_number) {
        await supabase
          .from("badges")
          .update({ status: "available" })
          .eq("badge_number", visit.badge_number);
      }
    },
    onSuccess: () => {
      toast.success("Checked out");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = visits.data?.filter((v) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      v.visitor?.full_name.toLowerCase().includes(s) ||
      v.visitor?.company?.toLowerCase().includes(s) ||
      v.purpose.toLowerCase().includes(s) ||
      v.badge_number?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Visitors</h1>
          <p className="text-sm text-muted-foreground">All visits, most recent first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name, company, badge…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button asChild size="lg">
            <Link to="/app/register">+ Register new visitor</Link>
          </Button>
        </div>
      </header>

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
                      {v.status === "checked_in" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/app/visits/$id" params={{ id: v.id }}>
                            Check out
                          </Link>
                        </Button>
                      )}
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
