-- Create sales_purchase_invoices table for wholesale invoices and retail tracking
CREATE TABLE IF NOT EXISTS public.sales_purchase_invoices (
  id text PRIMARY KEY,
  invoice_number text,
  invoice_date date NOT NULL,
  supplier_name text NOT NULL,
  notes text,
  paid_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_purchase_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_purchase_invoices TO anon;
GRANT ALL ON public.sales_purchase_invoices TO service_role;

-- Row Level Security
ALTER TABLE public.sales_purchase_invoices ENABLE ROW LEVEL SECURITY;

-- Open Access Policy for anon and authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_purchase_invoices' AND policyname = 'sales_purchase_invoices open access'
  ) THEN
    CREATE POLICY "sales_purchase_invoices open access" ON public.sales_purchase_invoices
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
