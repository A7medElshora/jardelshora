import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScanBarcode, Printer } from "lucide-react";
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
  product_name: string;
  barcode: string | null;
  quantity: number;
  wholesale_price: number;
  retail_price: number;
  sale_date: string;
  created_at: string;
};

function CashierPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

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
          <StatCard title="عدد العمليات" value={NUM(sales.length)} icon={ScanBarcode} variant="info" />
          <StatCard title="إجمالي القطع المباعة" value={NUM(totalQty)} icon={ScanBarcode} variant="primary" />
          <StatCard title="إجمالي المبيعات" value={EGP(totalRetail)} icon={ScanBarcode} variant="success" />
          <StatCard title="إجمالي الأرباح" value={EGP(totalProfit)} icon={ScanBarcode} variant="warning" />
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
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
                )}
                {!isLoading && sales.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">لا توجد مبيعات في هذه الفترة</td></tr>
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
