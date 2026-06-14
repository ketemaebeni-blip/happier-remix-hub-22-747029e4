GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT SELECT ON public.shop_item_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_item_availability TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
GRANT ALL ON public.shop_item_availability TO service_role;