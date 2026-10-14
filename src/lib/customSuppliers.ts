export type CustomSupplier = {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  prices: Record<string, number>; // productId -> price
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "shora_custom_quotation_suppliers_v1";

export function getCustomSuppliers(): CustomSupplier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load custom quotation suppliers:", err);
    return [];
  }
}

export function saveCustomSupplier(data: {
  id?: string;
  name: string;
  phone?: string;
  notes?: string;
  prices: Record<string, number>;
}): CustomSupplier {
  const list = getCustomSuppliers();
  const now = new Date().toISOString();

  if (data.id) {
    const idx = list.findIndex((s) => s.id === data.id);
    if (idx >= 0) {
      const updated: CustomSupplier = {
        ...list[idx],
        name: data.name.trim(),
        phone: data.phone?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        prices: data.prices,
        updated_at: now,
      };
      list[idx] = updated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("custom-suppliers-updated"));
      return updated;
    }
  }

  const newSupplier: CustomSupplier = {
    id: data.id || `custom_sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name.trim(),
    phone: data.phone?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    prices: data.prices,
    created_at: now,
    updated_at: now,
  };

  list.unshift(newSupplier);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("custom-suppliers-updated"));
  return newSupplier;
}

export function deleteCustomSupplier(id: string): void {
  const list = getCustomSuppliers().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("custom-suppliers-updated"));
}

export function setSupplierProductPrice(supplierId: string, productId: string, price: number): void {
  const list = getCustomSuppliers();
  const target = list.find((s) => s.id === supplierId);
  if (!target) return;

  target.prices = {
    ...target.prices,
    [productId]: price,
  };
  target.updated_at = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("custom-suppliers-updated"));
}
