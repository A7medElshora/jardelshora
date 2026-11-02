CREATE TABLE IF NOT EXISTS public.cig_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_capital numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cig_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wholesale_price numeric NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cig_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.cig_items(id),
  item_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  wholesale_price numeric NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  transfer_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cig_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.cig_items(id),
  item_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  wholesale_price numeric NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  purchase_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cig_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cig_transfers_item_idx ON public.cig_transfers(item_id);
CREATE INDEX IF NOT EXISTS cig_transfers_date_idx ON public.cig_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS cig_purchases_item_idx ON public.cig_purchases(item_id);
CREATE INDEX IF NOT EXISTS cig_purchases_date_idx ON public.cig_purchases(purchase_date);

INSERT INTO public.cig_settings (id, base_capital, start_date)
VALUES (1, 31400, '2026-10-15')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.cig_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cig_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cig_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cig_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cig_settlements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cig_settings', 'cig_items', 'cig_transfers', 'cig_purchases', 'cig_settlements'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || ' read access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
        table_name || ' read access',
        table_name
      );
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.cig_settings, public.cig_items, public.cig_transfers,
  public.cig_purchases, public.cig_settlements TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cig_settings, public.cig_items, public.cig_transfers,
  public.cig_purchases, public.cig_settlements FROM anon, authenticated;
GRANT ALL ON public.cig_settings, public.cig_items, public.cig_transfers,
  public.cig_purchases, public.cig_settlements TO service_role;

CREATE OR REPLACE FUNCTION public.cig_item_remaining(p_item_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT quantity FROM public.cig_items WHERE id = p_item_id), 0)
    + COALESCE((SELECT SUM(quantity) FROM public.cig_purchases WHERE item_id = p_item_id), 0)
    - COALESCE((SELECT SUM(quantity) FROM public.cig_transfers WHERE item_id = p_item_id), 0)
$$;

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
        - COALESCE((
          SELECT SUM(quantity * wholesale_price)
          FROM public.cig_transfers WHERE item_id = p_item_id
        ), 0)
      ) / public.cig_item_remaining(p_item_id)
    ELSE COALESCE((SELECT wholesale_price FROM public.cig_items WHERE id = p_item_id), 0)
  END
$$;

CREATE OR REPLACE FUNCTION public.cig_add_item(p_name text, p_quantity numeric, p_wholesale_price numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF v_name = '' THEN RAISE EXCEPTION 'اكتب اسم الصنف'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN RAISE EXCEPTION 'الكمية غير صحيحة'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  IF p_wholesale_price IS NULL OR p_wholesale_price < 0 THEN RAISE EXCEPTION 'السعر غير صحيح'; END IF;
  IF EXISTS (SELECT 1 FROM public.cig_items WHERE lower(name) = lower(v_name)) THEN
    RAISE EXCEPTION 'الصنف موجود بالفعل في المخزن - عدله بدل إضافة صنف جديد';
  END IF;
  INSERT INTO public.cig_items (name, quantity, wholesale_price)
  VALUES (v_name, p_quantity, p_wholesale_price)
  RETURNING id INTO v_id;
  RETURN v_id;
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
    - COALESCE((SELECT SUM(quantity) FROM public.cig_transfers WHERE item_id = p_item_id), 0);
  IF v_remaining < 0 THEN
    RAISE EXCEPTION 'الكمية الأساسية الجديدة أقل من الكمية التي تم نقلها للمحل';
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
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF EXISTS (SELECT 1 FROM public.cig_items WHERE id = p_item_id AND quantity > 0) THEN
    RAISE EXCEPTION 'لا يمكن حذف صنف له كمية في المخزن؛ عدل الكمية إلى صفر أولاً';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cig_transfers WHERE item_id = p_item_id)
    OR EXISTS (SELECT 1 FROM public.cig_purchases WHERE item_id = p_item_id) THEN
    RAISE EXCEPTION 'لا يمكن حذف صنف له عمليات نقل أو شراء سابقة';
  END IF;
  DELETE FROM public.cig_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الصنف غير موجود'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_transfer(p_item_id uuid, p_quantity numeric, p_transfer_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
  v_price numeric;
  v_remaining numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  SELECT name, public.cig_item_unit_cost(id) INTO v_name, v_price
  FROM public.cig_items WHERE id = p_item_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'الصنف غير موجود'; END IF;
  v_remaining := public.cig_item_remaining(p_item_id);
  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'الكمية المتاحة في المخزن (%) لا تكفي لنقل (%)', v_remaining, p_quantity;
  END IF;
  INSERT INTO public.cig_transfers (item_id, item_name, quantity, wholesale_price, transfer_date)
  VALUES (p_item_id, v_name, p_quantity, v_price, COALESCE(p_transfer_date, current_date));
END
$$;

CREATE OR REPLACE FUNCTION public.cig_update_transfer(p_id uuid, p_quantity numeric, p_transfer_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_remaining numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  SELECT item_id INTO v_item_id FROM public.cig_transfers WHERE id = p_id FOR UPDATE;
  IF v_item_id IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  v_remaining := COALESCE((SELECT quantity FROM public.cig_items WHERE id = v_item_id), 0)
    + COALESCE((SELECT SUM(quantity) FROM public.cig_purchases WHERE item_id = v_item_id), 0)
    - COALESCE((
      SELECT SUM(quantity) FROM public.cig_transfers
      WHERE item_id = v_item_id AND id <> p_id
    ), 0);
  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'الكمية المتاحة في المخزن (%) لا تكفي (%)', v_remaining, p_quantity;
  END IF;
  UPDATE public.cig_transfers
  SET quantity = p_quantity, transfer_date = COALESCE(p_transfer_date, transfer_date)
  WHERE id = p_id;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_delete_transfer(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_value numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  SELECT quantity * wholesale_price INTO v_value
  FROM public.cig_transfers WHERE id = p_id FOR UPDATE;
  IF v_value IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  IF public.cig_mardooda_balance() - v_value < -0.005 THEN
    RAISE EXCEPTION 'لا يمكن حذف النقل لأن رصيد فلوس مردودة سيصبح غير كافٍ';
  END IF;
  DELETE FROM public.cig_transfers WHERE id = p_id;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_purchase(
  p_item_id uuid, p_name text, p_quantity numeric, p_wholesale_price numeric, p_purchase_date date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item_id uuid := p_item_id;
  v_name text;
  v_balance numeric;
  v_value numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  IF p_wholesale_price IS NULL OR p_wholesale_price < 0 THEN RAISE EXCEPTION 'السعر غير صحيح'; END IF;
  v_value := p_quantity * p_wholesale_price;
  v_balance := public.cig_mardooda_balance();
  IF v_value > v_balance + 0.005 THEN
    RAISE EXCEPTION 'رصيد فلوس مردودة غير كافٍ: الرصيد الحالي (%) والمطلوب (%)', v_balance, v_value;
  END IF;
  IF v_item_id IS NOT NULL THEN
    SELECT name INTO v_name FROM public.cig_items WHERE id = v_item_id FOR UPDATE;
    IF v_name IS NULL THEN RAISE EXCEPTION 'الصنف غير موجود'; END IF;
  ELSE
    v_name := btrim(coalesce(p_name, ''));
    IF v_name = '' THEN RAISE EXCEPTION 'اكتب اسم الصنف'; END IF;
    SELECT id, name INTO v_item_id, v_name
    FROM public.cig_items WHERE lower(name) = lower(v_name) FOR UPDATE;
    IF v_item_id IS NULL THEN
      INSERT INTO public.cig_items (name, quantity, wholesale_price)
      VALUES (v_name, 0, p_wholesale_price)
      RETURNING id INTO v_item_id;
    END IF;
  END IF;
  INSERT INTO public.cig_purchases (item_id, item_name, quantity, wholesale_price, purchase_date)
  VALUES (v_item_id, v_name, p_quantity, p_wholesale_price, COALESCE(p_purchase_date, current_date));
END
$$;

CREATE OR REPLACE FUNCTION public.cig_update_purchase(
  p_id uuid, p_quantity numeric, p_wholesale_price numeric, p_purchase_date date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_old_quantity numeric;
  v_old_value numeric;
  v_balance numeric;
  v_value numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'الكمية يجب أن تكون رقماً صحيحاً'; END IF;
  IF p_wholesale_price IS NULL OR p_wholesale_price < 0 THEN RAISE EXCEPTION 'السعر غير صحيح'; END IF;
  SELECT item_id, quantity, quantity * wholesale_price
  INTO v_item_id, v_old_quantity, v_old_value
  FROM public.cig_purchases WHERE id = p_id FOR UPDATE;
  IF v_old_value IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  IF public.cig_item_remaining(v_item_id) - v_old_quantity + p_quantity < 0 THEN
    RAISE EXCEPTION 'لا يمكن تقليل الكمية لأن جزءاً من هذه المشتريات نُقل بالفعل للمحل';
  END IF;
  v_balance := public.cig_mardooda_balance() + v_old_value;
  v_value := p_quantity * p_wholesale_price;
  IF v_value > v_balance + 0.005 THEN
    RAISE EXCEPTION 'رصيد فلوس مردودة غير كافٍ: الرصيد الحالي (%) والمطلوب (%)', v_balance, v_value;
  END IF;
  UPDATE public.cig_purchases
  SET quantity = p_quantity,
      wholesale_price = p_wholesale_price,
      purchase_date = COALESCE(p_purchase_date, purchase_date)
  WHERE id = p_id;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_delete_purchase(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_quantity numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  SELECT item_id, quantity INTO v_item_id, v_quantity
  FROM public.cig_purchases WHERE id = p_id FOR UPDATE;
  IF v_item_id IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  IF public.cig_item_remaining(v_item_id) - v_quantity < 0 THEN
    RAISE EXCEPTION 'لا يمكن حذف المشتريات لأن جزءاً منها نُقل بالفعل للمحل';
  END IF;
  DELETE FROM public.cig_purchases WHERE id = p_id;
END
$$;

CREATE OR REPLACE FUNCTION public.cig_add_settlement(p_amount numeric, p_note text, p_settlement_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'اكتب مبلغاً أكبر من صفر'; END IF;
  v_balance := public.cig_mardooda_balance();
  IF p_amount > v_balance + 0.005 THEN
    RAISE EXCEPTION 'رصيد فلوس مردودة غير كافٍ: الرصيد الحالي (%) والمطلوب (%)', v_balance, p_amount;
  END IF;
  INSERT INTO public.cig_settlements (settlement_date, amount, note)
  VALUES (
    COALESCE(p_settlement_date, current_date),
    p_amount,
    nullif(btrim(coalesce(p_note, '')), '')
  );
END
$$;

CREATE OR REPLACE FUNCTION public.cig_delete_settlement(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cigarette_warehouse'));
  DELETE FROM public.cig_settlements WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.cig_item_remaining(uuid), public.cig_item_unit_cost(uuid),
  public.cig_mardooda_balance(),
  public.cig_add_item(text, numeric, numeric), public.cig_update_item(uuid, text, numeric, numeric),
  public.cig_delete_item(uuid), public.cig_transfer(uuid, numeric, date),
  public.cig_update_transfer(uuid, numeric, date), public.cig_delete_transfer(uuid),
  public.cig_purchase(uuid, text, numeric, numeric, date),
  public.cig_update_purchase(uuid, numeric, numeric, date), public.cig_delete_purchase(uuid),
  public.cig_add_settlement(numeric, text, date), public.cig_delete_settlement(uuid)
TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS cig_items_updated_at ON public.cig_items;
CREATE TRIGGER cig_items_updated_at BEFORE UPDATE ON public.cig_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
