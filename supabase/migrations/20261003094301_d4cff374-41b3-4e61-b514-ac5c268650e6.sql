CREATE TABLE public.cigarette_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL UNIQUE,
  retail_total NUMERIC NOT NULL DEFAULT 0,
  wholesale_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cigarette_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cigarette_sales TO anon;
GRANT ALL ON public.cigarette_sales TO service_role;
ALTER TABLE public.cigarette_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cigarette_sales open access" ON public.cigarette_sales FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.taqseemat_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cigarettes','sales')),
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taqseemat_withdrawals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taqseemat_withdrawals TO anon;
GRANT ALL ON public.taqseemat_withdrawals TO service_role;
ALTER TABLE public.taqseemat_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taqseemat_withdrawals open access" ON public.taqseemat_withdrawals FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_cigarette_sales_updated_at BEFORE UPDATE ON public.cigarette_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();