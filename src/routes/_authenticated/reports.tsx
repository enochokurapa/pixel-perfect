import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Sentinel VMS" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const data = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data: visits } = await supabase.from("visits").select("visit_type, status, created_at, visitor:visitors(company)").limit(1000);
      return visits ?? [];
    },
  });

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCompany: Record<string, number> = {};
  data.data?.forEach((v) => {
    byType[v.visit_type] = (byType[v.visit_type] ?? 0) + 1;
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
    const c = v.visitor?.company ?? "Unknown";
    byCompany[c] = (byCompany[c] ?? 0) + 1;
  });
  const topCompanies = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Aggregate view across all visits.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By visitor type</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byType).map(([k, v]) => (
              <Row key={k} label={k} value={v} max={data.data?.length ?? 1} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byStatus).map(([k, v]) => (
              <Row key={k} label={k.replace("_", " ")} value={v} max={data.data?.length ?? 1} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top companies</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {topCompanies.map(([k, v]) => (
            <Row key={k} label={k} value={v} max={topCompanies[0]?.[1] ?? 1} />
          ))}
          {topCompanies.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="capitalize">{label}</span><span className="tabular-nums font-medium">{value}</span></div>
      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
