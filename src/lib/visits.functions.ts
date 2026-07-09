import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkoutVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        visit_id: z.string().uuid(),
        badge_returned: z.boolean(),
        assets_verified: z.boolean(),
        checkout_notes: z.string().trim().max(1000).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: result, error } = await supabase.rpc("checkout_visit", {
      _actor_id: context.userId,
      _visit_id: data.visit_id,
      _badge_returned: data.badge_returned,
      _assets_verified: data.assets_verified,
      _checkout_notes: data.checkout_notes || undefined,
    });

    if (error) throw new Error(error.message);

    const checkout = result?.[0];
    if (!checkout?.ok) {
      throw new Error("Visitor could not be checked out. Please try again.");
    }

    return { ok: true, checked_out_at: checkout.checked_out_at };
  });