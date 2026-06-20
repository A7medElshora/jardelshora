import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { listProducts, listPurchases, listDailySales } from "@/lib/api";
import { EGP, NUM, monthRange, todayISO } from "@/lib/format";
import {
  Boxes,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  PackagePlus,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const today = new Date();
  const { start, end } = monthRange(today.getFullYear(), today.getMonth());

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const purchasesQ = useQuery({ queryKey: ["purchases", start, end], queryFn: () => listPurchases(start, end) });
  const salesQ = useQuery({ queryKey: ["sales", start, end], queryFn: () => listDailySales(start, end) });

  const products = productsQ.data ?? [];
  const purchases = purchasesQ.data ?? [];
  const sales = salesQ.data ?? [];

  const totalIn = purchases.reduce((s, p) => s + Number(p.quantity), 0);
  const totalOut = sales.reduce((s, p) => s + Number(p.quantity_sold), 0);
  const totalRevenue = sales.reduce((s, p) => s + Number(p.quantity_sold) * Number(p.retail_price_snapshot), 0);
  const totalCost = sales.reduce((s, p) => s + Number(p.quantity_sold) * Number(p.wholesale_price_snapshot), 0);
  const totalProfit = totalRevenue - totalCost;
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.low_stock_threshold));

  const tiles = [
    { to: "/daily", label: "الجرد اليومي", desc: "تسجيل المبيعات لكل يوم من أيام الأسبوع", icon: CalendarDays, variant: "primary" as const },
    { to: "/weekly", label: "الجرد الأسبوعي", desc: "إجماليات المبيعات والأرباح أسبوعياً", icon: CalendarRange, variant: "info" as const },
    { to: "/monthly", label: "الجرد الشهري", desc: "تقارير ومقارنات شهرية ورسوم بيانية", icon: CalendarCheck2, variant: "success" as const },
    { to: "/purchases", label: "المضاف (الوارد)", desc: "إضافة كميات جديدة مع متوسط التكلفة", icon: PackagePlus, variant: "warning" as const },
  ];

  return (
    <AppShell title="لوحة التحكم">
      <p className="text-sm text-muted-foreground mb-6">نظرة عامة على المخزون والمبيعات لشهر {new Intl.DateTimeFormat("ar-EG",{month:"long",year:"numeric"}).format(today)} — تاريخ اليوم: {new Intl.DateTimeFormat("ar-EG",{dateStyle:"full"}).format(new Date(todayISO()))}</p>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard label="إجمالي الأصناف" value={NUM(products.length)} icon={Boxes} variant="primary" hint="عدد الأصناف المسجلة" />
        <StatCard label="إجمالي الوارد (الشهر)" value={NUM(totalIn)} icon={TrendingDown} variant="info" hint="قطعة تم استلامها" />
        <StatCard label="إجمالي الصادر (الشهر)" value={NUM(totalOut)} icon={TrendingUp} variant="warning" hint="قطعة تم بيعها" />
        <StatCard label="إجمالي الأرباح (الشهر)" value={EGP(totalProfit)} icon={Wallet} variant="success" hint={`الإيرادات: ${EGP(totalRevenue)}`} />
        <StatCard label="أصناف قاربت على النفاد" value={NUM(lowStock.length)} icon={AlertTriangle} variant={lowStock.length ? "danger" : "primary"} hint={lowStock.length ? "تحتاج إعادة طلب" : "كل شيء على ما يرام"} />
      </div>

      {/* Main tiles */}
      <h2 className="text-base font-bold mb-3">الأقسام الرئيسية</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {tiles.map((t) => {
          const Icon = t.icon;
          const bg = {
            primary: "bg-gradient-primary",
            info: "bg-gradient-info",
            success: "bg-gradient-success",
            warning: "bg-gradient-warning",
          }[t.variant];
          return (
            <Link
              key={t.to}
              to={t.to as never}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elevated transition-all hover:-translate-y-0.5"
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${bg}`} />
              <div className={`size-12 rounded-xl ${bg} text-white grid place-items-center shadow-card`}>
                <Icon className="size-6" />
              </div>
              <div className="mt-4 font-bold text-lg">{t.label}</div>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-sm font-bold text-primary">
                <span>الدخول</span>
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Low stock list */}
      {lowStock.length > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <h3 className="font-bold">تنبيهات المخزون</h3>
          </div>
          <div className="divide-y divide-border">
            {lowStock.map((p) => {
              const out = Number(p.quantity) <= 0;
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      الكمية المتاحة: {NUM(Number(p.quantity))} — الحد الأدنى: {NUM(Number(p.low_stock_threshold))}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${out ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                    {out ? "نفد من المخزون" : "أوشك على النفاد"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
