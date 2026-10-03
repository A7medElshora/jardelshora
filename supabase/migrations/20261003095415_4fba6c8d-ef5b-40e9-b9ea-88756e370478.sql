CREATE TABLE public.manual_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date date NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_sales TO anon;
GRANT ALL ON public.manual_sales TO service_role;
ALTER TABLE public.manual_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual_sales open access" ON public.manual_sales FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_manual_sales_updated_at BEFORE UPDATE ON public.manual_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();