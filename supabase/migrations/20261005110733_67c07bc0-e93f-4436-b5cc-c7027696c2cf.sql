CREATE TABLE public.taqseemat_profits (
  id uuid not null default gen_random_uuid() primary key,
  profit_date date not null unique,
  amount numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taqseemat_profits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taqseemat_profits TO anon;
GRANT ALL ON public.taqseemat_profits TO service_role;
ALTER TABLE public.taqseemat_profits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taqseemat_profits open access" ON public.taqseemat_profits FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER taqseemat_profits_updated_at BEFORE UPDATE ON public.taqseemat_profits FOR EACH ROW EXECUTE FUNCTION set_updated_at();