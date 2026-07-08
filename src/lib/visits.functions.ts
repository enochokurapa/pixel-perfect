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
    const { data: result, error } = await (supabaseAdmin.rpc as any)("checkout_visit", {
      _actor_id: context.userId,
      _visit_id: data.visit_id,
      _badge_returned: data.badge_returned,
      _assets_verified: data.assets_verified,
      _checkout_notes: data.checkout_notes || null,
    });

    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return { ok: true, checked_out_at: row?.checked_out_at ?? null };
  });