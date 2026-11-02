CREATE OR REPLACE FUNCTION public.cig_mardooda_balance()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT SUM(quantity * wholesale_price) FROM public.cig_transfers), 0)
    + COALESCE((
      SELECT SUM(quantity * wholesale_price)
      FROM public.purchases
      WHERE supplier = 'الونش🏡'
    ), 0)
    - COALESCE((SELECT SUM(quantity * wholesale_price) FROM public.cig_purchases), 0)
    - COALESCE((SELECT SUM(amount) FROM public.cig_settlements), 0)
$$;

CREATE OR REPLACE FUNCTION public.cig_item_remaining(p_item_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT quantity FROM public.cig_items WHERE id = p_item_id), 0)
    + COALESCE((SELECT SUM(quantity) FROM public.cig_purchases WHERE item_id = p_item_id), 0)
    - COALESCE((SELECT SUM(quantity) FROM public.cig_transfers WHERE item_id = p_item_id), 0)
    - COALESCE((
      SELECT SUM(p.quantity)
      FROM public.purchases p
      JOIN public.products product ON product.id = p.product_id
        AND regexp_replace(lower(btrim(product.name)), '[[:space:]]+', ' ', 'g') =
          regexp_replace(lower(btrim((
            SELECT name FROM public.cig_items WHERE id = p_item_id
          ))), '[[:space:]]+', ' ', 'g')
      WHERE p.supplier = 'الونش🏡'
    ), 0)
$$;

CREATE OR REPLACE FUNCTION public.cig_item_unit_cost(p_item_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.cig_item_remaining(p_item_id) > 0 THEN
      (
        COALESCE((SELECT quantity * wholesale_price FROM public.cig_items WHERE id = p_item_id), 0)
        + COALESCE((
          SELECT SUM(quantity * wholesale_price)
          FROM public.cig_purchases WHERE item_id = p_item_id
        ), 0)
      ) / NULLIF(
        COALESCE((SELECT quantity FROM public.cig_items WHERE id = p_item_id), 0)
        + COALESCE((SELECT SUM(quantity) FROM public.cig_purchases WHERE item_id = p_item_id), 0),
        0
      )
    ELSE COALESCE((SELECT wholesale_price FROM public.cig_items WHERE id = p_item_id), 0)
  END
$$;

CREATE OR REPLACE FUNCTION public.cig_update_transfer(p_id uuid, p_quantity numeric, p_transfer_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_old_quantity numeric;
  v_remaining numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  SELECT item_id, quantity INTO v_item_id, v_old_quantity
  FROM public.cig_transfers WHERE id = p_id FOR UPDATE;
  IF v_item_id IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  v_remaining := public.cig_item_remaining(v_item_id) + v_old_quantity;
  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'الكمية المتاحة في المخزن (%) لا تكفي (%)', v_remaining, p_quantity;
  END IF;
  UPDATE public.cig_transfers
  SET quantity = p_quantity, transfer_date = COALESCE(p_transfer_date, transfer_date)
  WHERE id = p_id;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_update_item(
  p_item_id uuid, p_name text, p_quantity numeric, p_wholesale_price numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_remaining numeric;
  v_remaining_value numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF v_name = '' THEN RAISE EXCEPTION 'اكتب اسم الصنف'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN RAISE EXCEPTION 'الكمية غير صحيحة'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  IF p_wholesale_price IS NULL OR p_wholesale_price < 0 THEN RAISE EXCEPTION 'السعر غير صحيح'; END IF;
  IF EXISTS (SELECT 1 FROM public.cig_items WHERE lower(name) = lower(v_name) AND id <> p_item_id) THEN
    RAISE EXCEPTION 'يوجد صنف آخر بنفس الاسم';
  END IF;
  v_remaining := p_quantity
    + COALESCE((SELECT SUM(quantity) FROM public.cig_purchases WHERE item_id = p_item_id), 0)
    - COALESCE((SELECT SUM(quantity) FROM public.cig_transfers WHERE item_id = p_item_id), 0)
    - COALESCE((
      SELECT SUM(p.quantity)
      FROM public.purchases p
      JOIN public.products product ON product.id = p.product_id
        AND regexp_replace(lower(btrim(product.name)), '[[:space:]]+', ' ', 'g') =
          regexp_replace(lower(btrim(v_name)), '[[:space:]]+', ' ', 'g')
      WHERE p.supplier = 'الونش🏡'
    ), 0);
  IF v_remaining < 0 THEN
    RAISE EXCEPTION 'الكمية الأساسية الجديدة أقل من إجمالي مشتريات المحل';
  END IF;
  v_remaining_value := p_quantity * p_wholesale_price
    + COALESCE((
      SELECT SUM(quantity * wholesale_price) FROM public.cig_purchases WHERE item_id = p_item_id
    ), 0)
    - COALESCE((
      SELECT SUM(quantity * wholesale_price) FROM public.cig_transfers WHERE item_id = p_item_id
    ), 0);
  IF v_remaining_value < -0.005 THEN
    RAISE EXCEPTION 'تعديل السعر أو الكمية سيجعل قيمة المخزون المتبقي سالبة';
  END IF;
  UPDATE public.cig_items
  SET name = v_name, quantity = p_quantity, wholesale_price = p_wholesale_price
  WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الصنف غير موجود'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_delete_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  SELECT name INTO v_name FROM public.cig_items WHERE id = p_item_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'الصنف غير موجود'; END IF;
  IF EXISTS (SELECT 1 FROM public.cig_items WHERE id = p_item_id AND quantity > 0) THEN
    RAISE EXCEPTION 'لا يمكن حذف صنف له كمية في المخزن؛ عدل الكمية إلى صفر أولاً';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cig_transfers WHERE item_id = p_item_id)
    OR EXISTS (SELECT 1 FROM public.cig_purchases WHERE item_id = p_item_id)
    OR EXISTS (
      SELECT 1
      FROM public.purchases p
      JOIN public.products product ON product.id = p.product_id
        AND regexp_replace(lower(btrim(product.name)), '[[:space:]]+', ' ', 'g') =
          regexp_replace(lower(btrim(v_name)), '[[:space:]]+', ' ', 'g')
      WHERE p.supplier = 'الونش🏡'
    ) THEN
    RAISE EXCEPTION 'لا يمكن حذف صنف له عمليات شراء أو نقل سابقة';
  END IF;
  DELETE FROM public.cig_items WHERE id = p_item_id;
END
$$;
