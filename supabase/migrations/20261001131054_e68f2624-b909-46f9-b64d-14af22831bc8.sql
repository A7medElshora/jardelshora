ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE public.cashier_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  wholesale_price numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  sale_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_sales TO anon, authenticated;
GRANT ALL ON public.cashier_sales TO service_role;
ALTER TABLE public.cashier_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashier_sales open access" ON public.cashier_sales FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX cashier_sales_date_idx ON public.cashier_sales(sale_date);