import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SetCakeAvailabilityInput = {
  cake_id: number;
  available: boolean;
};

export const setCakeAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SetCakeAvailabilityInput) => {
    if (!Number.isInteger(input?.cake_id) || input.cake_id <= 0) {
      throw new Error("Invalid cake selected");
    }
    if (typeof input.available !== "boolean") {
      throw new Error("Invalid availability value");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !role) {
      throw new Error("Only admins can update cake availability");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cake_availability")
      .upsert(
        {
          cake_id: data.cake_id,
          available: data.available,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "cake_id" },
      );

    if (error) throw error;

    return { ok: true };
  });