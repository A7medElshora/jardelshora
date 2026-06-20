import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listDailySales, setDailySale, type DailySale, type Product } from "@/lib/api";
import { EGP, NUM, WEEK_DAYS_AR, getWeekDates, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, printElement } from "@/lib/export";

export const Route = createFileRoute("/daily")({ component: DailyPage });

function DailyPage() {
  const [refDate, setRefDate] = useState<Date>(new Date());
  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);
  const from = weekDates[0];
  const to = weekDates[6];

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const salesQ = useQuery({ queryKey: ["sales", from, to], queryFn: () => listDailySales(from, to) });

  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: setDailySale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const products = productsQ.data ?? [];
  const sales = salesQ.data ?? [];

  // Build map: product_id -> date -> sale
  const salesMap = useMemo(() => {
    const m: Record<string, Record<string, DailySale>> = {};
    for (const s of sales) {
      (m[s.product_id] ??= {})[s.sale_date] = s;
    }
    return m;
  }, [sales]);

  function getSold(p: Product, date: string): number {
    return Number(salesMap[p.id]?.[date]?.quantity_sold ?? 0);
  }

  // Per-day totals across all products
  const dayTotals = weekDates.map((d) => {
    let revenue = 0, cost = 0, qty = 0;
    for (const p of products) {
      const s = salesMap[p.id]?.[d];
      if (!s) continue;
      const q = Number(s.quantity_sold);
      qty += q;
      revenue += q * Number(s.retail_price_snapshot);
      cost += q * Number(s.wholesale_price_snapshot);
    }
    return { date: d, qty, revenue, cost, profit: revenue - cost };
  });

  function shiftWeek(delta: number) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + delta * 7);
    setRefDate(d);
  }

  function exportExcel() {
    const rows = products.map((p) => {
      const row: Record<string, unknown> = {
        "الصنف": p.name,
        "الكمية المتاحة": Number(p.quantity),
        "سعر الجملة": Number(p.wholesale_price),
        "سعر القطاعي": Number(p.retail_price),
      };
      weekDates.forEach((d, i) => {
        row[WEEK_DAYS_AR[i]] = getSold(p, d);
      });
      return row;
    });
    exportToExcel(rows, `الجرد-اليومي-${from}_${to}`);
  }

  return (
    <AppShell title="الجرد اليومي">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 shadow-card">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} aria-label="الأسبوع السابق"><ChevronRight className="size-4" /></Button>
          <div className="px-3 text-sm font-bold">من {from} إلى {to}</div>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} aria-label="الأسبوع التالي"><ChevronLeft className="size-4" /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefDate(new Date())}>الأسبوع الحالي</Button>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-4 ms-1" /> تصدير Excel</Button>
          <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("daily-print"))}><Printer className="size-4 ms-1" /> طباعة</Button>
        </div>
      </div>

      {products.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
          لا توجد أصناف بعد. أضف أصنافاً من صفحة "الأصناف" أو "المضاف (الوارد)".
        </div>
      )}

      {products.length > 0 && (
        <div id="daily-print" className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-3 py-3 text-right whitespace-nowrap">#</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">الصنف</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">الكمية</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">سعر الجملة</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">سعر القطاعي</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap border-r border-border" colSpan={7}>المستهلك</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap border-r border-border">إجمالي القطاعي</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">إجمالي الجملة</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">الربح</th>
                </tr>
                <tr className="bg-secondary/60 text-xs">
                  <th colSpan={5}></th>
                  {WEEK_DAYS_AR.map((d, i) => (
                    <th key={d} className={`px-2 py-2 text-center whitespace-nowrap ${i === 0 ? "border-r border-border" : ""}`}>{d}</th>
                  ))}
                  <th colSpan={3} className="border-r border-border"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p, idx) => {
                  const out = Number(p.quantity) <= 0;
                  const low = !out && Number(p.quantity) <= Number(p.low_stock_threshold);
                  const dailySold = weekDates.map((d) => getSold(p, d));
                  const totalSold = dailySold.reduce((a, b) => a + b, 0);
                  const totalRetail = totalSold * Number(p.retail_price);
                  const totalWholesale = totalSold * Number(p.wholesale_price);
                  const profit = totalRetail - totalWholesale;
                  return (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2 font-bold">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {out && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">نفد</span>}
                          {low && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning text-warning-foreground flex items-center gap-1"><AlertTriangle className="size-3" />منخفض</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">{NUM(Number(p.quantity))}</td>
                      <td className="px-3 py-2">{EGP(Number(p.wholesale_price))}</td>
                      <td className="px-3 py-2">{EGP(Number(p.retail_price))}</td>
                      {weekDates.map((d, i) => (
                        <td key={d} className={`px-1 py-1 text-center ${i === 0 ? "border-r border-border" : ""}`}>
                          <input
                            type="number"
                            min={0}
                            defaultValue={getSold(p, d)}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v === getSold(p, d)) return;
                              mut.mutate({ product_id: p.id, sale_date: d, quantity_sold: v });
                            }}
                            className="w-16 h-9 rounded-md border border-input bg-background text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 font-bold text-success border-r border-border">{EGP(totalRetail)}</td>
                      <td className="px-3 py-2 font-bold text-info">{EGP(totalWholesale)}</td>
                      <td className="px-3 py-2 font-extrabold text-warning">{EGP(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-day total cards */}
      {products.length > 0 && (
        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
          {dayTotals.map((dt, i) => (
            <div key={dt.date} className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <div className="text-xs text-muted-foreground font-bold">{WEEK_DAYS_AR[i]}</div>
              <div className="text-[11px] text-muted-foreground mb-3">{dt.date}</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between rounded-md bg-gradient-success text-success-foreground px-2.5 py-1.5">
                  <span>قطاعي</span>
                  <span className="font-extrabold">{EGP(dt.revenue)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gradient-info text-info-foreground px-2.5 py-1.5">
                  <span>جملة</span>
                  <span className="font-extrabold">{EGP(dt.cost)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gradient-warning text-warning-foreground px-2.5 py-1.5">
                  <span>الربح</span>
                  <span className="font-extrabold">{EGP(dt.profit)}</span>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2 text-center">عدد القطع المباعة: {NUM(dt.qty)}</div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
