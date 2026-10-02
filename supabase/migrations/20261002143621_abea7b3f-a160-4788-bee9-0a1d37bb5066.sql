CREATE TABLE public.cashier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL UNIQUE,
  name text NOT NULL,
  wholesale_price numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_products TO anon, authenticated;
GRANT ALL ON public.cashier_products TO service_role;
ALTER TABLE public.cashier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashier_products open access" ON public.cashier_products FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER cashier_products_updated_at BEFORE UPDATE ON public.cashier_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.cashier_sales DROP CONSTRAINT IF EXISTS cashier_sales_product_id_fkey;