ALTER TABLE public.taqseemat_profits
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS outgoing_amount numeric NOT NULL DEFAULT 0;