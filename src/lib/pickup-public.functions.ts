// Public (anon) server functions for the tokenised pickup response page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPickupByToken = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const { data: tok } = await supabaseAdmin
      .from("pickup_response_tokens")
      .select("id, token, used_at, expires_at, response, pickup_request_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) return { ok: false as const, reason: "not_found" as const };
    const expired = new Date(tok.expires_at).getTime() < Date.now();
    if (tok.used_at) return { ok: false as const, reason: "used" as const, response: tok.response };
    if (expired) return { ok: false as const, reason: "expired" as const };

    const { data: req } = await supabaseAdmin
      .from("pickup_requests")
      .select("id, status, pickup_person_name, pickup_person_phone, vehicle_plate, pickup_person_photo_url, requested_at, student_id")
      .eq("id", tok.pickup_request_id)
      .single();
    if (!req) return { ok: false as const, reason: "not_found" as const };
    const { data: student } = await supabaseAdmin
      .from("students").select("full_name, class").eq("id", req.student_id).single();

    return {
      ok: true as const,
      token: tok.token,
      expires_at: tok.expires_at,
      request: { ...req, student_name: student?.full_name ?? "Student", student_class: student?.class ?? null },
    };
  });

export const submitPickupResponse = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      token: z.string().min(10).max(200),
      response: z.enum(["approved", "rejected"]),
      reason: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: tok } = await supabaseAdmin
      .from("pickup_response_tokens")
      .select("id, used_at, expires_at, pickup_request_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Invalid link.");
    if (tok.used_at) throw new Error("This link has already been used.");
    if (new Date(tok.expires_at).getTime() < Date.now()) throw new Error("This link has expired.");

    // Mark token used
    const { error: tErr } = await supabaseAdmin
      .from("pickup_response_tokens")
      .update({
        used_at: new Date().toISOString(),
        response: data.response,
        reason: data.reason ?? null,
      })
      .eq("id", tok.id);
    if (tErr) throw new Error(tErr.message);

    // Update pickup request
    const { error: rErr } = await supabaseAdmin
      .from("pickup_requests")
      .update({
        status: data.response,
        responded_at: new Date().toISOString(),
        rejection_reason: data.response === "rejected" ? (data.reason ?? null) : null,
      })
      .eq("id", tok.pickup_request_id);
    if (rErr) throw new Error(rErr.message);

    return { ok: true, response: data.response };
  });
