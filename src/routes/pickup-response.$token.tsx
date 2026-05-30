import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, ShieldCheck } from "lucide-react";
import { getPickupByToken, submitPickupResponse } from "@/lib/pickup-public.functions";

export const Route = createFileRoute("/pickup-response/$token")({
  head: () => ({ meta: [{ title: "Pickup Approval" }] }),
  component: PickupResponsePage,
});

function PickupResponsePage() {
  const { token } = useParams({ from: "/pickup-response/$token" });
  const getFn = useServerFn(getPickupByToken);
  const submitFn = useServerFn(submitPickupResponse);
  const [state, setState] = useState<"loading" | "ok" | "used" | "expired" | "not_found" | "done">("loading");
  const [info, setInfo] = useState<{ student_name: string; pickup_person_name: string; pickup_person_phone: string | null; vehicle_plate: string | null; requested_at: string } | null>(null);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getFn({ data: { token } });
        if (!res.ok) { setState(res.reason); return; }
        setInfo({
          student_name: res.request.student_name,
          pickup_person_name: res.request.pickup_person_name,
          pickup_person_phone: res.request.pickup_person_phone,
          vehicle_plate: res.request.vehicle_plate,
          requested_at: res.request.requested_at,
        });
        setState("ok");
      } catch {
        setState("not_found");
      }
    })();
  }, [token, getFn]);

  const submit = async (response: "approved" | "rejected") => {
    setSubmitting(true);
    try {
      await submitFn({ data: { token, response, reason: response === "rejected" ? reason : null } });
      setOutcome(response);
      setState("done");
      toast.success(response === "approved" ? "Pickup approved" : "Pickup rejected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Pickup approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
          {state === "not_found" && <p className="text-sm text-destructive">Invalid link.</p>}
          {state === "expired" && <p className="text-sm text-destructive">This link has expired (links are valid for 30 minutes).</p>}
          {state === "used" && <p className="text-sm text-muted-foreground">This link has already been used.</p>}
          {state === "done" && (
            <p className={`text-sm ${outcome === "approved" ? "text-green-700" : "text-destructive"}`}>
              You have <strong>{outcome === "approved" ? "approved" : "rejected"}</strong> this pickup. You can close this page.
            </p>
          )}
          {state === "ok" && info && (
            <>
              <div className="space-y-1 text-sm">
                <div><strong>{info.pickup_person_name}</strong> is at the gate to pick up <strong>{info.student_name}</strong>.</div>
                {info.pickup_person_phone && <div>Phone: {info.pickup_person_phone}</div>}
                {info.vehicle_plate && <div>Vehicle: {info.vehicle_plate}</div>}
                <div className="text-xs text-muted-foreground">Requested {new Date(info.requested_at).toLocaleString()}</div>
              </div>
              {showReject ? (
                <div className="space-y-2">
                  <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={submitting} onClick={() => submit("rejected")}><X className="h-4 w-4 mr-1" /> Confirm reject</Button>
                    <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button disabled={submitting} onClick={() => submit("approved")}><Check className="h-4 w-4 mr-1" /> Approve pickup</Button>
                  <Button variant="outline" disabled={submitting} onClick={() => setShowReject(true)}><X className="h-4 w-4 mr-1" /> Reject</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
