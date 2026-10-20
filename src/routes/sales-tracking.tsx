import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { EGP, NUM, todayISO, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  TrendingUp,
  Store,
  Warehouse,
  Boxes,
  Coins,
  Sparkles,
  ArrowRight,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Receipt,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, printElement } from "@/lib/export";
import {
  getSalesPurchaseInvoices,
  fetchSalesPurchaseInvoicesCloud,
  updateItemTracking,
  UNIT_LABELS,
  type SalesPurchaseInvoice,
  type SalesPurchaseItem,
} from "@/lib/salesPurchases";

export const Route = createFileRoute("/sales-tracking")({
  head: () => ({
    meta: [
      { title: "ما تم بيعه والموقف المالي والأرباح — الشوره ماركت" },
      {
        name: "description",
        content: "متابعة ما تم بيعه من المرصوص بالمحل وحساب الأرباح المحققة والمتوقعة بالقطاعي.",
      },
    ],
  }),
  component: SalesTrackingPage,
});

function SalesTrackingPage() {
  const [invoices, setInvoices] = useState<SalesPurchaseInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("invoiceId") || "";
    }
    return "";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const refreshInvoices = () => {
    setInvoices(getSalesPurchaseInvoices());
    fetchSalesPurchaseInvoicesCloud().then(({ data }) => {
      setInvoices(data);
    });
  };

  useEffect(() => {
    refreshInvoices();
    const handleUpdate = () => refreshInvoices();
    window.addEventListener("sales-purchases-updated", handleUpdate);
    return () => window.removeEventListener("sales-purchases-updated", handleUpdate);
  }, []);

  const updateInvoiceFilter = (id: string) => {
    setSelectedInvoiceId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set("invoiceId", id);
      } else {
        url.searchParams.delete("invoiceId");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Unique suppliers list
  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.supplier_name?.trim()) set.add(inv.supplier_name.trim());
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedInvoiceId && inv.id !== selectedInvoiceId) return false;
      if (supplierFilter && inv.supplier_name !== supplierFilter) return false;
      return true;
    });
  }, [invoices, selectedInvoiceId, supplierFilter]);

  // Flattened items for display and calculations
  type TrackingItemRow = {
    invoice: SalesPurchaseInvoice;
    item: SalesPurchaseItem;
    totalPieces: number;
    pieceWholesale: number;
    pieceRetail: number;
    pieceProfit: number;
    displayed: number;
    sold: number;
    inCarton: number;
    onShelf: number;
    expectedProfit: number;
    realizedProfit: number;
    remainingProfit: number;
    soldPercentage: number;
  };

  const trackingRows = useMemo(() => {
    const rows: TrackingItemRow[] = [];
    filteredInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = it.name.toLowerCase().includes(q);
          const matchSup = inv.supplier_name.toLowerCase().includes(q);
          if (!matchName && !matchSup) return;
        }

        const totalPieces = it.packageCount * it.itemsPerPackage;
        const pieceWholesale = it.itemsPerPackage > 0 ? it.packageWholesalePrice / it.itemsPerPackage : 0;
        const pieceRetail = it.pieceRetailPrice || 0;
        const pieceProfit = Math.max(0, pieceRetail - pieceWholesale);
        const displayed = Math.max(0, Math.min(totalPieces, Number(it.displayedPieces) || 0));
        const sold = Math.max(0, Math.min(displayed, Number(it.soldPieces) || 0));
        const inCarton = Math.max(0, totalPieces - displayed);
        const onShelf = Math.max(0, displayed - sold);
        const lineCost = it.packageCount * it.packageWholesalePrice;
        const expectedProfit = totalPieces * pieceRetail - lineCost;
        const realizedProfit = sold * pieceProfit;
        const remainingProfit = (totalPieces - sold) * pieceProfit;
        const soldPercentage = totalPieces > 0 ? Math.round((sold / totalPieces) * 100) : 0;

        rows.push({
          invoice: inv,
          item: it,
          totalPieces,
          pieceWholesale,
          pieceRetail,
          pieceProfit,
          displayed,
          sold,
          inCarton,
          onShelf,
          expectedProfit,
          realizedProfit,
          remainingProfit,
          soldPercentage,
        });
      });
    });
    return rows;
  }, [filteredInvoices, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalPieces = 0;
    let totalDisplayed = 0;
    let totalSold = 0;
    let totalOnShelf = 0;
    let totalInCarton = 0;
    let totalExpectedProfit = 0;
    let totalRealizedProfit = 0;
    let totalRemainingProfit = 0;

    trackingRows.forEach((r) => {
      totalPieces += r.totalPieces;
      totalDisplayed += r.displayed;
      totalSold += r.sold;
      totalOnShelf += r.onShelf;
      totalInCarton += r.inCarton;
      totalExpectedProfit += r.expectedProfit;
      totalRealizedProfit += r.realizedProfit;
      totalRemainingProfit += r.remainingProfit;
    });

    const overallSoldPct = totalPieces > 0 ? Math.round((totalSold / totalPieces) * 100) : 0;

    return {
      totalPieces,
      totalDisplayed,
      totalSold,
      totalOnShelf,
      totalInCarton,
      totalExpectedProfit,
      totalRealizedProfit,
      totalRemainingProfit,
      overallSoldPct,
    };
  }, [trackingRows]);

  // Handler for updating sold pieces (constrained to displayed pieces)
  const handleUpdateSold = (invoiceId: string, itemId: string, newSold: number, displayed: number) => {
    if (newSold < 0) newSold = 0;
    if (newSold > displayed) {
      toast.warning(`لا يمكن بيع كمية أكثر من المعروض على الرف (${displayed} قطعة)!`);
      newSold = displayed;
    }

    const updated = updateItemTracking(invoiceId, itemId, displayed, newSold);
    if (updated) {
      setInvoices(getSalesPurchaseInvoices());
      toast.success("تم تحديث المباع", { duration: 1000 });
    }
  };

  // Handler for updating displayed count
  const handleUpdateDisplayed = (invoiceId: string, itemId: string, newDisplayed: number, currentSold: number, totalPieces: number) => {
    if (newDisplayed > totalPieces) newDisplayed = totalPieces;
    if (newDisplayed < currentSold) {
      toast.warning(`لا يمكن تقليل المعروض عن الكمية المباعة بالفعل (${currentSold} قطعة)!`);
      newDisplayed = currentSold;
    }

    const updated = updateItemTracking(invoiceId, itemId, newDisplayed, currentSold);
    if (updated) {
      setInvoices(getSalesPurchaseInvoices());
      toast.success("تم تحديث المرصوص بالرف", { duration: 1000 });
    }
  };

  // Handler for writing inCarton (الباقي غير المرصوص بالمخزن) with automatic calculation of displayed
  const handleUpdateInCarton = (
    invoiceId: string,
    itemId: string,
    newInCarton: number,
    currentSold: number,
    totalPieces: number
  ) => {
    if (newInCarton < 0) newInCarton = 0;
    if (newInCarton > totalPieces) newInCarton = totalPieces;

    const maxInCarton = Math.max(0, totalPieces - currentSold);
    if (newInCarton > maxInCarton) {
      toast.warning(
        `لا يمكن أن يتجاوز الباقي بالمخزن (${maxInCarton}) قطعة لوجود (${currentSold}) قطعة مباعة بالفعل!`
      );
      newInCarton = maxInCarton;
    }

    const calculatedDisplayed = totalPieces - newInCarton;
    const updated = updateItemTracking(invoiceId, itemId, calculatedDisplayed, currentSold);
    if (updated) {
      setInvoices(getSalesPurchaseInvoices());
      toast.success(
        `تم تسجيل الباقي بالمخزن (${newInCarton}) وحساب المرصوص بالرف تلقائياً (${calculatedDisplayed} ق)`,
        { duration: 1500 }
      );
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (trackingRows.length === 0) {
      toast.error("لا توجد بيانات لتصديرها");
      return;
    }

    const data = trackingRows.map((r, i) => ({
      "م": i + 1,
      "اسم الصنف": r.item.name,
      "التاجر": r.invoice.supplier_name,
      "تاريخ الفاتورة": r.invoice.invoice_date,
      "الوحدة": UNIT_LABELS[r.item.unitType] || r.item.unitType,
      "إجمالي القطع": r.totalPieces,
      "المرصوص على الرف": r.displayed,
      "ما تم بيعه": r.sold,
      "متبقي على الرف": r.onShelf,
      "بالمخزن (كرتونة)": r.inCarton,
      "سعر شراء القطعة": r.pieceWholesale,
      "سعر بيع القطاعي": r.pieceRetail,
      "ربح القطعة": r.pieceProfit,
      "الربح المحقق كاش": r.realizedProfit,
      "متبقي ربح متوقع": r.remainingProfit,
      "إجمالي الربح المتوقع بالكامل": r.expectedProfit,
      "نسبة البيع %": `${r.soldPercentage}%`,
    }));

    exportToExcel(data, `حركة_المبيعات_والأرباح_${todayISO()}`, "المبيعات والأرباح");
    toast.success("تم تصدير ملف Excel بنجاح");
  };

  return (
    <AppShell title="ما تم بيعه والموقف المالي والأرباح">
      <div className="space-y-3 max-w-[1550px] mx-auto pb-8" dir="rtl">
        {/* COMPACT TOP TOOLBAR (Single Slim Header) */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2.5 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Title & Navigation */}
            <div className="flex items-center gap-2">
              <Link to="/sales-purchases">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10 px-2.5"
                >
                  <ArrowRight className="size-3.5" />
                  <span>وارد المبيعات</span>
                </Button>
              </Link>
              <div className="flex items-center gap-1.5">
                <span className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
                  <ShoppingCart className="size-4" />
                </span>
                <h2 className="text-sm font-black text-foreground">
                  ما تم بيعه والموقف المالي والأرباح
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {trackingRows.length} صنف
                </span>
              </div>
            </div>

            {/* View Mode & Actions */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${
                    viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="عرض جدول مدمج لعرض أكبر قدر من الأصناف"
                >
                  <TableIcon className="size-3.5" />
                  <span>جدول مدمج</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${
                    viewMode === "cards" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="عرض بطاقات"
                >
                  <LayoutGrid className="size-3.5" />
                  <span>بطاقات</span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-8 text-xs font-bold gap-1 rounded-lg px-2.5"
              >
                <FileSpreadsheet className="size-3.5" />
                <span>Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => printElement(document.getElementById("tracking-print-area"))}
                className="h-8 text-xs font-bold gap-1 rounded-lg px-2.5"
              >
                <Printer className="size-3.5" />
                <span>طباعة</span>
              </Button>
            </div>
          </div>

          {/* SLIM FILTER ROW */}
          <div className="pt-2 border-t border-border/70 flex flex-wrap items-center gap-2 text-xs">
            {/* Invoice Select */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-muted-foreground text-[11px]">الفاتورة:</span>
              <select
                value={selectedInvoiceId}
                onChange={(e) => updateInvoiceFilter(e.target.value)}
                className="h-7 rounded-lg border border-input bg-background px-2 text-xs font-semibold max-w-[220px]"
              >
                <option value="">— جميع الفواتير ({invoices.length}) —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.supplier_name} ({inv.invoice_date}) - {EGP(inv.total_amount)}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Select */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-muted-foreground text-[11px]">التاجر:</span>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="h-7 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
              >
                <option value="">— كل التجار —</option>
                {suppliersList.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-2 top-1.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث باسم الصنف أو التاجر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-7 h-7 rounded-lg border border-input bg-background text-xs font-semibold"
              />
            </div>

            {/* Reset */}
            {(selectedInvoiceId || supplierFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateInvoiceFilter("");
                  setSupplierFilter("");
                  setSearchQuery("");
                }}
                className="h-7 text-xs text-destructive hover:bg-destructive/10 font-bold px-2"
              >
                <X className="size-3 ms-1" />
                إلغاء
              </Button>
            )}
          </div>
        </div>

        {/* COMPACT STATS STRIP (Single row, tight height) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 no-print">
          {/* Card 1: Expected Profit in RED */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-red-700 dark:text-red-300 font-bold">الربح المتوقع بالكامل</div>
              <div className="text-sm lg:text-base font-black text-red-600 dark:text-red-400 font-mono mt-0.5">
                {EGP(stats.totalExpectedProfit)}
              </div>
            </div>
            <div className="size-7 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 grid place-items-center">
              <TrendingUp className="size-4" />
            </div>
          </div>

          {/* Card 2: Realized Cash Profit */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">الربح المحقق كاش</div>
              <div className="text-sm lg:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {EGP(stats.totalRealizedProfit)}
              </div>
            </div>
            <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-600 grid place-items-center">
              <Sparkles className="size-4" />
            </div>
          </div>

          {/* Card 3: Remaining Expected Profit */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">متبقي أرباح متوقعة</div>
              <div className="text-sm lg:text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {EGP(stats.totalRemainingProfit)}
              </div>
            </div>
            <div className="size-7 rounded-lg bg-amber-500/20 text-amber-600 grid place-items-center">
              <Coins className="size-4" />
            </div>
          </div>

          {/* Card 4: Displayed on shelf */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">المرصوص بالرف بالمحل</div>
              <div className="text-sm lg:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {NUM(stats.totalDisplayed)} ق <span className="text-[10px] font-normal text-muted-foreground">({NUM(stats.totalPieces)} وارد)</span>
              </div>
            </div>
            <div className="size-7 rounded-lg bg-indigo-500/20 text-indigo-600 grid place-items-center">
              <Store className="size-4" />
            </div>
          </div>

          {/* Card 5: Sold */}
          <div className="rounded-xl border border-border bg-card p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground font-bold">ما تم بيعه (فعلياً)</div>
              <div className="text-sm lg:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {NUM(stats.totalSold)} ق <span className="text-[10px] font-normal text-muted-foreground">({stats.overallSoldPct}%)</span>
              </div>
            </div>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
              <ShoppingCart className="size-4" />
            </div>
          </div>

          {/* Card 6: Remaining on Shelf */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-sky-700 dark:text-sky-300 font-bold">متبقي على الرف حالياً</div>
              <div className="text-sm lg:text-base font-black text-sky-600 dark:text-sky-400 font-mono mt-0.5">
                {NUM(stats.totalOnShelf)} قطعة
              </div>
            </div>
            <div className="size-7 rounded-lg bg-sky-500/20 text-sky-600 grid place-items-center">
              <Boxes className="size-4" />
            </div>
          </div>
        </div>

        {/* Selected Invoice Banner (if viewing specific invoice) */}
        {selectedInvoiceId && filteredInvoices.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 flex items-center justify-between gap-2 text-xs no-print">
            <div className="flex items-center gap-2">
              <Receipt className="size-3.5 text-primary" />
              <span className="font-black text-foreground">
                فاتورة: {filteredInvoices[0].supplier_name}
              </span>
              <span className="text-muted-foreground">
                ({DATE_AR(filteredInvoices[0].invoice_date)}) • إجمالي: {EGP(filteredInvoices[0].total_amount)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateInvoiceFilter("")}
              className="text-primary hover:underline font-bold text-[11px]"
            >
              عرض كل الفواتير
            </button>
          </div>
        )}

        {/* MAIN DATA VIEW: COMPACT HIGH-DENSITY TABLE */}
        <div id="tracking-print-area">
          {trackingRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center space-y-2">
              <AlertCircle className="size-6 text-muted-foreground mx-auto" />
              <div className="font-bold text-xs text-foreground">لا توجد أصناف تطابق البحث أو الفلترة</div>
              <Link to="/sales-purchases">
                <Button variant="outline" size="sm" className="rounded-lg text-xs font-bold gap-1 mt-1">
                  <ArrowRight className="size-3.5" />
                  <span>الذهاب إلى وارد المبيعات</span>
                </Button>
              </Link>
            </div>
          ) : viewMode === "table" ? (
            /* ULTRA-COMPACT TABLE (fits 15-20 rows on screen easily) */
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-muted/80 text-muted-foreground font-bold border-b border-border text-[11px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2.5 text-start min-w-[170px]">الصنف والتاجر</th>
                      <th className="py-2 px-2 text-center min-w-[110px]" title="اكتب الباقي بالمخزن (غير المرصوص) وسيتم حساب المرصوص تلقائياً">
                        بالمخزن (الباقي) ✍️
                      </th>
                      <th className="py-2 px-2 text-center min-w-[125px]" title="الكمية المعروضة على الرف (تُحسب تلقائياً عند كتابة الباقي)">
                        المرصوص بالرف ✍️
                      </th>
                      <th className="py-2 px-2 text-center min-w-[210px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-black">
                        ما تم بيعه (من المرصوص)
                      </th>
                      <th className="py-2 px-2 text-center min-w-[85px] text-sky-700 dark:text-sky-300 font-bold" title="متبقي على الرف حالياً للزبائن">
                        متبقي بالرف
                      </th>
                      <th className="py-2 px-2 text-center min-w-[105px]">سعر القطاعي</th>
                      <th className="py-2 px-2 text-center min-w-[95px] text-emerald-700 dark:text-emerald-300 font-bold">
                        الربح المحقق
                      </th>
                      <th className="py-2 px-2 text-center min-w-[110px] text-red-600 dark:text-red-400 font-black bg-red-500/5">
                        الربح المتوقع بالكامل
                      </th>
                      <th className="py-2 px-2 text-center min-w-[85px]">الإنجاز %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {trackingRows.map((r, idx) => (
                      <tr
                        key={`${r.invoice.id}_${r.item.id}_${idx}`}
                        className="hover:bg-muted/40 transition-colors group"
                      >
                        {/* # */}
                        <td className="py-1.5 px-2 text-center text-muted-foreground font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Product & Supplier info */}
                        <td className="py-1.5 px-2.5">
                          <div className="font-black text-foreground text-xs leading-tight">
                            {r.item.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{r.invoice.supplier_name}</span>
                            <span>•</span>
                            <span>{r.item.packageCount} {UNIT_LABELS[r.item.unitType] || r.item.unitType} ({r.item.itemsPerPackage} ق)</span>
                          </div>
                        </td>

                        {/* Total Pieces */}
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-foreground">
                          {r.totalPieces} <span className="text-[10px] text-muted-foreground font-normal">ق</span>
                        </td>

                        {/* In Carton (Warehouse / الباقي غير المرصوص) - EDITABLE */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={Math.max(0, r.totalPieces - r.sold)}
                              value={r.inCarton}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                handleUpdateInCarton(r.invoice.id, r.item.id, val, r.sold, r.totalPieces);
                              }}
                              className="w-12 h-6 text-center font-bold text-xs font-mono rounded border border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              title="اكتب الباقي بالمخزن غير المرصوص وسيحسب المرصوص تلقائياً"
                            />
                            <span className="text-[10px] text-muted-foreground">ق</span>
                          </div>
                        </td>

                        {/* Displayed on Shelf (المرصوص بالرف) - EDITABLE */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={r.sold}
                              max={r.totalPieces}
                              value={r.displayed}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                handleUpdateDisplayed(r.invoice.id, r.item.id, val, r.sold, r.totalPieces);
                              }}
                              className="w-12 h-6 text-center font-black text-xs font-mono rounded border border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              title="المرصوص بالرف (أو اكتب الباقي بالمخزن ليحسب تلقائياً)"
                            />
                            <span className="text-[10px] text-muted-foreground">ق</span>
                            {r.displayed < r.totalPieces && (
                              <button
                                type="button"
                                onClick={() => handleUpdateDisplayed(r.invoice.id, r.item.id, r.totalPieces, r.sold, r.totalPieces)}
                                className="text-[9px] text-primary hover:underline font-bold bg-primary/5 px-1 py-0.5 rounded border border-primary/20 shrink-0"
                                title="رص كل الوارد بالرف"
                              >
                                الكل
                              </button>
                            )}
                          </div>
                        </td>

                        {/* SECTION 2: ما تم بيعه (من المرصوص فقط) */}
                        <td className="py-1 px-2 text-center bg-emerald-500/5">
                          <div className="inline-flex items-center gap-1">
                            {/* Stepper Minus */}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={r.sold <= 0}
                              onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.sold - 1, r.displayed)}
                              className="size-6 rounded-md shrink-0 border-border"
                              title="إنقاص المباع"
                            >
                              <Minus className="size-3" />
                            </Button>

                            {/* Direct Sold Input */}
                            <input
                              type="number"
                              min={0}
                              max={r.displayed}
                              value={r.sold}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                handleUpdateSold(r.invoice.id, r.item.id, val, r.displayed);
                              }}
                              className="w-12 h-6 text-center font-black text-xs font-mono rounded-md border border-emerald-500/40 bg-background text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              title={`المباع (الحد الأقصى المعروض: ${r.displayed})`}
                            />

                            {/* Stepper Plus */}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={r.sold >= r.displayed}
                              onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.sold + 1, r.displayed)}
                              className="size-6 rounded-md shrink-0 border-border"
                              title="زيادة المباع 1"
                            >
                              <Plus className="size-3" />
                            </Button>

                            {/* Quick +1 Button */}
                            <button
                              type="button"
                              disabled={r.sold >= r.displayed}
                              onClick={() => handleUpdateSold(r.invoice.id, r.item.id, Math.min(r.displayed, r.sold + 1), r.displayed)}
                              className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-1.5 py-0.5 rounded disabled:opacity-30"
                              title="+1 بيع"
                            >
                              +1
                            </button>

                            {/* Quick +5 Button */}
                            <button
                              type="button"
                              disabled={r.sold + 5 > r.displayed}
                              onClick={() => handleUpdateSold(r.invoice.id, r.item.id, Math.min(r.displayed, r.sold + 5), r.displayed)}
                              className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-1.5 py-0.5 rounded disabled:opacity-30"
                              title="+5 بيع"
                            >
                              +5
                            </button>

                            {/* Sell All Displayed Button */}
                            <button
                              type="button"
                              disabled={r.displayed <= 0 || r.sold >= r.displayed}
                              onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.displayed, r.displayed)}
                              className="text-[10px] font-bold text-primary hover:underline px-1 py-0.5 rounded disabled:opacity-30"
                              title="بيع كل المرصوص على الرف"
                            >
                              الكل
                            </button>
                          </div>
                        </td>

                        {/* Remaining on Shelf */}
                        <td className="py-1.5 px-2 text-center font-mono font-black">
                          <span className={r.onShelf > 0 ? "text-sky-700 dark:text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded" : "text-muted-foreground/50"}>
                            {r.onShelf} ق
                          </span>
                        </td>

                        {/* Retail & Cost Pricing */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                            {EGP(r.pieceRetail)}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            تكلفة: {EGP(r.pieceWholesale)} • ربح: {EGP(r.pieceProfit)}
                          </div>
                        </td>

                        {/* SECTION 3: Realized Profit */}
                        <td className="py-1.5 px-2 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          {EGP(r.realizedProfit)}
                        </td>

                        {/* Expected Profit in RED */}
                        <td className="py-1.5 px-2 text-center font-mono font-black text-red-600 dark:text-red-400 text-xs bg-red-500/5">
                          {EGP(r.expectedProfit)}
                        </td>

                        {/* Progress */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="w-14 mx-auto bg-muted rounded-full h-1.5 overflow-hidden border border-border">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${r.soldPercentage}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-mono font-bold text-muted-foreground mt-0.5">
                            {r.soldPercentage}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-black bg-muted/60 text-xs">
                    <tr>
                      <td colSpan={2} className="py-2 px-2.5">الإجمالي ({trackingRows.length} صنف)</td>
                      <td className="py-2 px-2 text-center font-mono">{stats.totalPieces} ق</td>
                      <td className="py-2 px-2 text-center font-mono text-sky-700">{stats.totalInCarton} ق</td>
                      <td className="py-2 px-2 text-center font-mono text-indigo-600">{stats.totalDisplayed} ق</td>
                      <td className="py-2 px-2 text-center font-mono text-emerald-600 bg-emerald-500/10">
                        {stats.totalSold} قطعة مباعة ({stats.overallSoldPct}%)
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-sky-700">{stats.totalOnShelf} ق</td>
                      <td className="py-2 px-2 text-center">—</td>
                      <td className="py-2 px-2 text-center font-mono text-emerald-600">
                        {EGP(stats.totalRealizedProfit)}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-red-600 bg-red-500/10">
                        {EGP(stats.totalExpectedProfit)}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{stats.overallSoldPct}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* COMPACT CARDS VIEW (if user prefers cards, much denser than before) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {trackingRows.map((r, idx) => (
                <div
                  key={`${r.invoice.id}_${r.item.id}_${idx}`}
                  className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/80">
                    <div>
                      <div className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <span className="size-4 rounded bg-primary/10 text-primary text-[10px] grid place-items-center">
                          {idx + 1}
                        </span>
                        <span>{r.item.name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.invoice.supplier_name} • {r.item.packageCount} {UNIT_LABELS[r.item.unitType] || r.item.unitType}
                      </div>
                    </div>
                    <div className="text-left shrink-0 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-lg">
                      <div className="text-[9px] font-bold text-red-700 dark:text-red-300">الربح المتوقع</div>
                      <div className="text-xs font-black text-red-600 dark:text-red-400 font-mono">
                        {EGP(r.expectedProfit)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                    <div className="p-1 rounded bg-muted/60">
                      <div className="text-muted-foreground">الوارد</div>
                      <div className="font-mono font-black">{r.totalPieces} ق</div>
                    </div>
                    <div className="p-1 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                      <div>المرصوص</div>
                      <div className="font-mono font-black">{r.displayed} ق</div>
                    </div>
                    <div className="p-1 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <div>متبقي بالرف</div>
                      <div className="font-mono font-black">{r.onShelf} ق</div>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-emerald-700 dark:text-emerald-300">ما تم بيعه:</span>
                      <span className="font-mono text-emerald-600">{r.sold} / {r.displayed} ({r.soldPercentage}%)</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={r.sold <= 0}
                        onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.sold - 1, r.displayed)}
                        className="size-6 rounded"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <input
                        type="number"
                        min={0}
                        max={r.displayed}
                        value={r.sold}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          handleUpdateSold(r.invoice.id, r.item.id, val, r.displayed);
                        }}
                        className="w-14 h-6 text-center font-black text-xs font-mono rounded border border-emerald-500/40 bg-background text-emerald-600"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={r.sold >= r.displayed}
                        onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.sold + 1, r.displayed)}
                        className="size-6 rounded"
                      >
                        <Plus className="size-3" />
                      </Button>
                      <button
                        type="button"
                        disabled={r.sold >= r.displayed}
                        onClick={() => handleUpdateSold(r.invoice.id, r.item.id, Math.min(r.displayed, r.sold + 1), r.displayed)}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-500/15 px-1.5 py-0.5 rounded"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={r.displayed <= 0 || r.sold >= r.displayed}
                        onClick={() => handleUpdateSold(r.invoice.id, r.item.id, r.displayed, r.displayed)}
                        className="text-[10px] font-bold text-primary underline px-1 py-0.5"
                      >
                        الكل
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/70">
                    <span className="text-muted-foreground">الربح المحقق كاش:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {EGP(r.realizedProfit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Printable Report Summary (Visible during print only) */}
          <div className="hidden print:block border border-border rounded-xl mt-4 p-3">
            <div className="text-center pb-2 border-b border-border space-y-0.5">
              <h2 className="text-base font-black">الشوره ماركت — تقرير حركة المبيعات والأرباح</h2>
              <div className="text-[11px] text-muted-foreground">
                تاريخ التقرير: {DATE_AR(todayISO())} • إجمالي الأصناف: {trackingRows.length}
              </div>
            </div>

            <table className="w-full text-[11px] mt-2 border-collapse">
              <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                <tr>
                  <th className="py-1 px-1.5 text-start">الصنف</th>
                  <th className="py-1 px-1.5 text-start">التاجر</th>
                  <th className="py-1 px-1.5 text-center">الوارد</th>
                  <th className="py-1 px-1.5 text-center">المرصوص</th>
                  <th className="py-1 px-1.5 text-center">المباع</th>
                  <th className="py-1 px-1.5 text-center">المتبقي بالرف</th>
                  <th className="py-1 px-1.5 text-center">سعر القطاعي</th>
                  <th className="py-1 px-1.5 text-center">الربح المحقق</th>
                  <th className="py-1 px-1.5 text-center">إجمالي الربح المتوقع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trackingRows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 px-1.5 font-bold">{r.item.name}</td>
                    <td className="py-1 px-1.5">{r.invoice.supplier_name}</td>
                    <td className="py-1 px-1.5 text-center font-mono">{r.totalPieces}</td>
                    <td className="py-1 px-1.5 text-center font-mono">{r.displayed}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-emerald-600">{r.sold}</td>
                    <td className="py-1 px-1.5 text-center font-mono">{r.onShelf}</td>
                    <td className="py-1 px-1.5 text-center font-mono">{EGP(r.pieceRetail)}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-emerald-600">{EGP(r.realizedProfit)}</td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-red-600">{EGP(r.expectedProfit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border font-black bg-muted/40">
                <tr>
                  <td colSpan={2} className="py-1.5 px-1.5">الإجمالي العام</td>
                  <td className="py-1.5 px-1.5 text-center font-mono">{stats.totalPieces}</td>
                  <td className="py-1.5 px-1.5 text-center font-mono">{stats.totalDisplayed}</td>
                  <td className="py-1.5 px-1.5 text-center font-mono text-emerald-600">{stats.totalSold}</td>
                  <td className="py-1.5 px-1.5 text-center font-mono">{stats.totalOnShelf}</td>
                  <td className="py-1.5 px-1.5 text-center">—</td>
                  <td className="py-1.5 px-1.5 text-center font-mono text-emerald-600">{EGP(stats.totalRealizedProfit)}</td>
                  <td className="py-1.5 px-1.5 text-center font-mono text-red-600">{EGP(stats.totalExpectedProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
