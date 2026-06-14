
-- Seed sample data for sales, costs, and premises so the admin dashboard
-- has something to display immediately after login.

-- 1) Sample orders (last 45 days) — used by sales analytics
INSERT INTO public.orders (customer_name, customer_phone, customer_address, items, total, status, created_at)
SELECT
  'Sample Customer ' || gs,
  '+25191' || (1000000 + (random()*8999999)::int)::text,
  'Addis Ababa',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', 'cake-' || (1 + (random()*5)::int),
      'name', (ARRAY['Vanilla Cake','Chocolate Cake','Red Velvet','Birthday Special','Wedding Tier'])[1 + (random()*4)::int],
      'qty', 1 + (random()*3)::int,
      'price', (500 + (random()*1500)::int)
    )
  ),
  (800 + (random()*4000)::int)::numeric,
  (ARRAY['new','preparing','done','done','done'])[1 + (random()*4)::int],
  now() - ((random()*45)::int || ' days')::interval - ((random()*23)::int || ' hours')::interval
FROM generate_series(1, 60) gs;

-- 2) Sample operational costs (last 30 days)
INSERT INTO public.operational_costs (item_name, category, cost_amount, date_incurred, notes)
VALUES
  ('Flour (50kg sack)', 'ingredients', 3200, current_date - 2, 'Weekly stock'),
  ('Sugar (25kg)', 'ingredients', 1800, current_date - 3, NULL),
  ('Butter (10kg)', 'ingredients', 4500, current_date - 5, 'Premium brand'),
  ('Eggs (crate x10)', 'ingredients', 2200, current_date - 6, NULL),
  ('Cocoa powder', 'ingredients', 1600, current_date - 8, NULL),
  ('Fresh cream', 'ingredients', 2100, current_date - 10, NULL),
  ('Cake boxes (200pc)', 'packaging', 1500, current_date - 4, NULL),
  ('Ribbons & tags', 'packaging', 600, current_date - 9, NULL),
  ('Plastic wraps', 'packaging', 450, current_date - 12, NULL),
  ('Delivery fuel', 'miscellaneous', 1200, current_date - 1, NULL),
  ('Cleaning supplies', 'miscellaneous', 800, current_date - 7, NULL),
  ('Equipment repair', 'miscellaneous', 2500, current_date - 14, 'Oven thermostat'),
  ('Vanilla extract', 'ingredients', 950, current_date - 16, NULL),
  ('Food coloring', 'ingredients', 400, current_date - 18, NULL),
  ('Paper bags', 'packaging', 350, current_date - 20, NULL);

-- 3) Sample premises expenses
INSERT INTO public.premises_expenses (expense_type, amount, billing_period, due_date, status, paid_date, notes)
VALUES
  ('Shop Rent', 25000, 'monthly', current_date + 5, 'unpaid', NULL, 'Main location'),
  ('Electricity', 4200, 'monthly', current_date + 8, 'unpaid', NULL, NULL),
  ('Water', 850, 'monthly', current_date + 10, 'unpaid', NULL, NULL),
  ('Internet', 1500, 'monthly', current_date + 12, 'paid', current_date - 1, 'Ethio Telecom'),
  ('Garbage collection', 300, 'monthly', current_date - 2, 'overdue', NULL, NULL),
  ('Shop Rent', 25000, 'monthly', current_date - 25, 'paid', current_date - 25, 'Previous month'),
  ('Electricity', 3950, 'monthly', current_date - 22, 'paid', current_date - 22, NULL),
  ('Business license', 8000, 'yearly', current_date + 90, 'unpaid', NULL, NULL);
