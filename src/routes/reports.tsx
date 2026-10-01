import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listDailySales, listPurchases } from "@/lib/api";
import { EGP, NUM, monthRange, todayISO, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Printer, CalendarDays, CalendarRange, CalendarCheck2, PackagePlus, Wallet } from "lucide-react";
import { exportToExcel, exportToPDF, printElement } from "@/lib/export";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportKey = "daily" | "weekly" | "monthly" | "purchases" | "profit";

function ReportsPage() {
  const now = new Date();
  const m = monthRange(now.getFullYear(), now.getMonth());
  const [from, setFrom] = useState(m.start);
  const [to, setTo] = useState(m.end);
  const [type, setType] = useState<ReportKey>("monthly");

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const salesQ = useQuery({ queryKey: ["sales", from, to], queryFn: () => listDailySales(from, to) });
  const purchasesQ = useQuery({ queryKey: ["purchases", from, to], queryFn: () => listPurchases(from, to) });

  const products = productsQ.data ?? [];
  const sales = salesQ.data ?? [];
  const purchases = purchasesQ.data ?? [];
  const pmap = new Map(products.map((p) => [p.id, p]));

  // Aggregates
  const agg = aggregateByProduct(sales, pmap);
  const salesTotals = sales.reduce(
    (acc, s) => {
      const q = Number(s.quantity_sold);
      acc.qty += q;
      acc.revenue += q * Number(s.retail_price_snapshot);
      acc.cost += q * Number(s.wholesale_price_snapshot);
      return acc;
    },
    { qty: 0, revenue: 0, cost: 0 }
  );
  const salesProfit = salesTotals.revenue - salesTotals.cost;
  const purchTotals = purchases.reduce(
    (acc, p) => {
      acc.qty += Number(p.quantity);
      acc.total += Number(p.quantity) * Number(p.wholesale_price);
      return acc;
    },
    { qty: 0, total: 0 }
  );

  // Build rows per type
  const tables: Record<ReportKey, { title: string; headers: string[]; rows: (string | number)[][]; totals: (string | number)[] }> = {
    daily: {
      title: "تقرير الجرد اليومي",
      headers: ["التاريخ", "الصنف", "الكمية المباعة", "سعر الجملة", "سعر القطاعي", "الإجمالي", "الربح"],
      rows: sales.map((s) => {
        const p = pmap.get(s.product_id);
        const q = Number(s.quantity_sold);
        const rev = q * Number(s.retail_price_snapshot);
        const cost = q * Number(s.wholesale_price_snapshot);
        return [DATE_AR(s.sale_date), p?.name ?? "—", NUM(q), EGP(Number(s.wholesale_price_snapshot)), EGP(Number(s.retail_price_snapshot)), EGP(rev), EGP(rev - cost)];
      }),
    },
    weekly: {
      title: "تقرير الجرد الأسبوعي",
      headers: ["الصنف", "الكمية المباعة", "إجمالي القطاعي", "إجمالي الجملة", "الربح"],
      rows: aggregateByProduct(sales, pmap).map((r) => [r.name, NUM(r.qty), EGP(r.revenue), EGP(r.cost), EGP(r.profit)]),
    },
    monthly: {
      title: "تقرير الجرد الشهري",
      headers: ["الصنف", "الكمية المباعة", "إجمالي القطاعي", "إجمالي الجملة", "الربح"],
      rows: aggregateByProduct(sales, pmap).map((r) => [r.name, NUM(r.qty), EGP(r.revenue), EGP(r.cost), EGP(r.profit)]),
    },
    purchases: {
      title: "تقرير الوارد",
      headers: ["التاريخ", "الصنف", "العدد", "سعر الجملة", "الإجمالي", "جهة الشراء"],
      rows: purchases.map((p) => [
        DATE_AR(p.purchase_date),
        pmap.get(p.product_id)?.name ?? "—",
        NUM(Number(p.quantity)),
        EGP(Number(p.wholesale_price)),
        EGP(Number(p.quantity) * Number(p.wholesale_price)),
        p.supplier ?? "—",
      ]),
    },
    profit: {
      title: "تقرير الأرباح",
      headers: ["الصنف", "إجمالي القطاعي", "إجمالي الجملة", "الربح", "هامش الربح %"],
      rows: aggregateByProduct(sales, pmap).map((r) => [
        r.name, EGP(r.revenue), EGP(r.cost), EGP(r.profit),
        r.revenue > 0 ? `${((r.profit / r.revenue) * 100).toFixed(1)}%` : "—",
      ]),
    },
  };

  const current = tables[type];

  function doExcel() {
    const rows = current.rows.map((r) => Object.fromEntries(r.map((cell, i) => [current.headers[i], cell])));
    exportToExcel(rows, `${current.title}-${from}_${to}`);
  }
  function doPDF() {
    exportToPDF({ title: current.title, headers: current.headers, rows: current.rows, filename: `${current.title}-${from}_${to}` });
  }

  const cards: { key: ReportKey; label: string; icon: typeof CalendarDays; variant: string }[] = [
    { key: "daily", label: "الجرد اليومي", icon: CalendarDays, variant: "bg-gradient-primary" },
    { key: "weekly", label: "الجرد الأسبوعي", icon: CalendarRange, variant: "bg-gradient-info" },
    { key: "monthly", label: "الجرد الشهري", icon: CalendarCheck2, variant: "bg-gradient-success" },
    { key: "purchases", label: "الوارد", icon: PackagePlus, variant: "bg-gradient-warning" },
    { key: "profit", label: "الأرباح", icon: Wallet, variant: "bg-gradient-danger" },
  ];

  return (
    <AppShell title="التقارير">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-5">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = type === c.key;
          return (
            <button key={c.key} onClick={() => setType(c.key)} className={`text-right p-4 rounded-2xl border transition-all ${active ? "border-primary shadow-elevated bg-card" : "border-border bg-card hover:shadow-card"}`}>
              <div className={`size-10 rounded-xl ${c.variant} text-white grid place-items-center shadow-card mb-2`}><Icon className="size-5" /></div>
              <div className="font-bold text-sm">{c.label}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-end gap-3 no-print">
          <div>
            <label className="text-xs font-bold block mb-1">من تاريخ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">إلى تاريخ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="size-4 ms-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={doPDF}><FileText className="size-4 ms-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("rpt-print"))}><Printer className="size-4 ms-1" />طباعة</Button>
          </div>
        </div>

        <div id="rpt-print" className="overflow-x-auto">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-bold text-lg">{current.title}</h2>
            <div className="text-xs text-muted-foreground">الفترة: من {DATE_AR(from)} إلى {DATE_AR(to)}</div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>{current.headers.map((h) => <th key={h} className="px-3 py-2.5 text-right">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {current.rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
                </tr>
              ))}
              {current.rows.length === 0 && (
                <tr><td colSpan={current.headers.length} className="px-3 py-10 text-center text-muted-foreground">لا توجد بيانات لهذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function aggregateByProduct(sales: { product_id: string; quantity_sold: number; retail_price_snapshot: number; wholesale_price_snapshot: number }[], pmap: Map<string, { name: string }>) {
  const agg = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
  for (const s of sales) {
    const p = pmap.get(s.product_id);
    if (!p) continue;
    const q = Number(s.quantity_sold);
    const cur = agg.get(s.product_id) ?? { name: p.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
    cur.qty += q;
    cur.revenue += q * Number(s.retail_price_snapshot);
    cur.cost += q * Number(s.wholesale_price_snapshot);
    cur.profit = cur.revenue - cur.cost;
    agg.set(s.product_id, cur);
  }
  return Array.from(agg.values()).sort((a, b) => b.qty - a.qty);
}
