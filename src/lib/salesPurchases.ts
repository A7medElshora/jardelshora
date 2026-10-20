import { supabase } from "@/integrations/supabase/client";

export type UnitType = "carton" | "pallet" | "box" | "custom";

export const UNIT_LABELS: Record<UnitType, string> = {
  carton: "كرتونة",
  pallet: "بلتة",
  box: "علبة",
  custom: "وحدة أخرى",
};

export type SalesPurchaseItem = {
  id: string;
  name: string; // اسم الصنف
  unitType: UnitType; // كرتونة / بلتة / علبة
  unitLabel?: string; // في حال كانت مخصصة
  packageCount: number; // عدد الكراتين أو البلتات
  itemsPerPackage: number; // عدد القطع داخل الكرتونة أو البلتة
  packageWholesalePrice: number; // سعر شراء الكرتونة / البلتة بالجملة
  pieceRetailPrice: number; // سعر بيع القطعة المفردة بالقطاعي
  displayedPieces?: number; // المعروض في المحل (المرصوص على الرف)
  soldPieces?: number; // ما تم بيعه فعلياً (من المرصوص)
};

export type SalesPurchaseInvoice = {
  id: string;
  invoice_number?: string;
  invoice_date: string; // YYYY-MM-DD
  supplier_name: string; // اسم التاجر / المورد
  notes?: string;
  paid_amount: number; // المبلغ الذي تم دفعه
  total_amount: number; // المبلغ الكلي للفاتورة
  items: SalesPurchaseItem[];
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "shora_sales_purchases_invoices_v1";

// Cache flag for whether Supabase table exists
let isCloudConnected = false;

export function getIsCloudConnected() {
  return isCloudConnected;
}

export function getSalesPurchaseInvoices(): SalesPurchaseInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load sales purchase invoices:", err);
    return [];
  }
}

// Fetch invoices from Supabase Cloud (with automatic localStorage fallback & sync)
export async function fetchSalesPurchaseInvoicesCloud(): Promise<{
  data: SalesPurchaseInvoice[];
  isCloud: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("sales_purchase_invoices" as any)
      .select("*")
      .order("invoice_date", { ascending: false });

    if (error) {
      isCloudConnected = false;
      return { data: getSalesPurchaseInvoices(), isCloud: false };
    }

    if (Array.isArray(data)) {
      isCloudConnected = true;
      const parsed: SalesPurchaseInvoice[] = data.map((row: any) => ({
        id: String(row.id),
        invoice_number: row.invoice_number || undefined,
        invoice_date: row.invoice_date,
        supplier_name: row.supplier_name,
        notes: row.notes || undefined,
        paid_amount: Number(row.paid_amount) || 0,
        total_amount: Number(row.total_amount) || 0,
        items: Array.isArray(row.items) ? row.items : [],
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      // Cache locally for instant offline/fast load
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return { data: parsed, isCloud: true };
    }
  } catch (err) {
    console.warn("Could not query Supabase sales_purchase_invoices:", err);
  }

  isCloudConnected = false;
  return { data: getSalesPurchaseInvoices(), isCloud: false };
}

export function saveSalesPurchaseInvoice(
  invoice: Omit<SalesPurchaseInvoice, "id" | "created_at" | "updated_at"> & { id?: string }
): SalesPurchaseInvoice {
  const list = getSalesPurchaseInvoices();
  const now = new Date().toISOString();

  let target: SalesPurchaseInvoice;

  if (invoice.id) {
    const idx = list.findIndex((x) => x.id === invoice.id);
    if (idx >= 0) {
      target = {
        ...list[idx],
        ...invoice,
        id: invoice.id,
        updated_at: now,
      };
      list[idx] = target;
    } else {
      target = {
        ...invoice,
        id: invoice.id,
        created_at: now,
        updated_at: now,
      };
      list.unshift(target);
    }
  } else {
    target = {
      ...invoice,
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      updated_at: now,
    };
    list.unshift(target);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("sales-purchases-updated"));

  // Fire-and-forget sync to Supabase Cloud
  syncInvoiceToSupabase(target);

  return target;
}

export function updateItemTracking(
  invoiceId: string,
  itemId: string,
  displayedPieces: number,
  soldPieces: number
): SalesPurchaseInvoice | null {
  const list = getSalesPurchaseInvoices();
  const idx = list.findIndex((x) => x.id === invoiceId);
  if (idx < 0) return null;

  const inv = list[idx];
  const itemIdx = inv.items.findIndex((it) => it.id === itemId);
  if (itemIdx < 0) return null;

  const it = inv.items[itemIdx];
  const totalPieces = it.packageCount * it.itemsPerPackage;
  const clampedDisplayed = Math.max(0, Math.min(totalPieces, displayedPieces));
  const clampedSold = Math.max(0, Math.min(clampedDisplayed, soldPieces));

  inv.items[itemIdx] = {
    ...it,
    displayedPieces: clampedDisplayed,
    soldPieces: clampedSold,
  };
  inv.updated_at = new Date().toISOString();

  list[idx] = inv;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("sales-purchases-updated"));

  // Sync to Supabase Cloud
  syncInvoiceToSupabase(inv);

  return inv;
}

export function deleteSalesPurchaseInvoice(id: string): void {
  const list = getSalesPurchaseInvoices().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("sales-purchases-updated"));

  // Sync delete to Supabase Cloud
  try {
    supabase.from("sales_purchase_invoices" as any).delete().eq("id", id).then();
  } catch (err) {
    console.warn("Cloud delete notice:", err);
  }
}

// Background sync helper
async function syncInvoiceToSupabase(inv: SalesPurchaseInvoice) {
  try {
    const { error } = await supabase.from("sales_purchase_invoices" as any).upsert({
      id: inv.id,
      invoice_number: inv.invoice_number || null,
      invoice_date: inv.invoice_date,
      supplier_name: inv.supplier_name,
      notes: inv.notes || null,
      paid_amount: inv.paid_amount,
      total_amount: inv.total_amount,
      items: inv.items,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
    });
    if (error) {
      console.warn("Notice syncing invoice to Supabase:", error.message);
    } else {
      isCloudConnected = true;
    }
  } catch (err) {
    console.warn("Supabase sync exception:", err);
  }
}
