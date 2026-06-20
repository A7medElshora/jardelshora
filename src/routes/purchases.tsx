import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listPurchases, addPurchase, createProduct, deletePurchase } from "@/lib/api";
import { EGP, NUM, todayISO, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileSpreadsheet, Printer, Info } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, printElement } from "@/lib/export";

export const Route = createFileRoute("/purchases")({ component: PurchasesPage });

function PurchasesPage() {
  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const purchasesQ = useQuery({ queryKey: ["purchases-all"], queryFn: () => listPurchases() });
  const products = productsQ.data ?? [];
  const purchases = purchasesQ.data ?? [];
  const pmap = new Map(products.map((p) => [p.id, p]));

  const [form, setForm] = useState({
    purchase_date: todayISO(),
    product_id: "",
    new_product_name: "",
    quantity: "",
    wholesale_price: "",
    retail_price: "",
    supplier: "",
  });
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const mut = useMutation({
    mutationFn: async () => {
      let productId = form.product_id;
      if (mode === "new") {
        if (!form.new_product_name.trim()) throw new Error("أدخل اسم الصنف الجديد");
        const wp = Number(form.wholesale_price);
        const rp = Number(form.retail_price);
        const created = await createProduct({
          name: form.new_product_name.trim(),
          quantity: 0,
          wholesale_price: wp,
          retail_price: rp || wp,
          low_stock_threshold: 5,
        });
        productId = created.id;
      }
      if (!productId) throw new Error("اختر الصنف");
      const q = Number(form.quantity);
      const w = Number(form.wholesale_price);
      if (!(q > 0)) throw new Error("الكمية يجب أن تكون أكبر من صفر");
      if (!(w > 0)) throw new Error("سعر الجملة يجب أن يكون أكبر من صفر");
      return addPurchase({
        purchase_date: form.purchase_date,
        product_id: productId,
        quantity: q,
        wholesale_price: w,
        supplier: form.supplier || null,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["purchases-all"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      if (res.priceChanged) {
        toast.success(
          `تم تحديث السعر بعد المتوسط: ${EGP(res.oldPrice)} → ${EGP(res.newPrice)}`,
          { description: "تم احتساب متوسط التكلفة المرجح وحفظ التعديل في سجل الأسعار.", duration: 7000 }
        );
      } else {
        toast.success("تمت إضافة الوارد بنجاح");
      }
      setForm({ ...form, quantity: "", new_product_name: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      toast.success("تم حذف السجل");
      qc.invalidateQueries({ queryKey: ["purchases-all"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mut.mutate();
  }

  function exportExcel() {
    exportToExcel(
      purchases.map((p) => ({
        "التاريخ": p.purchase_date,
        "الصنف": pmap.get(p.product_id)?.name ?? "—",
        "العدد": Number(p.quantity),
        "سعر الجملة": Number(p.wholesale_price),
        "إجمالي الشراء": Number(p.quantity) * Number(p.wholesale_price),
        "جهة الشراء": p.supplier ?? "",
      })),
      `المضاف-${todayISO()}`
    );
  }

  return (
    <AppShell title="المضاف (الوارد)">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={onSubmit} className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-card space-y-3 no-print">
          <h3 className="font-bold mb-2">إضافة وارد جديد</h3>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("existing")} className={`flex-1 h-9 rounded-lg text-sm font-bold transition-colors ${mode === "existing" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>صنف موجود</button>
            <button type="button" onClick={() => setMode("new")} className={`flex-1 h-9 rounded-lg text-sm font-bold transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>صنف جديد</button>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">التاريخ</label>
            <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
          </div>

          {mode === "existing" ? (
            <div>
              <label className="text-xs font-bold block mb-1">الصنف</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required>
                <option value="">— اختر الصنف —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (المتاح: {NUM(Number(p.quantity))})</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold block mb-1">اسم الصنف الجديد</label>
                <input value={form.new_product_name} onChange={(e) => setForm({ ...form, new_product_name: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: كليوباترا" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">سعر القطاعي</label>
                <input type="number" step="0.01" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: 55" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">العدد</label>
              <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">سعر الجملة</label>
              <input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">جهة الشراء</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: شركة كليوباترا للدخان" />
          </div>

          <Button type="submit" disabled={mut.isPending} className="w-full h-11 bg-gradient-primary text-white shadow-elevated">
            <Plus className="size-4 ms-1" />
            {mut.isPending ? "جارٍ الحفظ..." : "إضافة"}
          </Button>

          <div className="text-[11px] text-muted-foreground flex items-start gap-2 pt-2 border-t border-border">
            <Info className="size-3.5 shrink-0 mt-0.5" />
            <span>عند اختلاف سعر الجملة الجديد عن القديم، يحسب النظام تلقائياً متوسط التكلفة المرجح ويحدّث السعر، مع حفظ التعديل في سجل الأسعار.</span>
          </div>
        </form>

        {/* Table */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2 no-print">
            <h3 className="font-bold">سجل الوارد</h3>
            <span className="text-xs text-muted-foreground">({purchases.length} سجل)</span>
            <div className="ms-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-4 ms-1" />Excel</Button>
              <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("purch-print"))}><Printer className="size-4 ms-1" />طباعة</Button>
            </div>
          </div>
          <div id="purch-print" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-right">التاريخ</th>
                  <th className="px-3 py-2.5 text-right">العدد</th>
                  <th className="px-3 py-2.5 text-right">الصنف</th>
                  <th className="px-3 py-2.5 text-right">سعر الجملة</th>
                  <th className="px-3 py-2.5 text-right">إجمالي الشراء</th>
                  <th className="px-3 py-2.5 text-right">جهة الشراء</th>
                  <th className="px-3 py-2.5 text-right no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap">{DATE_AR(p.purchase_date)}</td>
                    <td className="px-3 py-2 font-bold">{NUM(Number(p.quantity))}</td>
                    <td className="px-3 py-2">{pmap.get(p.product_id)?.name ?? "—"}</td>
                    <td className="px-3 py-2">{EGP(Number(p.wholesale_price))}</td>
                    <td className="px-3 py-2 font-bold">{EGP(Number(p.quantity) * Number(p.wholesale_price))}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.supplier ?? "—"}</td>
                    <td className="px-3 py-2 text-left no-print">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("هل تريد حذف هذا السجل؟")) delMut.mutate(p.id); }} aria-label="حذف">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">لا توجد سجلات وارد بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
