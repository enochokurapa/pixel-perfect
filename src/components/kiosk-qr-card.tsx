import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer, Download, QrCode } from "lucide-react";

export function KioskQrCard() {
  const branches = useQuery({
    queryKey: ["branches", "kiosk-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [branchId, setBranchId] = useState<string>("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (branches.data && branches.data.length > 0 && !branchId) {
      setBranchId(branches.data[0].id);
    }
  }, [branches.data, branchId]);

  const kioskUrl =
    typeof window !== "undefined" && branchId
      ? `${window.location.origin}/kiosk/${branchId}`
      : "";

  useEffect(() => {
    if (!kioskUrl) return;
    QRCode.toDataURL(kioskUrl, { width: 512, margin: 2 }).then(setDataUrl);
  }, [kioskUrl]);

  const branch = branches.data?.find((b) => b.id === branchId);

  const print = () => {
    if (!dataUrl || !branch) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>Visitor self-registration — ${branch.name}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px}
      img{width:360px;height:360px} h1{margin:8px 0}h2{font-weight:500;color:#555;margin:0 0 24px}
      p{color:#666;max-width:380px;margin:24px auto;line-height:1.5}</style></head>
      <body><h1>${branch.name}</h1><h2>Visitor self-registration</h2>
      <img src="${dataUrl}"/>
      <p>Scan with your phone camera to register your visit. Your host will be notified.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 200);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" /> Visitor self-registration QR
        </CardTitle>
        <CardDescription>
          Print and display this QR at reception. Visitors scan it to self-register.
          The selected host is notified for approval, and front desk receives a sign-in alert.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-3">
          <div className="space-y-2 md:max-w-xs">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.data?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {kioskUrl && (
            <div className="text-xs text-muted-foreground break-all">
              URL: <span className="font-mono">{kioskUrl}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={print} disabled={!dataUrl} variant="outline" size="sm">
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            {dataUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={dataUrl} download={`kiosk-${branch?.name ?? "branch"}.png`}>
                  <Download className="mr-1 h-4 w-4" /> Download PNG
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="grid place-items-center rounded-md border border-dashed border-border bg-muted/30 p-4">
          {dataUrl ? (
            <img src={dataUrl} alt="Kiosk QR" className="h-44 w-44" />
          ) : (
            <div className="grid h-44 w-44 place-items-center text-xs text-muted-foreground">
              Select a branch
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
