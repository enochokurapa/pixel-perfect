import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const submitKioskRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        branch_id: z.string().uuid(),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(5).max(40),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        company: z.string().trim().max(120).optional().or(z.literal("")),
        id_type: z.string().trim().max(40).optional().or(z.literal("")),
        id_number: z.string().trim().max(80).optional().or(z.literal("")),
        purpose: z.string().trim().min(2).max(500),
        host_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // upsert visitor by phone
    const { data: existing } = await supabaseAdmin
      .from("visitors")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();

    let visitorId = existing?.id;
    const visitorPayload = {
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      company: data.company || null,
      id_type: data.id_type || null,
      id_number: data.id_number || null,
    };
    if (!visitorId) {
      const { data: v, error: vErr } = await supabaseAdmin
        .from("visitors")
        .insert(visitorPayload)
        .select("id")
        .single();
      if (vErr) throw new Error(vErr.message);
      visitorId = v.id;
    } else {
      await supabaseAdmin.from("visitors").update(visitorPayload).eq("id", visitorId);
    }

    // blacklist check
    const { data: bl } = await supabaseAdmin
      .from("blacklist")
      .select("reason")
      .eq("visitor_id", visitorId)
      .eq("active", true)
      .maybeSingle();
    if (bl) throw new Error(`This visitor is blacklisted: ${bl.reason}`);

    const { data: visit, error: visitErr } = await supabaseAdmin
      .from("visits")
      .insert({
        visitor_id: visitorId,
        host_id: data.host_id,
        branch_id: data.branch_id,
        visit_type: "guest",
        visit_mode: "walk_in",
        purpose: data.purpose,
        company: data.company || null,
        status: "pending",
        approval: "pending",
        pre_registered: false,
        kiosk_self_registered: true,
      })
      .select("id")
      .single();
    if (visitErr) throw new Error(visitErr.message);

    // Notify the host (single, targeted)
    await supabaseAdmin.from("notifications").insert({
      recipient_id: data.host_id,
      type: "visit_pre_registered",
      title: "Self-registration awaiting your approval",
      message: `${data.full_name} self-registered at reception to see you. Please approve.`,
      visit_id: visit.id,
    });

    // Notify front-desk staff at the same branch
    const { data: deskStaff } = await supabaseAdmin
      .from("user_branch_roles")
      .select("user_id, role")
      .eq("branch_id", data.branch_id)
      .in("role", ["register_guest", "checkout_visitor", "manage_badges"]);
    const recipients = Array.from(new Set((deskStaff ?? []).map((r) => r.user_id)));
    if (recipients.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        recipients.map((rid) => ({
          recipient_id: rid,
          type: "visit_pre_registered" as const,
          title: "Self-registration at reception",
          message: `${data.full_name} self-registered to see a host. Awaiting approval.`,
          visit_id: visit.id,
        })),
      );
    }

    return { ok: true, visit_id: visit.id };
  });

export const getKioskBranchInfo = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ branch_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("id, name, location")
      .eq("id", data.branch_id)
      .maybeSingle();
    if (!branch) throw new Error("Branch not found");

    // Hosts = staff assigned to this branch via user_branch_roles, or whose profile.branch_id matches
    const { data: assigned } = await supabaseAdmin
      .from("user_branch_roles")
      .select("user_id")
      .eq("branch_id", data.branch_id);
    const assignedIds = Array.from(new Set((assigned ?? []).map((r) => r.user_id)));

    const { data: profilesAssigned } =
      assignedIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, full_name, position, department")
            .in("id", assignedIds)
            .eq("is_active", true)
            .order("full_name")
        : { data: [] as { id: string; full_name: string; position: string | null; department: string | null }[] };

    const { data: profilesByBranch } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, position, department")
      .eq("branch_id", data.branch_id)
      .eq("is_active", true)
      .order("full_name");

    const map = new Map<string, { id: string; full_name: string; position: string | null; department: string | null }>();
    [...(profilesAssigned ?? []), ...(profilesByBranch ?? [])].forEach((p) => map.set(p.id, p));
    const hosts = Array.from(map.values());

    return { branch, hosts };
  });
