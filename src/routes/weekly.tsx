import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listDailySales, listPurchases } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { EGP, NUM, getWeekDates } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Wallet, ShoppingBag, FileSpreadsheet, Printer } from "lucide-react";
import { exportToExcel, printElement } from "@/lib/export";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/weekly")({ component: WeeklyPage });

function WeeklyPage() {
  const [from, setFrom] = useState(() => getWeekDates(new Date())[0]);
  const [to, setTo] = useState(() => getWeekDates(new Date())[6]);

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const salesQ = useQuery({ queryKey: ["sales", from, to], queryFn: () => listDailySales(from, to) });
  const purchasesQ = useQuery({ queryKey: ["purchases", from, to], queryFn: () => listPurchases(from, to) });

  const products = productsQ.data ?? [];
  const sales = salesQ.data ?? [];
  const purchases = purchasesQ.data ?? [];

  const byProduct = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p]));
    const agg = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
    for (const s of sales) {
      const p = m.get(s.product_id);
      if (!p) continue;
      const q = Number(s.quantity_sold);
      const rev = q * Number(s.retail_price_snapshot);
      const cost = q * Number(s.wholesale_price_snapshot);
      const cur = agg.get(p.id) ?? { name: p.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += q; cur.revenue += rev; cur.cost += cost; cur.profit += rev - cost;
      agg.set(p.id, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.qty - a.qty);
  }, [products, sales]);

  const totals = byProduct.reduce(
    (acc, r) => ({ qty: acc.qty + r.qty, revenue: acc.revenue + r.revenue, cost: acc.cost + r.cost, profit: acc.profit + r.profit }),
    { qty: 0, revenue: 0, cost: 0, profit: 0 }
  );
  const totalIn = purchases.reduce((s, p) => s + Number(p.quantity), 0);

  const top5 = byProduct.slice(0, 5);
  const bottom5 = [...byProduct].sort((a, b) => a.qty - b.qty).slice(0, 5);

  function exportExcel() {
    exportToExcel(
      byProduct.map((r) => ({
        "الصنف": r.name,
        "الكمية المباعة": r.qty,
        "إجمالي القطاعي": r.revenue,
        "إجمالي الجملة": r.cost,
        "الربح": r.profit,
      })),
      `الجرد-الأسبوعي-${from}_${to}`
    );
  }

  return (
    <AppShell title="الجرد الأسبوعي">
      <div className="flex flex-wrap items-end gap-3 mb-5 no-print">
        <div>
          <label className="text-xs font-bold block mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">إلى تاريخ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </div>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-4 ms-1" />تصدير Excel</Button>
          <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("weekly-print"))}><Printer className="size-4 ms-1" />طباعة</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="إجمالي المبيعات" value={EGP(totals.revenue)} hint={`${NUM(totals.qty)} قطعة`} icon={TrendingUp} variant="success" />
        <StatCard label="إجمالي الوارد" value={NUM(totalIn)} hint="قطعة" icon={ShoppingBag} variant="info" />
        <StatCard label="إجمالي الصادر" value={NUM(totals.qty)} hint="قطعة" icon={TrendingDown} variant="warning" />
        <StatCard label="إجمالي الأرباح" value={EGP(totals.profit)} hint={`التكلفة: ${EGP(totals.cost)}`} icon={Wallet} variant="primary" />
      </div>

      <div id="weekly-print" className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3">أكثر 5 أصناف مبيعاً</h3>
          {top5.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top5} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(v: number) => NUM(v)} />
                <Bar dataKey="qty" fill="var(--color-success)" name="الكمية" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3">أقل 5 أصناف مبيعاً</h3>
          {bottom5.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bottom5} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(v: number) => NUM(v)} />
                <Bar dataKey="qty" fill="var(--color-warning)" name="الكمية" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 border-b border-border font-bold">الأرباح حسب الصنف</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-right">الصنف</th>
                  <th className="px-3 py-2.5 text-right">الكمية المباعة</th>
                  <th className="px-3 py-2.5 text-right">إجمالي القطاعي</th>
                  <th className="px-3 py-2.5 text-right">إجمالي الجملة</th>
                  <th className="px-3 py-2.5 text-right">الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byProduct.map((r) => (
                  <tr key={r.name} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-bold">{r.name}</td>
                    <td className="px-3 py-2">{NUM(r.qty)}</td>
                    <td className="px-3 py-2 text-success font-bold">{EGP(r.revenue)}</td>
                    <td className="px-3 py-2 text-info">{EGP(r.cost)}</td>
                    <td className="px-3 py-2 text-warning font-extrabold">{EGP(r.profit)}</td>
                  </tr>
                ))}
                {byProduct.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">لا توجد مبيعات في هذه الفترة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
