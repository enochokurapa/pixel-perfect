import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "visit.register"
  | "visit.pre_register"
  | "visit.self_register"
  | "visit.approve"
  | "visit.reject"
  | "visit.check_in"
  | "visit.check_out"
  | "visit.badge_issued"
  | "visit.photo_captured"
  | "visit.vehicle_updated"
  | "blacklist.add"
  | "blacklist.remove"
  | "badge.add"
  | "badge.remove"
  | "staff.create"
  | "staff.update"
  | "staff.move_branch"
  | "branch.create"
  | "branch.update"
  | "branch.delete"
  | "auth.sign_in";

export async function logActivity(input: {
  action: ActivityAction;
  entityType?: string;
  entityId?: string | null;
  branchId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: session } = await supabase.auth.getUser();
    const user = session?.user;
    if (!user) return;
    let actorName: string | null = null;
    let actorDept: string | null = null;
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, department")
        .eq("id", user.id)
        .maybeSingle();
      actorName = p?.full_name ?? user.email ?? null;
      actorDept = p?.department ?? null;
    } catch {
      actorName = user.email ?? null;
    }
    await supabase.from("activity_log" as never).insert({
      actor_id: user.id,
      actor_name: actorName,
      actor_department: actorDept,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      branch_id: input.branchId ?? null,
      details: input.details ?? {},
    } as never);
  } catch (err) {
    // Non-blocking: never break the user action because logging failed.
    // eslint-disable-next-line no-console
    console.warn("activity_log failed", err);
  }
}
