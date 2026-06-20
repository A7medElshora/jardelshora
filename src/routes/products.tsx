import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, createProduct, updateProduct, deleteProduct, type Product } from "@/lib/api";
import { EGP, NUM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({ component: ProductsPage });

const empty = { name: "", quantity: "0", wholesale_price: "0", retail_price: "0", low_stock_threshold: "5" };

function ProductsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const products = q.data ?? [];
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);

  const filtered = products.filter((p) => p.name.includes(query.trim()));

  function openNew() {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      quantity: String(p.quantity),
      wholesale_price: String(p.wholesale_price),
      retail_price: String(p.retail_price),
      low_stock_threshold: String(p.low_stock_threshold),
    });
    setShowForm(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        quantity: Number(form.quantity),
        wholesale_price: Number(form.wholesale_price),
        retail_price: Number(form.retail_price),
        low_stock_threshold: Number(form.low_stock_threshold),
      };
      if (!payload.name) throw new Error("أدخل اسم الصنف");
      if (editing) return updateProduct(editing.id, payload);
      return createProduct(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث الصنف" : "تمت إضافة الصنف");
      qc.invalidateQueries({ queryKey: ["products"] });
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success("تم حذف الصنف");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  return (
    <AppShell title="الأصناف">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث عن صنف..." className="w-full h-10 rounded-lg border border-input bg-background px-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-white shadow-elevated"><Plus className="size-4 ms-1" />إضافة صنف</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-3 py-2.5 text-right">الصنف</th>
                <th className="px-3 py-2.5 text-right">الكمية</th>
                <th className="px-3 py-2.5 text-right">سعر الجملة</th>
                <th className="px-3 py-2.5 text-right">سعر القطاعي</th>
                <th className="px-3 py-2.5 text-right">هامش الربح</th>
                <th className="px-3 py-2.5 text-right">حد التنبيه</th>
                <th className="px-3 py-2.5 text-right">الحالة</th>
                <th className="px-3 py-2.5 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const out = Number(p.quantity) <= 0;
                const low = !out && Number(p.quantity) <= Number(p.low_stock_threshold);
                const margin = Number(p.retail_price) - Number(p.wholesale_price);
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-bold">{p.name}</td>
                    <td className="px-3 py-2">{NUM(Number(p.quantity))}</td>
                    <td className="px-3 py-2">{EGP(Number(p.wholesale_price))}</td>
                    <td className="px-3 py-2">{EGP(Number(p.retail_price))}</td>
                    <td className="px-3 py-2 font-bold text-success">{EGP(margin)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{NUM(Number(p.low_stock_threshold))}</td>
                    <td className="px-3 py-2">
                      {out ? <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-destructive text-destructive-foreground">نفد</span>
                        : low ? <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-warning text-warning-foreground inline-flex items-center gap-1"><AlertTriangle className="size-3" />منخفض</span>
                        : <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-success text-success-foreground">متوفر</span>}
                    </td>
                    <td className="px-3 py-2 text-left">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="تعديل"><Edit2 className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`حذف الصنف "${p.name}"؟ سيُحذف معه كل سجلاته.`)) del.mutate(p.id); }} aria-label="حذف"><Trash2 className="size-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">لا توجد أصناف{query ? " مطابقة للبحث" : ""}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-elevated space-y-3">
            <h3 className="font-bold text-lg">{editing ? "تعديل الصنف" : "إضافة صنف جديد"}</h3>
            <div>
              <label className="text-xs font-bold block mb-1">اسم الصنف</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">الكمية</label>
                <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">حد التنبيه</label>
                <input type="number" min="0" step="1" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">سعر الجملة</label>
                <input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">سعر القطاعي</label>
                <input type="number" min="0" step="0.01" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">إلغاء</Button>
              <Button type="submit" disabled={save.isPending} className="flex-1 bg-gradient-primary text-white">{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
