import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { listProducts, listPurchases, listDailySales } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { EGP, NUM, monthRange, todayISO } from "@/lib/format";
import {
  Boxes,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CalendarDays,
  PackagePlus,
  Receipt,
  ArrowLeft,
  ScanBarcode,
  Layers,
  FileBarChart2,
  History,
  ShoppingBag,
  Search,
  Sparkles,
  BarChart3,
  Award,
  CheckCircle2,
  Coins,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — الشوره ماركت" },
      { name: "description", content: "نظام إدارة المخزون والجرد المتكامل لمتجر الشوره ماركت." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const today = new Date();
  const currentIso = todayISO();
  const { start, end } = monthRange(today.getFullYear(), today.getMonth());

  const [chartMode, setChartMode] = useState<"finance" | "volume">("finance");
  const [stockFilter, setStockFilter] = useState<"all" | "out" | "low">("all");
  const [stockSearch, setStockSearch] = useState("");

  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const purchasesQ = useQuery({
    queryKey: ["purchases", start, end],
    queryFn: () => listPurchases(start, end),
  });
  const salesQ = useQuery({
    queryKey: ["sales", start, end],
    queryFn: () => listDailySales(start, end),
  });

  // Profits queries (متطابق مع صفحة الأرباح)
  const profitWithdrawalsQ = useQuery({
    queryKey: ["profit-withdrawals", start, end],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profit_withdrawals")
        .select("*")
        .gte("profit_date", start)
        .lte("profit_date", end);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; profit_date: string; taken_amount: number }>;
    },
  });

  const profitExpensesQ = useQuery({
    queryKey: ["profit-expenses", start, end],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profit_expenses")
        .select("*")
        .gte("expense_date", start)
        .lte("expense_date", end);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; expense_date: string; amount: number; reason: string | null }>;
    },
  });

  // Taqseemat queries (متطابق مع صفحة التقسيمات لحساب "المتاح فى المحل")
  const manualSalesQ = useQuery({
    queryKey: ["manual-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manual_sales").select("*");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; sale_date: string; amount: number }>;
    },
  });

  const cigSalesQ = useQuery({
    queryKey: ["taqseemat-cig"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cigarette_sales").select("id, sale_date, retail_total");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; sale_date: string; retail_total: number }>;
    },
  });

  const taqseematWithdrawalsQ = useQuery({
    queryKey: ["taqseemat-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taqseemat_withdrawals").select("*");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; entry_date: string; kind: "cigarettes" | "sales"; amount: number }>;
    },
  });

  const taqseematProfitsQ = useQuery({
    queryKey: ["taqseemat-profits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("taqseemat_profits").select("id, profit_date, amount");
      if (error) throw error;
      return ((data ?? []) as any[]).map((x) => ({ id: x.id, profit_date: x.profit_date, taken_amount: x.amount }));
    },
  });

  const products = productsQ.data ?? [];
  const purchases = purchasesQ.data ?? [];
  const sales = salesQ.data ?? [];

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Calculations: Purchases & Sales for current month (متطابق 100% مع صفحة الوارد)
  const totalIn = purchases.reduce((s, p) => s + Number(p.quantity), 0);
  const totalPurchasesCost = purchases.reduce((s, p) => s + Number(p.quantity) * Number(p.wholesale_price), 0);

  const totalOut = sales.reduce((s, p) => s + Number(p.quantity_sold), 0);
  const totalRevenue = sales.reduce(
    (s, p) => s + Number(p.quantity_sold) * Number(p.retail_price_snapshot),
    0
  );
  const totalCost = sales.reduce(
    (s, p) => s + Number(p.quantity_sold) * Number(p.wholesale_price_snapshot),
    0
  );
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  // Calculations: Net Profit Taken (المأخوذ فعلياً بعد المسحوبات — كما فى صفحة الأرباح)
  const pWithdrawals = profitWithdrawalsQ.data ?? [];
  const pExpenses = profitExpensesQ.data ?? [];
  const totalTakenProfit = pWithdrawals.reduce((s, w) => s + Number(w.taken_amount || 0), 0);
  const totalProfitExpenses = pExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfitTaken = totalTakenProfit - totalProfitExpenses;

  // Calculations: Taqseemat Remaining ("المتاح فى المحل" — كما فى صفحة التقسيمات)
  const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const cigByDate = useMemo(
    () => new Map((cigSalesQ.data ?? []).map((x) => [x.sale_date, Number(x.retail_total)])),
    [cigSalesQ.data]
  );
  const manualByDate = useMemo(
    () => new Map((manualSalesQ.data ?? []).map((x) => [x.sale_date, Number(x.amount)])),
    [manualSalesQ.data]
  );
  const profitByDate = useMemo(
    () => new Map((taqseematProfitsQ.data ?? []).map((x) => [x.profit_date, Number(x.taken_amount)])),
    [taqseematProfitsQ.data]
  );

  const wByDate = useMemo(() => {
    const m = new Map<string, { cigarettes: any[]; sales: any[] }>();
    for (const w of taqseematWithdrawalsQ.data ?? []) {
      const cur = m.get(w.entry_date) ?? { cigarettes: [], sales: [] };
      cur[w.kind].push(w);
      m.set(w.entry_date, cur);
    }
    return m;
  }, [taqseematWithdrawalsQ.data]);

  const taqseematDates = useMemo(() => {
    const set = new Set<string>([
      ...cigByDate.keys(),
      ...manualByDate.keys(),
      ...wByDate.keys(),
      ...profitByDate.keys(),
    ]);
    return [...set].filter((d) => d.startsWith(currentMonthPrefix));
  }, [cigByDate, manualByDate, wByDate, profitByDate, currentMonthPrefix]);

  const taqseematCigTotal = taqseematDates.reduce((s, d) => s + (cigByDate.get(d) ?? 0), 0);
  const taqseematSalesTotal = taqseematDates.reduce((s, d) => s + (manualByDate.get(d) ?? 0), 0);
  const taqseematProfitTotal = taqseematDates.reduce((s, d) => s + (profitByDate.get(d) ?? 0), 0);
  const sumW = (d: string, k: "cigarettes" | "sales") =>
    (wByDate.get(d)?.[k] ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
  const taqseematCigExpTotal = taqseematDates.reduce((s, d) => s + sumW(d, "cigarettes"), 0);
  const taqseematSalesExpTotal = taqseematDates.reduce((s, d) => s + sumW(d, "sales"), 0);
  const taqseematDaysTotal = taqseematCigTotal + taqseematSalesTotal + taqseematProfitTotal;
  const taqseematRemaining =
    taqseematDaysTotal - taqseematProfitTotal - taqseematCigExpTotal - taqseematSalesExpTotal;

  // Calculations: Today's specific performance
  const todaySales = sales.filter((s) => s.sale_date === currentIso);
  const todayRevenue = todaySales.reduce(
    (s, p) => s + Number(p.quantity_sold) * Number(p.retail_price_snapshot),
    0
  );
  const todayCost = todaySales.reduce(
    (s, p) => s + Number(p.quantity_sold) * Number(p.wholesale_price_snapshot),
    0
  );
  const todayProfit = todayRevenue - todayCost;
  const todayQty = todaySales.reduce((s, p) => s + Number(p.quantity_sold), 0);

  // Stock status & valuation
  const totalStockQty = products.reduce((s, p) => s + Number(p.quantity), 0);
  const stockWholesaleValue = products.reduce(
    (s, p) => s + Number(p.quantity) * Number(p.wholesale_price),
    0
  );
  const stockRetailValue = products.reduce(
    (s, p) => s + Number(p.quantity) * Number(p.retail_price),
    0
  );
  const stockPotentialProfit = stockRetailValue - stockWholesaleValue;

  const outOfStock = products.filter((p) => Number(p.quantity) <= 0);
  const lowStock = products.filter(
    (p) => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.low_stock_threshold)
  );
  const totalAlerts = outOfStock.length + lowStock.length;

  // Best selling products this month
  const topSellers = useMemo(() => {
    const agg = new Map<string, { id: string; name: string; qty: number; revenue: number; profit: number }>();
    for (const s of sales) {
      const p = productMap.get(s.product_id);
      if (!p) continue;
      const q = Number(s.quantity_sold);
      const rev = q * Number(s.retail_price_snapshot);
      const cost = q * Number(s.wholesale_price_snapshot);
      const cur = agg.get(p.id) ?? { id: p.id, name: p.name, qty: 0, revenue: 0, profit: 0 };
      cur.qty += q;
      cur.revenue += rev;
      cur.profit += rev - cost;
      agg.set(p.id, cur);
    }
    return Array.from(agg.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales, productMap]);

  // Daily Chart series for current month
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; revenue: number; profit: number; qty: number }>();
    for (const s of sales) {
      const q = Number(s.quantity_sold);
      const rev = q * Number(s.retail_price_snapshot);
      const cost = q * Number(s.wholesale_price_snapshot);
      const profit = rev - cost;
      const parts = s.sale_date.split("-");
      const displayDate = `${parts[2]}/${parts[1]}`;

      const cur = map.get(s.sale_date) ?? {
        date: s.sale_date,
        displayDate,
        revenue: 0,
        profit: 0,
        qty: 0,
      };
      cur.revenue += rev;
      cur.profit += profit;
      cur.qty += q;
      map.set(s.sale_date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  // Chart high score
  const highestDayRevenue = dailyChartData.reduce((max, d) => Math.max(max, d.revenue), 0);
  const activeDaysCount = dailyChartData.length;
  const avgDailyRevenue = activeDaysCount > 0 ? totalRevenue / activeDaysCount : 0;

  // Filtered low stock items
  const filteredStockAlerts = useMemo(() => {
    let list: Array<{ id: string; name: string; quantity: number; threshold: number; isOut: boolean }> = [];
    if (stockFilter === "all" || stockFilter === "out") {
      list.push(...outOfStock.map((p) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), threshold: Number(p.low_stock_threshold), isOut: true })));
    }
    if (stockFilter === "all" || stockFilter === "low") {
      list.push(...lowStock.map((p) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), threshold: Number(p.low_stock_threshold), isOut: false })));
    }
    if (stockSearch.trim()) {
      const q = stockSearch.trim().toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }
    return list;
  }, [outOfStock, lowStock, stockFilter, stockSearch]);

  // Core navigation modules
  const coreModules = [
    {
      to: "/cashier",
      label: "الكاشير ونقاط البيع",
      desc: "تسجيل المبيعات فورياً بالباركود مع حساب الباقي وطباعة البون",
      icon: ScanBarcode,
      variant: "primary" as const,
      badge: "بيع سريع",
    },
    {
      to: "/daily",
      label: "الجرد اليومي",
      desc: "تسجيل وحصر مبيعات الأسبوع لكل صنف ونقل الأيام بسهولة",
      icon: CalendarDays,
      variant: "info" as const,
      badge: "يومي",
    },
    {
      to: "/purchases",
      label: "الوارد والمشتريات",
      desc: "إضافة كميات جديدة للمخزن مع حساب متوسط التكلفة المرجح",
      icon: PackagePlus,
      variant: "warning" as const,
      badge: `${NUM(totalIn)} قطعة`,
    },
    {
      to: "/sales-purchases",
      label: "وارد المبيعات (الجملة)",
      desc: "تسجيل فواتير الكراتين والبلتات وسعر الشراء والقطاعي وحساب المسدد والآجل",
      icon: Receipt,
      variant: "info" as const,
      badge: "كراتين وبلتات",
    },
    {
      to: "/products",
      label: "الأصناف والمخزون",
      desc: "إدارة أسعار الجملة والقطاعي وحدود النواقص والكميات المتاحة",
      icon: Boxes,
      variant: "primary" as const,
      badge: `${NUM(products.length)} صنف`,
    },
    {
      to: "/profits",
      label: "الأرباح والمصروفات",
      desc: "متابعة صافي الأرباح، المسحوبات الشخصية، والمصروفات اليومية",
      icon: Wallet,
      variant: "success" as const,
      badge: `هامش ${profitMargin}%`,
    },
    {
      to: "/taqseemat",
      label: "تقسيمات وورديات",
      desc: "حسابات الورديات، مبيعات السجاير، والمنصرفات مع الخزينة",
      icon: Layers,
      variant: "info" as const,
      badge: "تسوية",
    },
    {
      to: "/reports",
      label: "التقارير الشاملة",
      desc: "تقارير مالية وتفصيلية قابلة للطباعة والتصدير لإكسل و PDF",
      icon: FileBarChart2,
      variant: "primary" as const,
      badge: "تصدير",
    },
    {
      to: "/quotation",
      label: "بيان أسعار الموردين",
      desc: "مقارنة عروض أسعار الموردين واحتساب تكاليف الطلبيات",
      icon: History,
      variant: "warning" as const,
      badge: "مشتريات",
    },
  ];

  const formattedMonthYear = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
  }).format(today);

  const formattedFullDate = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
  }).format(new Date(currentIso));

  return (
    <AppShell title="لوحة التحكم">
      <div className="space-y-8 animate-fade-in">
        {/* Welcome & Command Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-card border border-primary/20 p-6 lg:p-8 shadow-card backdrop-blur-md">
          {/* Ambient decorative lights */}
          <div className="absolute -top-24 -left-24 size-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 size-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-bold text-primary">
                <Sparkles className="size-3.5" />
                <span>نظام إدارة العمليات الذكي — الشوره ماركت</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                مرحباً بك في لوحة القيادة 👋
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                متابعة حركة المخزون، مبيعات اليوم، والتقارير المالية لشهر{" "}
                <span className="font-bold text-foreground">{formattedMonthYear}</span>.{" "}
                تاريخ اليوم: <span className="font-bold text-foreground">{formattedFullDate}</span>
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/cashier"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-card hover:opacity-95 hover:shadow-elevated transition-all"
              >
                <ScanBarcode className="size-4" />
                <span>فتح الكاشير</span>
              </Link>
              <Link
                to="/purchases"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-bold text-sm shadow-xs transition-colors"
              >
                <PackagePlus className="size-4 text-warning" />
                <span>إضافة وارد جديد</span>
              </Link>
              <Link
                to="/daily"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-bold text-sm shadow-xs transition-colors"
              >
                <CalendarDays className="size-4 text-info" />
                <span>الجرد اليومي</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Grand Hero Card: المتاح فى المحل (كما فى صفحة التقسيمات) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 lg:p-7 shadow-elevated border border-emerald-400/25">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-white border border-white/20">
                <Coins className="size-3.5" />
                <span>الرصيد الفعلي المتاح بالخزينة والمحل</span>
              </div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight">المتاح فى المحل</h2>
              <p className="text-xs lg:text-sm text-white/85">
                المتبقي = إجمالي الأيام − الأرباح − منصرفات السجاير والمبيعات — لشهر {formattedMonthYear}
              </p>
            </div>
            <div className="text-start md:text-end shrink-0">
              <div className="text-3xl lg:text-5xl font-black tracking-tight drop-shadow-sm">
                {EGP(taqseematRemaining)}
              </div>
              <Link
                to="/taqseemat"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white/90 hover:text-white underline underline-offset-4"
              >
                <span>عرض تفاصيل التقسيمات اليومية</span>
                <ArrowLeft className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Key Metric Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <span>مؤشرات الأداء الرئيسية</span>
            </h2>
            <span className="text-xs text-muted-foreground">تحديث فوري بالبيانات</span>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="إجمالي الوارد (الشهر)"
              value={EGP(totalPurchasesCost)}
              hint={`إجمالي المستلم: ${NUM(totalIn)} قطعة`}
              icon={PackagePlus}
              variant="warning"
              badge="صفحة الوارد"
              badgeVariant="warning"
              to="/purchases"
            />
            <StatCard
              label="صافي أرباح الشهر"
              value={EGP(netProfitTaken)}
              hint={`المأخوذ ${EGP(totalTakenProfit)} − المسحوبات ${EGP(totalProfitExpenses)}`}
              icon={Wallet}
              variant="success"
              badge="المسحوب فعلياً"
              badgeVariant="success"
              trend={{ value: "بعد المسحوبات", positive: netProfitTaken >= 0 }}
              to="/profits"
            />
            <StatCard
              label="مبيعات اليوم"
              value={EGP(todayRevenue)}
              hint={`تم بيع ${NUM(todayQty)} قطعة اليوم`}
              icon={ShoppingBag}
              variant="info"
              badge={todayRevenue > 0 ? "نشط الآن" : "في الانتظار"}
              badgeVariant={todayRevenue > 0 ? "success" : "neutral"}
              trend={
                todayProfit > 0
                  ? { value: `أرباح ${EGP(todayProfit)}`, positive: true }
                  : undefined
              }
              to="/daily"
            />
            <StatCard
              label="إجمالي الأصناف"
              value={NUM(products.length)}
              hint={`المتوفر بالمخزن: ${NUM(totalStockQty)} قطعة`}
              icon={Boxes}
              variant="primary"
              badge="المخزون"
              badgeVariant="info"
              to="/products"
            />
            <StatCard
              label="تنبيهات المخزون"
              value={NUM(totalAlerts)}
              hint={
                outOfStock.length > 0
                  ? `${NUM(outOfStock.length)} صنف نفد بالكامل!`
                  : totalAlerts > 0
                  ? "أصناف أوشكت على النفاد"
                  : "المخزون مكتمل ومستقر"
              }
              icon={AlertTriangle}
              variant={totalAlerts > 0 ? "danger" : "primary"}
              badge={totalAlerts > 0 ? "تنبيه هام" : "ممتاز"}
              badgeVariant={totalAlerts > 0 ? "danger" : "success"}
              to="/products"
            />
          </div>
        </div>

        {/* Stock Valuation & Financial Capital Strip */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-emerald-500" />
              <h3 className="text-sm font-extrabold text-foreground">
                تحليل رأس مال البضاعة وقيمة المخزن الحالي
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              يُحسب بناءً على الكميات الحالية بأسعار الجملة والقطاعي
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-border/60">
            <div className="pt-2 sm:pt-0 sm:pe-4">
              <div className="text-xs text-muted-foreground font-medium">رأس مال المخزون (سعر الجملة)</div>
              <div className="mt-1 text-lg lg:text-xl font-extrabold text-foreground">
                {EGP(stockWholesaleValue)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">التكلفة المستثمرة في البضاعة</div>
            </div>

            <div className="pt-2 sm:pt-0 sm:px-4">
              <div className="text-xs text-muted-foreground font-medium">القيمة البيعية المتوقعة (قطاعي)</div>
              <div className="mt-1 text-lg lg:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {EGP(stockRetailValue)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">العائد عند بيع كامل المخزون</div>
            </div>

            <div className="pt-2 sm:pt-0 sm:px-4">
              <div className="text-xs text-muted-foreground font-medium">الأرباح المتوقعة في المخزن</div>
              <div className="mt-1 text-lg lg:text-xl font-extrabold text-primary">
                {EGP(stockPotentialProfit)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">هامش الربح الكامن بالمخزن</div>
            </div>

            <div className="pt-2 sm:pt-0 sm:ps-4">
              <div className="text-xs text-muted-foreground font-medium">مشتريات الشهر (الوارد)</div>
              <div className="mt-1 text-lg lg:text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {EGP(totalPurchasesCost)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{NUM(totalIn)} قطعة تم شراؤها</div>
            </div>
          </div>
        </div>

        {/* Performance Chart & Analytics */}
        <div className="bg-card border border-border rounded-3xl p-5 lg:p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-primary" />
                <h3 className="font-extrabold text-base lg:text-lg">
                  مخطط أداء المبيعات والأرباح اليومية
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                توزيع العمليات على مدار شهر {formattedMonthYear}
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setChartMode("finance")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "finance"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💰 المبيعات والأرباح
              </button>
              <button
                type="button"
                onClick={() => setChartMode("volume")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "volume"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📦 القطع المباعة
              </button>
            </div>
          </div>

          {/* Quick chart stat badges */}
          <div className="flex flex-wrap items-center gap-3 mb-6 pt-1 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border flex items-center gap-2">
              <span className="text-muted-foreground">أعلى مبيعات يومية:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {EGP(highestDayRevenue)}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border flex items-center gap-2">
              <span className="text-muted-foreground">متوسط المبيعات اليومي:</span>
              <span className="font-bold text-primary">{EGP(avgDailyRevenue)}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border flex items-center gap-2">
              <span className="text-muted-foreground">أيام المبيعات المسجلة:</span>
              <span className="font-bold text-foreground">{NUM(activeDaysCount)} يوم</span>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="h-[280px] lg:h-[320px] w-full" dir="ltr">
            {dailyChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-2xl" dir="rtl">
                <CalendarDays className="size-8 opacity-40" />
                <p className="text-sm font-medium">لم يتم تسجيل مبيعات حتى الآن لهذا الشهر</p>
                <Link to="/daily" className="text-xs font-bold text-primary hover:underline">
                  تسجيل مبيعات جديدة الآن
                </Link>
              </div>
            ) : chartMode === "finance" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="displayDate" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "1rem",
                      boxShadow: "var(--shadow-elevated)",
                      direction: "rtl",
                      fontFamily: "var(--font-sans)",
                    }}
                    formatter={(val: any, name: any) => [
                      EGP(Number(val)),
                      name === "revenue" ? "إجمالي المبيعات" : "صافي الأرباح",
                    ]}
                    labelFormatter={(label) => `التاريخ: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    name="revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--success)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorProf)"
                    name="profit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="displayDate" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "1rem",
                      boxShadow: "var(--shadow-elevated)",
                      direction: "rtl",
                      fontFamily: "var(--font-sans)",
                    }}
                    formatter={(val: any) => [`${NUM(Number(val))} قطعة`, "الكمية المباعة"]}
                    labelFormatter={(label) => `التاريخ: ${label}`}
                  />
                  <Bar dataKey="qty" fill="var(--info)" radius={[6, 6, 0, 0]} name="qty" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Core Sections Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold tracking-tight">أقسام ولوحات النظام</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                الوصول السريع لجميع أدوات إدارة المتجر
              </p>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">8 أقسام رئيسية</span>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {coreModules.map((m) => {
              const Icon = m.icon;
              const bg = {
                primary: "bg-gradient-primary shadow-primary/20",
                info: "bg-gradient-info shadow-info/20",
                success: "bg-gradient-success shadow-success/20",
                warning: "bg-gradient-warning shadow-warning/20",
              }[m.variant];

              return (
                <Link
                  key={m.to}
                  to={m.to as never}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-card hover:shadow-elevated hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between"
                >
                  {/* Subtle top indicator bar */}
                  <div className={`absolute inset-x-0 top-0 h-1 ${bg}`} />

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`size-12 rounded-2xl ${bg} text-white grid place-items-center shadow-md transition-transform group-hover:scale-105`}>
                        <Icon className="size-6" />
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/80">
                        {m.badge}
                      </span>
                    </div>

                    <div className="mt-4 font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {m.label}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                      {m.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold text-primary">
                    <span>فتح القسم</span>
                    <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Operational Split: Top Best-Sellers vs Low-Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Best Selling Items */}
          <div className="bg-card border border-border rounded-3xl p-5 lg:p-6 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-amber-500" />
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">
                      الأصناف الأكثر مبيعاً
                    </h3>
                    <p className="text-xs text-muted-foreground">أعلى المنتجات طلباً هذا الشهر</p>
                  </div>
                </div>
                <Link to="/reports" className="text-xs font-bold text-primary hover:underline">
                  كل التقارير
                </Link>
              </div>

              {topSellers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2 border border-dashed border-border rounded-2xl">
                  <ShoppingBag className="size-8 mx-auto opacity-40" />
                  <p className="text-sm font-medium">لا توجد مبيعات مسجلة حتى الآن</p>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {topSellers.map((item, index) => {
                    const maxQty = topSellers[0]?.qty || 1;
                    const percent = Math.min(100, Math.round((item.qty / maxQty) * 100));
                    const medalColors = [
                      "bg-amber-500 text-white shadow-amber-500/20",
                      "bg-slate-400 text-white shadow-slate-400/20",
                      "bg-amber-700 text-white shadow-amber-700/20",
                      "bg-muted text-muted-foreground",
                      "bg-muted text-muted-foreground",
                    ][index];

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-muted/30 border border-border/60 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`size-6 rounded-lg text-xs font-extrabold grid place-items-center shadow-xs shrink-0 ${medalColors}`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-bold text-sm text-foreground truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-start shrink-0">
                            <span className="text-xs font-bold text-foreground">
                              {NUM(item.qty)} قطعة
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Revenue */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-border/60 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            إجمالي: <span className="font-bold text-foreground">{EGP(item.revenue)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>إجمالي أصناف المتجر: {NUM(products.length)}</span>
              <Link to="/products" className="font-bold text-primary hover:underline">
                إدارة الأصناف ←
              </Link>
            </div>
          </div>

          {/* Stock Health & Low Stock Monitor */}
          <div className="bg-card border border-border rounded-3xl p-5 lg:p-6 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-rose-500" />
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">
                      مراقبة النواقص والمخزون
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {totalAlerts > 0
                        ? `يوجد ${NUM(totalAlerts)} صنف بحاجة لمتابعة التوريد`
                        : "حالة المخزون ممتازة، لا توجد نواقص"}
                    </p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setStockFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      stockFilter === "all"
                        ? "bg-card text-foreground shadow-xs border border-border/80"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    الكل ({NUM(totalAlerts)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("out")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      stockFilter === "out"
                        ? "bg-card text-destructive shadow-xs border border-border/80"
                        : "text-muted-foreground hover:text-destructive"
                    }`}
                  >
                    نفد ({NUM(outOfStock.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("low")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      stockFilter === "low"
                        ? "bg-card text-warning shadow-xs border border-border/80"
                        : "text-muted-foreground hover:text-warning"
                    }`}
                  >
                    أوشك ({NUM(lowStock.length)})
                  </button>
                </div>
              </div>

              {/* Quick Search inside alert box */}
              {totalAlerts > 4 && (
                <div className="relative mb-3">
                  <Search className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="ابحث عن صنف في النواقص..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="h-9 pr-9 text-xs rounded-xl bg-muted/30"
                  />
                </div>
              )}

              {/* List */}
              {filteredStockAlerts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2 border border-dashed border-border rounded-2xl">
                  <CheckCircle2 className="size-8 mx-auto text-emerald-500 opacity-80" />
                  <p className="text-sm font-medium">
                    {stockSearch.trim()
                      ? "لا توجد نتائج مطابقة لبحثك"
                      : "المخزون متوفر بالكامل ولا توجد تنبيهات نشطة"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredStockAlerts.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between gap-3 hover:bg-muted/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>المتبقي: <strong className={item.isOut ? "text-destructive font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>{NUM(item.quantity)}</strong></span>
                          <span>•</span>
                          <span>الحد الأدنى: {NUM(item.threshold)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            item.isOut
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {item.isOut ? "نفد من المخزن" : "أوشك على النفاد"}
                        </span>
                        <Link
                          to="/purchases"
                          className="size-8 rounded-xl bg-card border border-border hover:bg-primary hover:text-primary-foreground text-foreground grid place-items-center transition-colors shadow-xs"
                          title="إضافة وارد جديد لهذا الصنف"
                        >
                          <PackagePlus className="size-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>أصناف نفدت: {NUM(outOfStock.length)} | أوشكت: {NUM(lowStock.length)}</span>
              <Link to="/purchases" className="font-bold text-primary hover:underline flex items-center gap-1">
                <span>طلب وإضافة بضاعة</span>
                <ArrowLeft className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
