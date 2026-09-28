CREATE TABLE public.profit_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profit_date date NOT NULL UNIQUE,
  taken_amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profit_withdrawals TO anon, authenticated;
GRANT ALL ON public.profit_withdrawals TO service_role;
ALTER TABLE public.profit_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access profit_withdrawals" ON public.profit_withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER profit_withdrawals_updated_at BEFORE UPDATE ON public.profit_withdrawals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();