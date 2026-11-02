CREATE OR REPLACE FUNCTION public.cig_mardooda_balance()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
      SELECT SUM(quantity * wholesale_price)
      FROM public.cig_transfers
    ), 0)
    + COALESCE((
      SELECT SUM(quantity * wholesale_price)
      FROM public.purchases
      WHERE supplier = 'الونش🏡'
    ), 0)
    - COALESCE((
      SELECT SUM(quantity * wholesale_price)
      FROM public.cig_purchases
    ), 0)
    - COALESCE((
      SELECT SUM(amount)
      FROM public.cig_settlements
    ), 0)
$$;