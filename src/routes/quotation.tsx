import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listPurchases } from "@/lib/api";
import { EGP, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/quotation")({
  head: () => ({
    meta: [
      { title: "بيان أسعار — الشوره ماركت" },
      { name: "description", content: "بيان أسعار الأصناف حسب آخر سعر شراء لدى كل مورد." },
      { property: "og:title", content: "بيان أسعار — الشوره ماركت" },
      { property: "og:description", content: "احسب إجمالي طلبية المورد حسب آخر أسعاره." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotationPage,
});

function QuotationPage() {
  const purQ = useQuery({ queryKey: ["purchases-all"], queryFn: () => listPurchases() });
  const prodQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const [supplier, setSupplier] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});

  const suppliers = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of purQ.data ?? []) {
      const s = p.supplier?.trim();
      if (!s) continue;
      const key = p.purchase_date + p.created_at;
      if (!m.has(s) || key > m.get(s)!) m.set(s, key);
    }
    return Array.from(m.entries())
      .map(([name, k]) => ({ name, last: k.slice(0, 10) }))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [purQ.data]);

  const items = useMemo(() => {
    if (!supplier) return [];
    const latest = new Map<string, { price: number; key: string }>();
    for (const p of purQ.data ?? []) {
      if (p.supplier?.trim() !== supplier) continue;
      const key = p.purchase_date + p.created_at;
      const cur = latest.get(p.product_id);
      if (!cur || key > cur.key) latest.set(p.product_id, { price: Number(p.wholesale_price), key });
    }
    // كل الأصناف الموجودة — سعر المورد إن وُجد، وإلا سعر الجملة الحالي
    return (prodQ.data ?? [])
      .map((p) => {
        const sup = latest.get(p.id);
        return {
          id: p.id,
          name: p.name,
          price: sup ? sup.price : Number(p.wholesale_price),
          fromSupplier: !!sup,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [supplier, purQ.data, prodQ.data]);

  const total = items.reduce((s, i) => s + (Number(qty[i.id]) || 0) * i.price, 0);

  return (
    <AppShell title="بيان أسعار">
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card flex flex-wrap items-end gap-3 no-print">
          <label className="flex-1 min-w-64">
            <span className="block text-sm font-bold mb-1">المورد</span>
            <select
              value={supplier}
              onChange={(e) => { setSupplier(e.target.value); setQty({}); }}
              className="w-full h-10 rounded-lg border border-input bg-background px-3"
            >
              <option value="">— اختر المورد —</option>
              {suppliers.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} (آخر عملية شراء {DATE_AR(s.last)})
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => setQty({})}><RotateCcw className="size-4" />تصفير الكميات</Button>
          <Button onClick={() => window.print()}><Printer className="size-4" />طباعة</Button>
        </div>

        {!supplier ? (
          <p className="text-center text-muted-foreground py-12">
            {suppliers.length ? "اختر مورداً لعرض أصنافه وأسعاره." : "لا يوجد موردون مسجلون في المضاف بعد."}
          </p>
        ) : (
          <>
            <h2 className="text-lg font-bold">بيان أسعار: {supplier}</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((i) => {
                const line = (Number(qty[i.id]) || 0) * i.price;
                return (
                  <div key={i.id} className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3">
                    <div className="font-bold">{i.name}</div>
                    <div className="text-sm text-muted-foreground">السعر: <span className="text-foreground font-semibold">{EGP(i.price)}</span></div>
                    <input
                      type="number" min={0} inputMode="decimal" placeholder="الكمية"
                      value={qty[i.id] ?? ""}
                      onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3"
                    />
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm flex justify-between">
                      <span>الإجمالي</span><span className="font-bold">{EGP(line)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl bg-gradient-primary text-primary-foreground p-6 shadow-elevated flex items-center justify-between">
              <span className="text-lg font-bold">إجمالي بيان الأسعار</span>
              <span className="text-2xl font-extrabold">{EGP(total)}</span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
