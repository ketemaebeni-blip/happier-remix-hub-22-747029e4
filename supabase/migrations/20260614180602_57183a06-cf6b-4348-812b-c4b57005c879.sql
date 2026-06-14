
-- Enums
CREATE TYPE public.cost_category AS ENUM ('ingredients', 'packaging', 'miscellaneous');
CREATE TYPE public.billing_period AS ENUM ('one_time', 'weekly', 'monthly', 'quarterly', 'yearly');
CREATE TYPE public.expense_status AS ENUM ('paid', 'unpaid', 'overdue');

-- 1. Operational costs
CREATE TABLE public.operational_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category public.cost_category NOT NULL,
  cost_amount NUMERIC(12,2) NOT NULL CHECK (cost_amount >= 0),
  date_incurred DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_costs TO authenticated;
GRANT ALL ON public.operational_costs TO service_role;
ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage operational_costs" ON public.operational_costs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_operational_costs_date ON public.operational_costs(date_incurred DESC);
CREATE INDEX idx_operational_costs_category ON public.operational_costs(category);
CREATE TRIGGER trg_operational_costs_updated BEFORE UPDATE ON public.operational_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Premises expenses
CREATE TABLE public.premises_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  due_date DATE NOT NULL,
  status public.expense_status NOT NULL DEFAULT 'unpaid',
  paid_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premises_expenses TO authenticated;
GRANT ALL ON public.premises_expenses TO service_role;
ALTER TABLE public.premises_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage premises_expenses" ON public.premises_expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_premises_due_date ON public.premises_expenses(due_date DESC);
CREATE INDEX idx_premises_status ON public.premises_expenses(status);
CREATE TRIGGER trg_premises_expenses_updated BEFORE UPDATE ON public.premises_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Sales aggregation function (uses existing orders + items jsonb)
-- granularity: 'day' | 'week' | 'month'
CREATE OR REPLACE FUNCTION public.get_sales_analytics(
  _granularity TEXT DEFAULT 'day',
  _from TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  _to   TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  order_count BIGINT,
  units_sold BIGINT,
  revenue NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trunc_unit TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  trunc_unit := CASE lower(_granularity)
    WHEN 'week'  THEN 'week'
    WHEN 'month' THEN 'month'
    ELSE 'day'
  END;

  RETURN QUERY
  SELECT
    date_trunc(trunc_unit, o.created_at) AS bucket,
    COUNT(*)::BIGINT AS order_count,
    COALESCE(SUM((
      SELECT COALESCE(SUM( (i->>'quantity')::INT ), 0)
      FROM jsonb_array_elements(o.items) AS i
    )), 0)::BIGINT AS units_sold,
    COALESCE(SUM(o.total), 0)::NUMERIC AS revenue
  FROM public.orders o
  WHERE o.created_at >= _from
    AND o.created_at <  _to
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_analytics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
