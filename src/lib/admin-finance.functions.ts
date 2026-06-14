import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Shared helpers ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

const uuid = z.string().uuid();

// ============================================================
// 1. OPERATIONAL COSTS  (CRUD)
// ============================================================
const CostCategory = z.enum(["ingredients", "packaging", "miscellaneous"]);

const CostCreateSchema = z.object({
  item_name: z.string().min(1).max(200),
  category: CostCategory,
  cost_amount: z.number().nonnegative().max(1_000_000_000),
  date_incurred: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional().nullable(),
});

const CostUpdateSchema = CostCreateSchema.partial().extend({ id: uuid });

export const listCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category?: string; from?: string; to?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("operational_costs")
      .select("*")
      .order("date_incurred", { ascending: false });
    if (data.category) q = q.eq("category", data.category as any);
    if (data.from) q = q.gte("date_incurred", data.from);
    if (data.to) q = q.lte("date_incurred", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { costs: rows };
  });

export const createCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CostCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("operational_costs")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { cost: row };
  });

export const updateCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CostUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("operational_costs")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { cost: row };
  });

export const deleteCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("operational_costs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// 2. PREMISES EXPENSES  (CRUD)
// ============================================================
const BillingPeriod = z.enum(["one_time", "weekly", "monthly", "quarterly", "yearly"]);
const ExpenseStatus = z.enum(["paid", "unpaid", "overdue"]);

const PremisesCreateSchema = z.object({
  expense_type: z.string().min(1).max(200),
  amount: z.number().nonnegative().max(1_000_000_000),
  billing_period: BillingPeriod.default("monthly"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: ExpenseStatus.default("unpaid"),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
const PremisesUpdateSchema = PremisesCreateSchema.partial().extend({ id: uuid });

export const listPremises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("premises_expenses")
      .select("*")
      .order("due_date", { ascending: false });
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { premises: rows };
  });

export const createPremises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PremisesCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("premises_expenses")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { premises: row };
  });

export const updatePremises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PremisesUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("premises_expenses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { premises: row };
  });

export const deletePremises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("premises_expenses")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// 3. SALES ANALYTICS — aggregation by day/week/month
// ============================================================
const AnalyticsSchema = z.object({
  granularity: z.enum(["day", "week", "month"]).default("day"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const getSalesAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyticsSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.rpc("get_sales_analytics", {
      _granularity: data.granularity,
      _from: data.from ?? new Date(Date.now() - 30 * 86400_000).toISOString(),
      _to: data.to ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    const totals = (rows ?? []).reduce(
      (acc: any, r: any) => {
        acc.order_count += Number(r.order_count) || 0;
        acc.units_sold += Number(r.units_sold) || 0;
        acc.revenue += Number(r.revenue) || 0;
        return acc;
      },
      { order_count: 0, units_sold: 0, revenue: 0 },
    );

    return { buckets: rows ?? [], totals, granularity: data.granularity };
  });
