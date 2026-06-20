import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { listProducts, listDailySales, listPurchases } from "@/lib/api";
import { EGP, NUM, monthRange, toISODate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Wallet, ShoppingBag, FileSpreadsheet, Printer } from "lucide-react";
import { exportToExcel, printElement } from "@/lib/export";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export const Route = createFileRoute("/monthly")({ component: MonthlyPage });

function MonthlyPage() {
  const now = new Date();
  const initial = monthRange(now.getFullYear(), now.getMonth());
  const [from, setFrom] = useState(initial.start);
  const [to, setTo] = useState(initial.end);

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const salesQ = useQuery({ queryKey: ["sales", from, to], queryFn: () => listDailySales(from, to) });
  const purchasesQ = useQuery({ queryKey: ["purchases", from, to], queryFn: () => listPurchases(from, to) });

  const products = productsQ.data ?? [];
  const sales = salesQ.data ?? [];
  const purchases = purchasesQ.data ?? [];

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Per-day series
  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();
    for (const s of sales) {
      const cur = map.get(s.sale_date) ?? { date: s.sale_date, revenue: 0, cost: 0, profit: 0 };
      const q = Number(s.quantity_sold);
      cur.revenue += q * Number(s.retail_price_snapshot);
      cur.cost += q * Number(s.wholesale_price_snapshot);
      cur.profit = cur.revenue - cur.cost;
      map.set(s.sale_date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  const byProduct = useMemo(() => {
    const agg = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
    for (const s of sales) {
      const p = productMap.get(s.product_id);
      if (!p) continue;
      const q = Number(s.quantity_sold);
      const cur = agg.get(p.id) ?? { name: p.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += q;
      cur.revenue += q * Number(s.retail_price_snapshot);
      cur.cost += q * Number(s.wholesale_price_snapshot);
      cur.profit = cur.revenue - cur.cost;
      agg.set(p.id, cur);
    }
    return Array.from(agg.values());
  }, [sales, productMap]);

  const totals = byProduct.reduce(
    (a, r) => ({ qty: a.qty + r.qty, revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit }),
    { qty: 0, revenue: 0, cost: 0, profit: 0 }
  );
  const totalIn = purchases.reduce((s, p) => s + Number(p.quantity), 0);

  const topSelling = [...byProduct].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topProfit = [...byProduct].sort((a, b) => b.profit - a.profit).slice(0, 5);

  function exportExcel() {
    exportToExcel(
      byProduct.map((r) => ({
        "الصنف": r.name,
        "الكمية المباعة": r.qty,
        "إجمالي القطاعي": r.revenue,
        "إجمالي الجملة": r.cost,
        "الربح": r.profit,
      })),
      `الجرد-الشهري-${from}_${to}`
    );
  }

  return (
    <AppShell title="الجرد الشهري">
      <div className="flex flex-wrap items-end gap-3 mb-5 no-print">
        <div>
          <label className="text-xs font-bold block mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">إلى تاريخ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </div>
        {[-1, 0].map((delta) => {
          const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
          const r = monthRange(d.getFullYear(), d.getMonth());
          return (
            <Button key={delta} variant="outline" size="sm" onClick={() => { setFrom(r.start); setTo(r.end); }}>
              {new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(d)}
            </Button>
          );
        })}
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-4 ms-1" />تصدير Excel</Button>
          <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("monthly-print"))}><Printer className="size-4 ms-1" />طباعة</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="إجمالي الوارد" value={NUM(totalIn)} hint="قطعة" icon={ShoppingBag} variant="info" />
        <StatCard label="إجمالي الصادر" value={NUM(totals.qty)} hint="قطعة" icon={TrendingDown} variant="warning" />
        <StatCard label="إجمالي المبيعات" value={EGP(totals.revenue)} icon={TrendingUp} variant="success" />
        <StatCard label="إجمالي الأرباح" value={EGP(totals.profit)} hint={`التكلفة: ${EGP(totals.cost)}`} icon={Wallet} variant="primary" />
      </div>

      <div id="monthly-print" className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3">المبيعات والأرباح اليومية</h3>
          {dailySeries.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات.</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: number) => EGP(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="المبيعات" stroke="var(--color-success)" strokeWidth={2} />
                <Line type="monotone" dataKey="cost" name="التكلفة" stroke="var(--color-info)" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="الربح" stroke="var(--color-warning)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <h3 className="font-bold mb-3">أكثر المنتجات مبيعاً</h3>
            {topSelling.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topSelling}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => NUM(v)} />
                  <Bar dataKey="qty" name="الكمية" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <h3 className="font-bold mb-3">أكثر المنتجات ربحاً</h3>
            {topProfit.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProfit}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => EGP(v)} />
                  <Bar dataKey="profit" name="الربح" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
