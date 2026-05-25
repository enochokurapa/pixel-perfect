import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "receptionist", "security", "host"] as const;
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
        roles: z.array(z.enum(ROLES)).min(1).max(3),
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

    // The handle_new_user trigger has already inserted profile + default 'host' role.
    // Update profile extras.
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        position: data.position ?? null,
        phone: data.phone ?? null,
        department: data.department ?? null,
      })
      .eq("id", newUserId);

    // Replace roles with the requested set.
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
        roles: z.array(z.enum(ROLES)).min(1).max(3),
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
