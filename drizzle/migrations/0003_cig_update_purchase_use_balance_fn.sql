CREATE OR REPLACE FUNCTION public.cig_update_purchase(p_id uuid, p_quantity numeric, p_wholesale_price numeric, p_purchase_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bal numeric;
  v_val numeric;
  v_old numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'اكتب كمية أكبر من صفر'; END IF;
  IF p_wholesale_price IS NULL OR p_wholesale_price < 0 THEN RAISE EXCEPTION 'السعر غير صحيح'; END IF;
  v_val := p_quantity * p_wholesale_price;
  SELECT COALESCE(quantity, 0) * COALESCE(wholesale_price, 0) INTO v_old FROM public.cig_purchases WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  -- الرصيد المحدّث + قيمة العملية القديمة (لأنها ستُستبدل بالقيمة الجديدة)
  v_bal := public.cig_mardooda_balance() + v_old;
  IF v_val > v_bal + 0.005 THEN RAISE EXCEPTION 'رصيد فلوس مردودة غير كافٍ: الرصيد الحالي (%) والمطلوب (%)', v_bal, v_val; END IF;
  UPDATE public.cig_purchases SET quantity = p_quantity, wholesale_price = p_wholesale_price, purchase_date = COALESCE(p_purchase_date, purchase_date) WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
END
$function$;