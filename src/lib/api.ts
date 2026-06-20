import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  name: string;
  quantity: number;
  wholesale_price: number;
  retail_price: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
};

export type Purchase = {
  id: string;
  purchase_date: string;
  product_id: string;
  quantity: number;
  wholesale_price: number;
  supplier: string | null;
  created_at: string;
};

export type DailySale = {
  id: string;
  sale_date: string;
  product_id: string;
  quantity_sold: number;
  wholesale_price_snapshot: number;
  retail_price_snapshot: number;
};

export type PriceHistory = {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};

/* Products */
export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function createProduct(p: {
  name: string;
  quantity: number;
  wholesale_price: number;
  retail_price: number;
  low_stock_threshold: number;
}) {
  const { data, error } = await supabase.from("products").insert(p).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* Purchases (المضاف) */
export async function listPurchases(from?: string, to?: string): Promise<Purchase[]> {
  let q = supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
  if (from) q = q.gte("purchase_date", from);
  if (to) q = q.lte("purchase_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Purchase[];
}

/**
 * Adds a purchase, updates product quantity, and recalculates Weighted Average Cost.
 * Returns { product, priceChanged }
 */
export async function addPurchase(input: {
  purchase_date: string;
  product_id: string;
  quantity: number;
  wholesale_price: number;
  supplier?: string | null;
}) {
  // 1. fetch existing product
  const { data: prod, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", input.product_id)
    .single();
  if (pErr) throw pErr;
  const p = prod as Product;

  const oldQty = Number(p.quantity);
  const oldPrice = Number(p.wholesale_price);
  const addQty = Number(input.quantity);
  const addPrice = Number(input.wholesale_price);

  const newQty = oldQty + addQty;
  // Weighted Average Cost — only when we have existing stock at a known price
  const weightedAvg =
    oldQty > 0 && oldPrice > 0
      ? (oldQty * oldPrice + addQty * addPrice) / (oldQty + addQty)
      : addPrice;
  const newPrice = Math.round(weightedAvg * 100) / 100;

  // 2. insert purchase
  const { error: insErr } = await supabase.from("purchases").insert({
    purchase_date: input.purchase_date,
    product_id: input.product_id,
    quantity: addQty,
    wholesale_price: addPrice,
    supplier: input.supplier ?? null,
  });
  if (insErr) throw insErr;

  // 3. update product
  const { error: updErr } = await supabase
    .from("products")
    .update({ quantity: newQty, wholesale_price: newPrice })
    .eq("id", p.id);
  if (updErr) throw updErr;

  // 4. log price change if changed
  const priceChanged = Math.abs(newPrice - oldPrice) > 0.001 && oldQty > 0;
  if (priceChanged) {
    await supabase.from("price_history").insert({
      product_id: p.id,
      old_price: oldPrice,
      new_price: newPrice,
      reason: "تم احتساب متوسط التكلفة المرجح بعد إضافة كمية جديدة بسعر مختلف.",
      changed_by: "admin",
    });
  }

  return { product: p, newPrice, oldPrice, priceChanged };
}

export async function deletePurchase(id: string) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}

/* Daily Sales */
export async function listDailySales(from: string, to: string): Promise<DailySale[]> {
  const { data, error } = await supabase
    .from("daily_sales")
    .select("*")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (error) throw error;
  return (data ?? []) as DailySale[];
}

/**
 * Upsert quantity_sold for a (product, date), and adjust product.quantity accordingly.
 * Snapshots current wholesale/retail.
 */
export async function setDailySale(input: {
  product_id: string;
  sale_date: string;
  quantity_sold: number;
}) {
  // get current sold qty if any
  const { data: existing } = await supabase
    .from("daily_sales")
    .select("*")
    .eq("product_id", input.product_id)
    .eq("sale_date", input.sale_date)
    .maybeSingle();

  const { data: prod, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", input.product_id)
    .single();
  if (pErr) throw pErr;
  const p = prod as Product;

  const prevSold = Number(existing?.quantity_sold ?? 0);
  const newSold = Math.max(0, Number(input.quantity_sold) || 0);
  const delta = newSold - prevSold; // positive = sell more, negative = revert
  const newStock = Number(p.quantity) - delta;
  if (newStock < 0) {
    throw new Error(`الكمية المتاحة في المخزون (${p.quantity}) لا تكفي.`);
  }

  // upsert
  if (existing) {
    const { error } = await supabase
      .from("daily_sales")
      .update({
        quantity_sold: newSold,
        wholesale_price_snapshot: p.wholesale_price,
        retail_price_snapshot: p.retail_price,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("daily_sales").insert({
      product_id: input.product_id,
      sale_date: input.sale_date,
      quantity_sold: newSold,
      wholesale_price_snapshot: p.wholesale_price,
      retail_price_snapshot: p.retail_price,
    });
    if (error) throw error;
  }

  // adjust stock
  if (delta !== 0) {
    const { error } = await supabase.from("products").update({ quantity: newStock }).eq("id", p.id);
    if (error) throw error;
  }
}

/* Price History */
export async function listPriceHistory(): Promise<PriceHistory[]> {
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as PriceHistory[];
}
