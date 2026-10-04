CREATE TABLE public.profit_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profit_expenses TO anon, authenticated;
GRANT ALL ON public.profit_expenses TO service_role;
ALTER TABLE public.profit_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profit_expenses open access" ON public.profit_expenses FOR ALL USING (true) WITH CHECK (true);