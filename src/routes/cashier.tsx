import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { ScanBarcode, Printer, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { EGP, NUM, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cashier")({
  head: () => ({
    meta: [
      { title: "الكاشير — الشوره ماركت" },
      { name: "description", content: "تقرير مبيعات الكاشير المسجلة من تطبيق الموبايل عبر مسح الباركود." },
      { property: "og:title", content: "الكاشير — الشوره ماركت" },
      { property: "og:description", content: "تقرير مبيعات الكاشير المسجلة من تطبيق الموبايل عبر مسح الباركود." },
    ],
  }),
  component: CashierPage,
});

type Sale = {
  id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  wholesale_price: number;
  retail_price: number;
  sale_date: string;
  created_at: string;
};

type CProduct = { id: string; name: string; barcode: string; quantity: number; wholesale_price: number; retail_price: number };

async function adjustStock(productId: string, delta: number) {
  const { data } = await supabase.from("cashier_products").select("quantity").eq("id", productId).maybeSingle();
  if (!data) return; // المنتج محذوف
  await supabase.from("cashier_products").update({ quantity: Number(data.quantity) + delta }).eq("id", productId);
}

function CashierPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const qc = useQueryClient();
  const [mDate, setMDate] = useState(todayISO());
  const [mProduct, setMProduct] = useState("");
  const [mQty, setMQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["cashier_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cashier_products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as CProduct[];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cashier_sales"] });
    qc.invalidateQueries({ queryKey: ["cashier_products"] });
  };

  async function addManualSale() {
    const p = products.find((x) => x.id === mProduct);
    const qty = Number(mQty);
    if (!p) return toast.error("اختر المنتج");
    if (!(qty > 0)) return toast.error("اكتب كمية صحيحة");
    if (Number(p.quantity) < qty) return toast.error(`الكمية المتاحة لا تكفي (المتاح ${NUM(Number(p.quantity))})`);
    setBusy(true);
    const { error } = await supabase.from("cashier_sales").insert({
      product_id: p.id, barcode: p.barcode, product_name: p.name, quantity: qty,
      wholesale_price: p.wholesale_price, retail_price: p.retail_price, sale_date: mDate,
    });
    if (!error) await adjustStock(p.id, -qty);
    setBusy(false);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success("تم تسجيل عملية البيع");
    setMQty("1");
    refresh();
  }

  async function editSale(s: Sale) {
    const q = window.prompt("الكمية الجديدة", String(s.quantity));
    if (q === null) return;
    const pr = window.prompt("سعر البيع", String(s.retail_price));
    if (pr === null) return;
    const qty = Number(q), price = Number(pr);
    if (!(qty > 0) || !(price >= 0)) return toast.error("اكتب أرقاماً صحيحة");
    const { error } = await supabase.from("cashier_sales").update({ quantity: qty, retail_price: price }).eq("id", s.id);
    if (error) return toast.error(error.message);
    await adjustStock(s.product_id, Number(s.quantity) - qty);
    toast.success("تم تعديل العملية");
    refresh();
  }

  async function deleteSale(s: Sale) {
    if (!window.confirm(`حذف عملية بيع "${s.product_name}"؟ ستُرجع الكمية للمخزون.`)) return;
    const { error } = await supabase.from("cashier_sales").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    await adjustStock(s.product_id, Number(s.quantity));
    toast.success("تم حذف العملية");
    refresh();
  }

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["cashier_sales", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashier_sales")
        .select("*")
        .gte("sale_date", from)
        .lte("sale_date", to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  let totalQty = 0, totalRetail = 0, totalWholesale = 0;
  for (const s of sales) {
    totalQty += Number(s.quantity);
    totalRetail += Number(s.quantity) * Number(s.retail_price);
    totalWholesale += Number(s.quantity) * Number(s.wholesale_price);
  }
  const totalProfit = totalRetail - totalWholesale;

  return (
    <AppShell title="الكاشير">
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">من تاريخ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">إلى تاريخ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <Button variant="outline" onClick={() => { setFrom(todayISO()); setTo(todayISO()); }}>اليوم</Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="عدد العمليات" value={NUM(sales.length)} icon={ScanBarcode} variant="info" />
          <StatCard label="إجمالي القطع المباعة" value={NUM(totalQty)} icon={ScanBarcode} variant="primary" />
          <StatCard label="إجمالي المبيعات" value={EGP(totalRetail)} icon={ScanBarcode} variant="success" />
          <StatCard label="إجمالي الأرباح" value={EGP(totalProfit)} icon={ScanBarcode} variant="warning" />
        </div>

        <div className="no-print rounded-xl border border-border bg-card shadow-card p-4">
          <div className="font-bold text-sm mb-3 flex items-center gap-2"><Plus className="size-4" /> إضافة بيع يدوياً</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">التاريخ</label>
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="min-w-56 flex-1">
              <label className="text-xs text-muted-foreground block mb-1">المنتج</label>
              <select value={mProduct} onChange={(e) => setMProduct(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— اختر المنتج —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {EGP(Number(p.retail_price))} (متاح {NUM(Number(p.quantity))})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">الكمية</label>
              <input type="number" min={1} value={mQty} onChange={(e) => setMQty(e.target.value)} className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <Button onClick={addManualSale} disabled={busy} className="gap-2"><Plus className="size-4" /> تسجيل البيع</Button>
          </div>
          {products.length === 0 && <p className="text-xs text-muted-foreground mt-2">لا توجد منتجات كاشير بعد — أضفها من تطبيق الموبايل.</p>}
        </div>

        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-bold text-sm">سجل مبيعات الكاشير</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-2 text-right font-medium">الوقت</th>
                  <th className="px-4 py-2 text-right font-medium">الصنف</th>
                  <th className="px-4 py-2 text-right font-medium">الباركود</th>
                  <th className="px-4 py-2 text-right font-medium">الكمية</th>
                  <th className="px-4 py-2 text-right font-medium">سعر البيع</th>
                  <th className="px-4 py-2 text-right font-medium">الإجمالي</th>
                  <th className="px-4 py-2 text-right font-medium">الربح</th>
                  <th className="px-4 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
                )}
                {!isLoading && sales.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">لا توجد مبيعات في هذه الفترة</td></tr>
                )}
                {sales.map((s) => {
                  const total = Number(s.quantity) * Number(s.retail_price);
                  const profit = Number(s.quantity) * (Number(s.retail_price) - Number(s.wholesale_price));
                  const time = new Date(s.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2">{s.sale_date}</td>
                      <td className="px-4 py-2">{time}</td>
                      <td className="px-4 py-2 font-medium">{s.product_name}</td>
                      <td className="px-4 py-2 font-mono text-xs" dir="ltr">{s.barcode ?? "—"}</td>
                      <td className="px-4 py-2">{NUM(Number(s.quantity))}</td>
                      <td className="px-4 py-2">{EGP(Number(s.retail_price))}</td>
                      <td className="px-4 py-2 font-bold">{EGP(total)}</td>
                      <td className="px-4 py-2 text-success font-bold">{EGP(profit)}</td>
                      <td className="px-4 py-2 no-print whitespace-nowrap">
                        <button onClick={() => editSale(s)} className="text-primary hover:opacity-70 me-2" aria-label="تعديل"><Pencil className="size-4" /></button>
                        <button onClick={() => deleteSale(s)} className="text-destructive hover:opacity-70" aria-label="حذف"><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {sales.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/50 font-bold">
                    <td className="px-4 py-2" colSpan={4}>الإجمالي</td>
                    <td className="px-4 py-2">{NUM(totalQty)}</td>
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2">{EGP(totalRetail)}</td>
                    <td className="px-4 py-2 text-success">{EGP(totalProfit)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
