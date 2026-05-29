import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_ROLES, type Role } from "@/lib/permissions";
import type { Database } from "@/integrations/supabase/types";

type DbRole = Database["public"]["Enums"]["app_role"];
const ROLES = ALL_ROLES as unknown as readonly [Role, ...Role[]];


export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        position: z.string().trim().max(120).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        department: z.string().trim().max(120).optional().nullable(),
        branch_id: z.string().uuid().optional().nullable(),
        roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length),

      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");

    const newUserId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        position: data.position ?? null,
        phone: data.phone ?? null,
        department: data.department ?? null,
        branch_id: data.branch_id ?? null,
      })
      .eq("id", newUserId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const rows = data.roles.map((role) => ({ user_id: newUserId, role }));
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (rErr) throw new Error(rErr.message);

    return { id: newUserId };
  });

export const updateStaffRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        roles: z.array(z.enum(ROLES)).min(1).max(4),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId && !data.roles.includes("admin")) {
      throw new Error("You cannot remove your own admin role.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const rows = data.roles.map((role) => ({ user_id: data.user_id, role }));
    const { error } = await supabaseAdmin.from("user_roles").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId) throw new Error("You cannot delete yourself.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId && !data.is_active) {
      throw new Error("You cannot deactivate yourself.");
    }
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);
    // Freeze sign-in via Supabase Auth ban_duration
    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.is_active ? "none" : "876600h",
    } as never);
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
  });
