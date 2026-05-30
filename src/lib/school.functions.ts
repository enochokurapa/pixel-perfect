import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---- Students ----
export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(2).max(120),
      student_code: z.string().trim().max(40).optional().nullable(),
      class: z.string().trim().max(40).optional().nullable(),
      photo_url: z.string().url().optional().nullable(),
      branch_id: z.string().uuid().optional().nullable(),
      guardian_ids: z.array(z.string().uuid()).optional().default([]),
      primary_guardian_id: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: created, error } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: data.full_name,
        student_code: data.student_code ?? null,
        class: data.class ?? null,
        photo_url: data.photo_url ?? null,
        branch_id: data.branch_id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed to create student");
    if (data.guardian_ids.length) {
      await supabaseAdmin.from("student_guardians").insert(
        data.guardian_ids.map((gid) => ({
          student_id: created.id,
          guardian_id: gid,
          is_primary: gid === data.primary_guardian_id,
        })),
      );
    }
    return { id: created.id };
  });

// ---- Guardians ----
export const createGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(255),
      phone: z.string().trim().max(40).optional().nullable(),
      create_portal_account: z.boolean().default(true),
      password: z.string().min(8).max(72).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    let userId: string | null = null;
    if (data.create_portal_account) {
      const password = data.password ?? `Guard-${crypto.randomUUID().slice(0, 12)}!`;
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Failed to create portal user");
      userId = created.user.id;
      // Replace default 'host' role assigned by handle_new_user with guardian
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "guardian" });
    }
    const { data: guardian, error: gErr } = await supabaseAdmin
      .from("guardians")
      .insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        user_id: userId,
      })
      .select("id")
      .single();
    if (gErr || !guardian) throw new Error(gErr?.message ?? "Failed to create guardian");
    return { id: guardian.id, user_id: userId };
  });

// ---- Attendance ----
export const checkInStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      student_id: z.string().uuid(),
      check_in_method: z.enum(["van", "parent", "walking", "other"]),
      notes: z.string().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: student } = await supabaseAdmin
      .from("students").select("id, full_name, branch_id").eq("id", data.student_id).single();
    if (!student) throw new Error("Student not found");

    const { data: log, error } = await supabaseAdmin
      .from("attendance_logs")
      .insert({
        student_id: data.student_id,
        branch_id: student.branch_id,
        check_in_method: data.check_in_method,
        checked_in_by: context.userId,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify linked guardians in-app
    const { data: links } = await supabaseAdmin
      .from("student_guardians")
      .select("guardian_id")
      .eq("student_id", data.student_id);
    const guardianIds = (links ?? []).map((l) => l.guardian_id);
    let recipientIds: string[] = [];
    if (guardianIds.length) {
      const { data: gs } = await supabaseAdmin
        .from("guardians").select("user_id").in("id", guardianIds);
      recipientIds = (gs ?? []).map((g) => g.user_id).filter((id): id is string => !!id);
    }
    if (recipientIds.length) {
      await supabaseAdmin.from("notifications").insert(
        recipientIds.map((rid) => ({
          recipient_id: rid,
          type: "student_arrival",
          title: "Your child has arrived",
          message: `${student.full_name} arrived at school at ${new Date().toLocaleTimeString()}.`,
        })),
      );
    }
    return { id: log!.id };
  });

export const checkOutStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      attendance_id: z.string().uuid(),
      pickup_request_id: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Enforce: must have approved pickup unless attendance method = walking
    const { data: log } = await supabaseAdmin
      .from("attendance_logs")
      .select("id, student_id, check_in_method, check_out_at")
      .eq("id", data.attendance_id)
      .single();
    if (!log) throw new Error("Attendance record not found");
    if (log.check_out_at) throw new Error("Already checked out");

    if (log.check_in_method !== "walking") {
      if (!data.pickup_request_id) {
        throw new Error("Cannot release child: no pickup request approved.");
      }
      const { data: pr } = await supabaseAdmin
        .from("pickup_requests")
        .select("status, student_id")
        .eq("id", data.pickup_request_id)
        .single();
      if (!pr) throw new Error("Pickup request not found");
      if (pr.student_id !== log.student_id) throw new Error("Pickup request is for a different student");
      if (pr.status !== "approved") {
        throw new Error(`Cannot release child: pickup request is ${pr.status}. Guardian approval required.`);
      }
    }

    const { error } = await supabaseAdmin
      .from("attendance_logs")
      .update({
        check_out_at: new Date().toISOString(),
        checked_out_by: context.userId,
        pickup_request_id: data.pickup_request_id ?? null,
      })
      .eq("id", data.attendance_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Pickup requests ----
export const createPickupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      student_id: z.string().uuid(),
      pickup_person_name: z.string().trim().min(2).max(120),
      pickup_person_phone: z.string().trim().max(40).optional().nullable(),
      vehicle_plate: z.string().trim().max(40).optional().nullable(),
      pickup_person_photo_url: z.string().url().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: student } = await supabaseAdmin
      .from("students").select("id, full_name, branch_id").eq("id", data.student_id).single();
    if (!student) throw new Error("Student not found");

    const { data: req, error } = await supabaseAdmin
      .from("pickup_requests")
      .insert({
        student_id: data.student_id,
        branch_id: student.branch_id,
        pickup_person_name: data.pickup_person_name,
        pickup_person_phone: data.pickup_person_phone ?? null,
        vehicle_plate: data.vehicle_plate ?? null,
        pickup_person_photo_url: data.pickup_person_photo_url ?? null,
        requested_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !req) throw new Error(error?.message ?? "Failed to create pickup request");

    // Token (30 min, single use)
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabaseAdmin.from("pickup_response_tokens").insert({
      pickup_request_id: req.id,
      token,
      expires_at: expires,
    });

    // Notify primary guardian(s) in-app
    const { data: links } = await supabaseAdmin
      .from("student_guardians")
      .select("guardian_id, is_primary")
      .eq("student_id", data.student_id);
    const linkList = links ?? [];
    const primaryIds = linkList.filter((l) => l.is_primary).map((l) => l.guardian_id);
    const targetIds = primaryIds.length ? primaryIds : linkList.map((l) => l.guardian_id);
    let guardians: { user_id: string | null; email: string | null }[] = [];
    if (targetIds.length) {
      const { data: gs } = await supabaseAdmin
        .from("guardians").select("user_id, email").in("id", targetIds);
      guardians = gs ?? [];
    }
    const userIds = guardians.map((g) => g.user_id).filter((x): x is string => !!x);
    if (userIds.length) {
      await supabaseAdmin.from("notifications").insert(
        userIds.map((uid) => ({
          recipient_id: uid,
          type: "pickup_approval_request",
          title: "Pickup approval required",
          message: `${data.pickup_person_name} has arrived to pick up ${student.full_name}. Open the portal to approve or reject (expires in 30 min).`,
        })),
      );
    }

    return {
      id: req.id,
      token,
      response_url: `/pickup-response/${token}`,
      guardian_emails: guardians.map((g) => g.email).filter(Boolean),
    };
  });

export const respondToPickupAsGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      pickup_request_id: z.string().uuid(),
      response: z.enum(["approved", "rejected"]),
      reason: z.string().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: guardian } = await supabaseAdmin
      .from("guardians").select("id").eq("user_id", context.userId).single();
    if (!guardian) throw new Error("Not linked to a guardian profile");
    const { error } = await supabaseAdmin
      .from("pickup_requests")
      .update({
        status: data.response,
        guardian_id: guardian.id,
        responded_at: new Date().toISOString(),
        rejection_reason: data.response === "rejected" ? (data.reason ?? null) : null,
      })
      .eq("id", data.pickup_request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
