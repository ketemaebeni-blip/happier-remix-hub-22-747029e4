
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.grant_admin_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'owner@selamcake.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_signup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_grant_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_signup();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.cake_availability (
  cake_id INTEGER PRIMARY KEY,
  available BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT (cake_id, available, updated_at) ON public.cake_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cake_availability TO authenticated;
GRANT ALL ON public.cake_availability TO service_role;
ALTER TABLE public.cake_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view cake_av" ON public.cake_availability FOR SELECT USING (true);
CREATE POLICY "Admin ins cake_av" ON public.cake_availability FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin upd cake_av" ON public.cake_availability FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin del cake_av" ON public.cake_availability FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.cake_availability REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cake_availability;

CREATE TABLE public.cake_overrides (
  cake_id INTEGER PRIMARY KEY,
  name TEXT, category TEXT, price NUMERIC, image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT (cake_id, name, category, price, image_url, updated_at) ON public.cake_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cake_overrides TO authenticated;
GRANT ALL ON public.cake_overrides TO service_role;
ALTER TABLE public.cake_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view co" ON public.cake_overrides FOR SELECT USING (true);
CREATE POLICY "Admin ins co" ON public.cake_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin upd co" ON public.cake_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin del co" ON public.cake_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.cake_overrides REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cake_overrides;

CREATE TABLE public.cake_availability_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cake_id INTEGER NOT NULL,
  available BOOLEAN NOT NULL,
  changed_by UUID,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cake_availability_log TO authenticated;
GRANT ALL ON public.cake_availability_log TO service_role;
ALTER TABLE public.cake_availability_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view log" ON public.cake_availability_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_cal_changed_at ON public.cake_availability_log (changed_at DESC);
CREATE INDEX idx_cal_cake_id ON public.cake_availability_log (cake_id);

CREATE OR REPLACE FUNCTION public.log_cake_availability_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email TEXT; v_user UUID;
BEGIN
  v_user := COALESCE(NEW.updated_by, auth.uid());
  IF v_user IS NOT NULL THEN SELECT email INTO v_email FROM auth.users WHERE id = v_user; END IF;
  IF TG_OP = 'UPDATE' AND NEW.available IS NOT DISTINCT FROM OLD.available THEN RETURN NEW; END IF;
  INSERT INTO public.cake_availability_log (cake_id, available, changed_by, changed_by_email) VALUES (NEW.cake_id, NEW.available, v_user, v_email);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_cake_availability_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cake_availability_log_trigger AFTER INSERT OR UPDATE ON public.cake_availability FOR EACH ROW EXECUTE FUNCTION public.log_cake_availability_change();

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text, customer_phone text, customer_address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view orders" ON public.orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin upd orders" ON public.orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin del orders" ON public.orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin up cake imgs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cake-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin update cake imgs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cake-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin del cake imgs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cake-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone read cake imgs" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'cake-images');

CREATE TABLE public.shop_item_availability (
  item_id text PRIMARY KEY,
  available boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.shop_item_availability TO anon, authenticated;
GRANT ALL ON public.shop_item_availability TO service_role;
ALTER TABLE public.shop_item_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view sia" ON public.shop_item_availability FOR SELECT USING (true);
CREATE POLICY "Admin ins sia" ON public.shop_item_availability FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin upd sia" ON public.shop_item_availability FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin del sia" ON public.shop_item_availability FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_sia_updated_at BEFORE UPDATE ON public.shop_item_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.shop_item_availability (item_id, available) VALUES
  ('fast1', true),('fast2', true),('fast3', true),('fast4', true),
  ('ker1', true),('ker2', true),('ker3', true),('ker4', true),
  ('ysh1', true),('ysh2', true),('ysh3', true),('ysh4', true),
  ('grad1', true),('grad2', true),('grad3', true),('grad4', true),
  ('wed1', true),('wed2', true),('wed3', true),('wed4', true),
  ('bday1', true),('bday2', true),('bday3', true),('bday4', true),
  ('avail1', true),('avail2', true),('avail3', true),('avail4', true),('avail5', true),('avail6', true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_item_availability;

CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  sub text NOT NULL DEFAULT '',
  cat text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  img text NOT NULL DEFAULT '',
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view si" ON public.shop_items FOR SELECT USING (true);
CREATE POLICY "Admin ins si" ON public.shop_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin upd si" ON public.shop_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin del si" ON public.shop_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON public.shop_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;

INSERT INTO public.shop_items (id, name, sub, cat, price, img, sort_order) VALUES
('fast1','Fruit & Nut Fasting Cake','Mixed dried fruits · Walnuts · Spiced batter · No dairy','Fasting',35,'https://images.pexels.com/photos/37661106/pexels-photo-37661106.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('fast2','Vegan Chocolate','Rich cocoa · Coconut milk · Dairy-free ganache','Fasting',38,'https://images.pexels.com/photos/37262561/pexels-photo-37262561.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('fast3','Apple Cinnamon','Fresh apples · Cinnamon spice · Oat crumble topping','Fasting',32,'https://images.pexels.com/photos/30739085/pexels-photo-30739085.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('fast4','Carrot Walnut','Grated carrots · Walnuts · Orange zest · Plant-based cream','Fasting',34,'https://images.pexels.com/photos/32397279/pexels-photo-32397279.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('ker1','Baptism Cross Cake','White vanilla · Gold cross · Soft buttercream','Kerestena',45,'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('ker2','Holy Communion Cake','Elegant white · Host detail · Floral accents','Kerestena',55,'https://images.pexels.com/photos/32437628/pexels-photo-32437628.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('ker3','Easter Resurrection Cake','Chocolate layers · Spring florals · Symbolic design','Kerestena',48,'https://images.pexels.com/photos/31336127/pexels-photo-31336127.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('ker4','Confirmation Blessing','Light sponge · Pastel frosting · Dove decoration','Kerestena',42,'https://images.pexels.com/photos/15307373/pexels-photo-15307373.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('ysh1','Traditional Shemgelena','Honey bread base · Decorative icing · Cultural motifs','Yeshemgelena',40,'https://images.pexels.com/photos/29051739/pexels-photo-29051739.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('ysh2','Blue Baby Welcome','Vanilla sponge · Blue buttercream · Teddy topper','Yeshemgelena',38,'https://images.pexels.com/photos/30233124/pexels-photo-30233124.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('ysh3','Pink Baby Shower','Strawberry cream · Pink roses · Edible pearls','Yeshemgelena',38,'https://images.pexels.com/photos/12742498/pexels-photo-12742498.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('ysh4','Neutral Woodland','Earthy tones · Forest animals · Gender-neutral design','Yeshemgelena',42,'https://images.pexels.com/photos/30233124/pexels-photo-30233124.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('grad1','Cap & Gown Tier','2-tier chocolate · Graduation cap topper · Gold details','Graduation',65,'https://images.pexels.com/photos/9540405/pexels-photo-9540405.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('grad2','Diploma Scroll','Vanilla roll design · Edible ribbon · Personalised name','Graduation',50,'https://images.pexels.com/photos/20768168/pexels-photo-20768168.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('grad3','Class of 2026','Modern design · School colours · Year banner','Graduation',58,'https://images.pexels.com/photos/12419449/pexels-photo-12419449.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('grad4','Scholar Book Stack','Stacked book design · Fondant finish · Quote plaque','Graduation',55,'https://images.pexels.com/photos/6210746/pexels-photo-6210746.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('wed1','3-Tier Floral Wedding','Vanilla sponge · Buttercream roses · Fresh greenery','Wedding',220,'https://images.pexels.com/photos/34569681/pexels-photo-34569681.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('wed2','Anniversary Gold','Golden fondant · Champagne accents · Sugar flowers','Wedding',95,'https://images.pexels.com/photos/34073612/pexels-photo-34073612.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('wed3','Silver Jubilee','Silver leaf details · White tiers · 25th anniversary','Wedding',150,'https://images.pexels.com/photos/17869890/pexels-photo-17869890.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('wed4','Classic Ivory Wedding','Single tier · Ivory fondant · Gold leaf details','Wedding',120,'https://images.pexels.com/photos/28378968/pexels-photo-28378968.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('bday1','Chocolate Celebration','Dark chocolate sponge · Ganache drip · Strawberry topping','Birthday',38,'https://images.pexels.com/photos/2337821/pexels-photo-2337821.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('bday2','Vanilla Party Cake','Classic vanilla · Rainbow sprinkles · Buttercream','Birthday',32,'https://images.pexels.com/photos/32916204/pexels-photo-32916204.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('bday3','Red Velvet Party','Red velvet layers · Cream cheese · Festive decor','Birthday',42,'https://images.pexels.com/photos/9553739/pexels-photo-9553739.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('bday4','Custom Theme Cake','Your design · Any theme · Personalised message','Birthday',55,'https://images.pexels.com/photos/5713248/pexels-photo-5713248.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('avail1','Classic Vanilla Slice','Freshly baked this morning · Light sponge · Buttercream','Available Today',6,'https://images.pexels.com/photos/1055272/pexels-photo-1055272.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',10),
('avail2','Chocolate Fudge Cupcake','Rich cocoa · Ganache topping · Sprinkles','Available Today',4.5,'https://images.pexels.com/photos/3776947/pexels-photo-3776947.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',20),
('avail3','Strawberry Tart','Fresh strawberries · Custard · Flaky pastry','Available Today',7,'https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',30),
('avail4','Lemon Drizzle Loaf','Zesty lemon · Sugar glaze · Moist sponge','Available Today',5.5,'https://images.pexels.com/photos/1485806/pexels-photo-1485806.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',40),
('avail5','Red Velvet Cookie','Cream cheese chunks · Cocoa · Soft bake','Available Today',3.5,'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',50),
('avail6','Cinnamon Roll','Warm spice · Cream cheese glaze · Yeast dough','Available Today',5,'https://images.pexels.com/photos/351961/pexels-photo-351961.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400',60);
