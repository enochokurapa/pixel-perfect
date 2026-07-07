import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  visit_id: z.string().uuid(),
  badge_returned: z.boolean(),
  assets_verified: z.boolean(),
  checkout_notes: z.string().trim().max(1000).optional().default(""),
});

export const checkoutVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: visit, error: visitError } = await supabaseAdmin
      .from("visits")
      .select("id, status, badge_number, branch_id, visitor:visitors(full_name)")
      .eq("id", data.visit_id)
      .maybeSingle();

    if (visitError) throw new Error(visitError.message);
    if (!visit) throw new Error("Visit not found.");
    if (visit.status !== "checked_in") throw new Error("Only checked-in visitors can be checked out.");
    if (visit.badge_number && !data.badge_returned) {
      throw new Error("Please confirm the badge was returned before checking out.");
    }
    if (!data.assets_verified) {
      throw new Error("Please confirm assets were verified before checking out.");
    }

    const [{ data: globalRoles, error: globalRoleError }, { data: branchRoles, error: branchRoleError }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["admin", "checkout_visitor", "manage_badges"]),
      supabaseAdmin
        .from("user_branch_roles")
        .select("role, branch_id")
        .eq("user_id", context.userId)
        .in("role", ["admin", "checkout_visitor", "manage_badges"]),
    ]);

    if (globalRoleError) throw new Error(globalRoleError.message);
    if (branchRoleError) throw new Error(branchRoleError.message);

    const hasGlobalPermission = (globalRoles ?? []).length > 0;
    const hasBranchPermission = (branchRoles ?? []).some((role) =>
      visit.branch_id ? role.branch_id === visit.branch_id : true,
    );

    if (!hasGlobalPermission && !hasBranchPermission) {
      throw new Error("You do not have permission to check out visitors.");
    }

    const checkedOutAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("visits")
      .update({
        status: "checked_out",
        check_out_at: checkedOutAt,
        badge_returned: data.badge_returned,
        assets_verified: data.assets_verified,
        checkout_notes: data.checkout_notes || null,
      })
      .eq("id", data.visit_id)
      .eq("status", "checked_in");

    if (updateError) throw new Error(updateError.message);

    if (visit.badge_number) {
      let badgeQuery = supabaseAdmin
        .from("badges")
        .update({ status: "available" })
        .eq("badge_number", visit.badge_number);

      badgeQuery = visit.branch_id ? badgeQuery.eq("branch_id", visit.branch_id) : badgeQuery.is("branch_id", null);

      const { error: badgeError } = await badgeQuery;
      if (badgeError) throw new Error(badgeError.message);
    }

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("full_name, department, email")
      .eq("id", context.userId)
      .maybeSingle();

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      actor_name: actor?.full_name ?? actor?.email ?? null,
      actor_department: actor?.department ?? null,
      action: "visit.check_out",
      entity_type: "visit",
      entity_id: visit.id,
      branch_id: visit.branch_id,
      details: {
        visitor: Array.isArray(visit.visitor) ? visit.visitor[0]?.full_name : visit.visitor?.full_name,
        badge_number: visit.badge_number,
        badge_returned: data.badge_returned,
        assets_verified: data.assets_verified,
      },
    });

    return { ok: true, checked_out_at: checkedOutAt };
  });