import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts } from "@/lib/api";
import { EGP, NUM, todayISO, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Receipt,
  Plus,
  Trash2,
  FileSpreadsheet,
  Printer,
  Calendar,
  User,
  Search,
  FileDown,
  Layers,
  Banknote,
  Package,
  Boxes,
  Eye,
  AlertCircle,
  X,
  CheckCircle2,
  Coins,
  TrendingUp,
  Store,
  Warehouse,
  ShoppingCart,
  Minus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, printElement } from "@/lib/export";
import {
  getSalesPurchaseInvoices,
  fetchSalesPurchaseInvoicesCloud,
  saveSalesPurchaseInvoice,
  deleteSalesPurchaseInvoice,
  updateItemTracking,
  UNIT_LABELS,
  type SalesPurchaseInvoice,
  type SalesPurchaseItem,
  type UnitType,
} from "@/lib/salesPurchases";

export const Route = createFileRoute("/sales-purchases")({
  head: () => ({
    meta: [
      { title: "وارد المبيعات — الشوره ماركت" },
      { name: "description", content: "تسجيل فواتير وارد المبيعات بالكرتونة والبلتة والعلبة مع أسعار الجملة والقطاعي وحساب المتبقي." },
    ],
  }),
  component: SalesPurchasesPage,
});

type FormItem = {
  id: string;
  name: string;
  unitType: UnitType;
  packageCount: string;
  itemsPerPackage: string;
  packageWholesalePrice: string;
  pieceRetailPrice: string;
};

function SalesPurchasesPage() {
  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const products = productsQ.data ?? [];

  const [invoices, setInvoices] = useState<SalesPurchaseInvoice[]>([]);
  const [isCloud, setIsCloud] = useState<boolean>(false);

  useEffect(() => {
    setInvoices(getSalesPurchaseInvoices());

    fetchSalesPurchaseInvoicesCloud().then(({ data, isCloud: cloudOk }) => {
      setInvoices(data);
      setIsCloud(cloudOk);
    });

    const handler = () => {
      setInvoices(getSalesPurchaseInvoices());
      fetchSalesPurchaseInvoicesCloud().then(({ data, isCloud: cloudOk }) => {
        setInvoices(data);
        setIsCloud(cloudOk);
      });
    };
    window.addEventListener("sales-purchases-updated", handler);
    return () => window.removeEventListener("sales-purchases-updated", handler);
  }, []);

  // Filter state
  const [filterSupplier, setFilterSupplier] = useState<string>("");
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Invoice creation dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invDate, setInvDate] = useState(todayISO());
  const [invSupplier, setInvSupplier] = useState("");
  const [invPaid, setInvPaid] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invItems, setInvItems] = useState<FormItem[]>([
    {
      id: "item_1",
      name: "",
      unitType: "carton",
      packageCount: "1",
      itemsPerPackage: "12",
      packageWholesalePrice: "",
      pieceRetailPrice: "",
    },
  ]);

  // Invoice view details dialog
  const [viewingInvoice, setViewingInvoice] = useState<SalesPurchaseInvoice | null>(null);

  // List of suppliers
  const suppliersList = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.supplier_name?.trim()) s.add(inv.supplier_name.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterSupplier && inv.supplier_name.trim() !== filterSupplier.trim()) return false;
      if (filterFromDate && inv.invoice_date < filterFromDate) return false;
      if (filterToDate && inv.invoice_date > filterToDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesSupplier = inv.supplier_name.toLowerCase().includes(q);
        const matchesNotes = inv.notes?.toLowerCase().includes(q);
        const matchesItem = inv.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchesSupplier && !matchesNotes && !matchesItem) return false;
      }
      return true;
    });
  }, [invoices, filterSupplier, filterFromDate, filterToDate, searchQuery]);

  // Totals of filtered invoices
  const totalInvoicesAmount = useMemo(() => filteredInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0), [filteredInvoices]);
  const totalPaidAmount = useMemo(() => filteredInvoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0), [filteredInvoices]);
  const totalRemainingAmount = totalInvoicesAmount - totalPaidAmount;

  // Expected retail profit and realized profit across filtered invoices
  const totalExpectedRetailProfit = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const invProfit = inv.items.reduce((iSum, it) => {
        const totalPieces = (Number(it.packageCount) || 0) * (Number(it.itemsPerPackage) || 0);
        const retailRev = totalPieces * (Number(it.pieceRetailPrice) || 0);
        const wholesaleCost = (Number(it.packageCount) || 0) * (Number(it.packageWholesalePrice) || 0);
        return iSum + (retailRev - wholesaleCost);
      }, 0);
      return sum + invProfit;
    }, 0);
  }, [filteredInvoices]);

  const totalRealizedRetailProfit = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const invRealized = inv.items.reduce((iSum, it) => {
        const sold = Number(it.soldPieces) || 0;
        const pieceCost = (Number(it.itemsPerPackage) || 0) > 0 ? (Number(it.packageWholesalePrice) || 0) / Number(it.itemsPerPackage) : 0;
        const pieceRetail = Number(it.pieceRetailPrice) || 0;
        const pieceProfit = Math.max(0, pieceRetail - pieceCost);
        return iSum + (sold * pieceProfit);
      }, 0);
      return sum + invRealized;
    }, 0);
  }, [filteredInvoices]);

  // Statistics for the invoice currently being viewed
  const viewingInvoiceStats = useMemo(() => {
    if (!viewingInvoice) return null;

    let totalPieces = 0;
    let totalWholesaleCost = 0;
    let totalRetailRevenue = 0;
    let totalDisplayed = 0;
    let totalSold = 0;
    let totalRealizedProfit = 0;

    viewingInvoice.items.forEach((it) => {
      const pieces = (Number(it.packageCount) || 0) * (Number(it.itemsPerPackage) || 0);
      const wholesale = (Number(it.packageCount) || 0) * (Number(it.packageWholesalePrice) || 0);
      const retailRev = pieces * (Number(it.pieceRetailPrice) || 0);
      const displayed = Math.max(0, Math.min(pieces, Number(it.displayedPieces) || 0));
      const sold = Math.max(0, Math.min(displayed, Number(it.soldPieces) || 0));

      const pieceCost = (Number(it.itemsPerPackage) || 0) > 0 ? (Number(it.packageWholesalePrice) || 0) / Number(it.itemsPerPackage) : 0;
      const pieceProfit = Math.max(0, (Number(it.pieceRetailPrice) || 0) - pieceCost);

      totalPieces += pieces;
      totalWholesaleCost += wholesale;
      totalRetailRevenue += retailRev;
      totalDisplayed += displayed;
      totalSold += sold;
      totalRealizedProfit += sold * pieceProfit;
    });

    const totalExpectedProfit = totalRetailRevenue - totalWholesaleCost;
    const totalInCarton = Math.max(0, totalPieces - totalDisplayed);
    const totalOnShelf = Math.max(0, totalDisplayed - totalSold);

    return {
      totalPieces,
      totalWholesaleCost,
      totalRetailRevenue,
      totalExpectedProfit,
      totalDisplayed,
      totalSold,
      totalInCarton,
      totalOnShelf,
      totalRealizedProfit,
      soldPercentage: totalPieces > 0 ? Math.round((totalSold / totalPieces) * 100) : 0,
      displayedPercentage: totalPieces > 0 ? Math.round((totalDisplayed / totalPieces) * 100) : 0,
    };
  }, [viewingInvoice]);

  const handleUpdateItemDisplayed = (itemId: string, newDisplayed: number) => {
    if (!viewingInvoice) return;
    const it = viewingInvoice.items.find((x) => x.id === itemId);
    if (!it) return;

    const totalPieces = it.packageCount * it.itemsPerPackage;
    const clampedDisplayed = Math.max(0, Math.min(totalPieces, newDisplayed));
    const currentSold = it.soldPieces || 0;
    // Rule: sold comes from displayed
    const clampedSold = Math.min(currentSold, clampedDisplayed);

    const updated = updateItemTracking(viewingInvoice.id, itemId, clampedDisplayed, clampedSold);
    if (updated) {
      setViewingInvoice(updated);
      toast.success("تم تحديث كمية المرصوص بالمحل");
    }
  };

  const handleUpdateItemInCarton = (itemId: string, inCartonVal: number) => {
    if (!viewingInvoice) return;
    const it = viewingInvoice.items.find((x) => x.id === itemId);
    if (!it) return;

    const totalPieces = it.packageCount * it.itemsPerPackage;
    const currentSold = it.soldPieces || 0;

    if (inCartonVal < 0) inCartonVal = 0;
    if (inCartonVal > totalPieces) inCartonVal = totalPieces;

    const maxInCarton = Math.max(0, totalPieces - currentSold);
    if (inCartonVal > maxInCarton) {
      toast.warning(
        `لا يمكن أن يتجاوز الباقي بالمخزن (${maxInCarton}) قطعة لوجود (${currentSold}) قطعة مباعة بالفعل من الرف!`
      );
      inCartonVal = maxInCarton;
    }

    const calculatedDisplayed = totalPieces - inCartonVal;
    const updated = updateItemTracking(viewingInvoice.id, itemId, calculatedDisplayed, currentSold);
    if (updated) {
      setViewingInvoice(updated);
      toast.success(
        `تم تسجيل الباقي بالمخزن (${inCartonVal}) وحساب المرصوص بالرف تلقائياً (${calculatedDisplayed} ق)`
      );
    }
  };

  const handleUpdateItemSold = (itemId: string, newSold: number) => {
    if (!viewingInvoice) return;
    const it = viewingInvoice.items.find((x) => x.id === itemId);
    if (!it) return;

    const displayed = it.displayedPieces || 0;
    if (newSold > displayed) {
      toast.error(`البيع يتم من المرصوص فقط! المعروض حالياً على الرف بالمحل: ${displayed} قطعة. يرجى عرض كمية إضافية من الكرتونة أولاً.`);
      return;
    }
    const clampedSold = Math.max(0, Math.min(displayed, newSold));
    const updated = updateItemTracking(viewingInvoice.id, itemId, displayed, clampedSold);
    if (updated) {
      setViewingInvoice(updated);
      toast.success("تم تسجيل ما تم بيعه بنجاح");
    }
  };

  // Form helpers
  const addItemRow = () => {
    setInvItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: "",
        unitType: "carton",
        packageCount: "1",
        itemsPerPackage: "12",
        packageWholesalePrice: "",
        pieceRetailPrice: "",
      },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (invItems.length <= 1) {
      toast.error("يجب أن تحتوي الفاتورة على صنف واحد على الأقل");
      return;
    }
    setInvItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItemRow = (id: string, field: keyof FormItem, value: any) => {
    setInvItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Calculate live total for invoice form
  const formCalculatedTotal = useMemo(() => {
    return invItems.reduce((sum, item) => {
      const count = Number(item.packageCount) || 0;
      const price = Number(item.packageWholesalePrice) || 0;
      return sum + count * price;
    }, 0);
  }, [invItems]);

  const openCreateDialog = () => {
    setInvDate(todayISO());
    setInvSupplier("");
    setInvPaid("");
    setInvNotes("");
    setInvItems([
      {
        id: "item_1",
        name: "",
        unitType: "carton",
        packageCount: "1",
        itemsPerPackage: "12",
        packageWholesalePrice: "",
        pieceRetailPrice: "",
      },
    ]);
    setIsCreateOpen(true);
  };

  const handleSaveInvoice = () => {
    if (!invSupplier.trim()) {
      toast.error("يرجى كتابة اسم التاجر / المورد");
      return;
    }

    const validItems: SalesPurchaseItem[] = [];
    for (let idx = 0; idx < invItems.length; idx++) {
      const it = invItems[idx];
      if (!it.name.trim()) {
        toast.error(`يرجى تحديد اسم الصنف في البند رقم ${idx + 1}`);
        return;
      }
      const pCount = Number(it.packageCount) || 0;
      const perPkg = Number(it.itemsPerPackage) || 1;
      const wPrice = Number(it.packageWholesalePrice) || 0;
      const rPrice = Number(it.pieceRetailPrice) || 0;

      if (pCount <= 0) {
        toast.error(`يرجى إدخال عدد الوحدات (الكرتونة/البلتة) للصنف ${it.name}`);
        return;
      }
      if (wPrice <= 0) {
        toast.error(`يرجى إدخال سعر شراء الوحدة بالجملة للصنف ${it.name}`);
        return;
      }

      validItems.push({
        id: it.id,
        name: it.name.trim(),
        unitType: it.unitType,
        packageCount: pCount,
        itemsPerPackage: perPkg,
        packageWholesalePrice: wPrice,
        pieceRetailPrice: rPrice,
      });
    }

    const total = validItems.reduce(
      (s, i) => s + i.packageCount * i.packageWholesalePrice,
      0
    );
    const paid = invPaid.trim() === "" ? total : Number(invPaid) || 0;

    saveSalesPurchaseInvoice({
      invoice_date: invDate,
      supplier_name: invSupplier.trim(),
      notes: invNotes.trim() || undefined,
      paid_amount: paid,
      total_amount: total,
      items: validItems,
    });

    toast.success("تم تسجيل فاتورة وارد المبيعات بنجاح");
    setIsCreateOpen(false);
  };

  const handleDeleteInvoice = (id: string, supplier: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف فاتورة التاجر "${supplier}"؟`)) return;
    deleteSalesPurchaseInvoice(id);
    if (viewingInvoice?.id === id) setViewingInvoice(null);
    toast.success("تم حذف الفاتورة بنجاح");
  };

  const handleExportExcel = () => {
    const rows: Record<string, any>[] = [];
    filteredInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const totalPieces = it.packageCount * it.itemsPerPackage;
        const totalCost = it.packageCount * it.packageWholesalePrice;
        const pieceCost = it.itemsPerPackage > 0 ? it.packageWholesalePrice / it.itemsPerPackage : 0;
        rows.push({
          "التاريخ": inv.invoice_date,
          "اسم التاجر": inv.supplier_name,
          "الصنف": it.name,
          "نوع الوحدة": UNIT_LABELS[it.unitType] || it.unitType,
          "عدد الكراتين/البلتات": it.packageCount,
          "العدد داخل الوحدة": it.itemsPerPackage,
          "إجمالي القطع": totalPieces,
          "سعر شراء الوحدة": it.packageWholesalePrice,
          "تكلفة القطعة جملة": Math.round(pieceCost * 100) / 100,
          "سعر بيع القطعة قطاعي": it.pieceRetailPrice || "—",
          "إجمالي الصنف": totalCost,
          "المدفوع من الفاتورة": inv.paid_amount,
          "إجمالي الفاتورة": inv.total_amount,
          "ملاحظات": inv.notes || "",
        });
      });
    });

    if (rows.length === 0) {
      toast.error("لا توجد فواتير لتصديرها");
      return;
    }
    exportToExcel(rows, `وارد_المبيعات_${todayISO()}`, "وارد المبيعات");
  };

  return (
    <AppShell title="وارد المبيعات">
      <div className="space-y-6 animate-fade-in">
        {/* Top Header Card */}
        <div className="rounded-3xl border border-border bg-card p-5 lg:p-6 shadow-card space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shadow-xs shrink-0">
                <Receipt className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">وارد المبيعات (فواتير الجملة)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تسجيل الواردات بالكرتونة والبلتة والعلبة مع أسعار الجملة والقطاعي وإجمالي ومدفوعات كل فاتورة
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/sales-tracking">
                <Button
                  variant="outline"
                  className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-xs"
                >
                  <ShoppingCart className="size-4" />
                  <span>📊 ما تم بيعه والأرباح</span>
                </Button>
              </Link>
              <Button
                onClick={openCreateDialog}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-sm"
              >
                <Plus className="size-4" />
                <span>+ تسجيل فاتورة وارد جديدة</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border hover:bg-muted"
              >
                <FileSpreadsheet className="size-4" />
                <span>تصدير Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => printElement(document.getElementById("sales-purchases-print"))}
                className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border hover:bg-muted"
              >
                <Printer className="size-4" />
                <span>طباعة</span>
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="pt-3 border-t border-border/80 flex flex-wrap items-center gap-3 text-xs">
            {/* Supplier Filter */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted-foreground">التاجر:</span>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                <option value="">— كل التجار —</option>
                {suppliersList.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted-foreground">من:</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold"
              />
              <span className="font-bold text-muted-foreground">إلى:</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold"
              />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-48">
              <Search className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث باسم التاجر أو الصنف أو الملاحظات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 h-9 rounded-xl border border-input bg-background text-xs font-semibold"
              />
            </div>

            {(filterSupplier || filterFromDate || filterToDate || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterSupplier("");
                  setFilterFromDate("");
                  setFilterToDate("");
                  setSearchQuery("");
                }}
                className="h-9 text-xs text-destructive hover:bg-destructive/10 font-bold"
              >
                <X className="size-3.5 ms-1" />
                إلغاء التصفية
              </Button>
            )}
          </div>
        </div>

        {/* Grand Total Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-bold">إجمالي الفواتير (جملة)</div>
              <div className="text-lg font-black text-foreground mt-1 font-mono">
                {EGP(totalInvoicesAmount)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {filteredInvoices.length} فاتورة مسجلة
              </div>
            </div>
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center">
              <Banknote className="size-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-bold">المبلغ المدفوع للتجار</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {EGP(totalPaidAmount)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">سداد فعلي للتجار</div>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-bold">المتبقي آجل للتجار</div>
              <div className={`text-lg font-black mt-1 font-mono ${totalRemainingAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {EGP(totalRemainingAmount)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {totalRemainingAmount > 0 ? "مستحقات آجلة للتجار" : "الفواتير مسددة"}
              </div>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
              <Coins className="size-5" />
            </div>
          </div>

          {/* Expected Retail Profit in RED */}
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="text-xs text-red-700 dark:text-red-300 font-bold">الربح المتوقع بالقطاعي</div>
              <div className="text-lg font-black text-red-600 dark:text-red-400 mt-1 font-mono">
                {EGP(totalExpectedRetailProfit)}
              </div>
              <div className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-0.5">
                عند بيع كامل البضاعة
              </div>
            </div>
            <div className="size-10 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 grid place-items-center">
              <TrendingUp className="size-5" />
            </div>
          </div>

          {/* Realized Profit */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">الربح المحقق فعلياً</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {EGP(totalRealizedRetailProfit)}
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                من الكميات المباعة
              </div>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-600 grid place-items-center">
              <Sparkles className="size-5" />
            </div>
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>فواتير وارد المبيعات</span>
              <span className="text-xs font-normal text-muted-foreground">({filteredInvoices.length})</span>
            </h3>
          </div>

          <div id="sales-purchases-print" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground font-bold text-xs border-b border-border">
                <tr>
                  <th className="py-3 px-4 text-start">التاريخ</th>
                  <th className="py-3 px-4 text-start">اسم التاجر</th>
                  <th className="py-3 px-3 text-center">الأصناف</th>
                  <th className="py-3 px-4 text-start">تفاصيل البضاعة</th>
                  <th className="py-3 px-3 text-center">إجمالي الفاتورة</th>
                  <th className="py-3 px-3 text-center">المبلغ المدفوع</th>
                  <th className="py-3 px-3 text-center">المتبقي آجل</th>
                  <th className="py-3 px-3 text-center text-red-600 dark:text-red-400">الربح بالقطاعي (متوقع)</th>
                  <th className="py-3 px-3 text-center">حركة البيع</th>
                  <th className="py-3 px-3 text-center no-print">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => {
                  const rem = inv.total_amount - inv.paid_amount;
                  let invPieces = 0;
                  let invDisplayed = 0;
                  let invSold = 0;
                  let invExpectedProfit = 0;

                  inv.items.forEach((it) => {
                    const count = Number(it.packageCount) || 0;
                    const perPkg = Number(it.itemsPerPackage) || 0;
                    const pieces = count * perPkg;
                    const wholesaleCost = count * (Number(it.packageWholesalePrice) || 0);
                    const retailRev = pieces * (Number(it.pieceRetailPrice) || 0);
                    invPieces += pieces;
                    invDisplayed += Number(it.displayedPieces) || 0;
                    invSold += Number(it.soldPieces) || 0;
                    invExpectedProfit += (retailRev - wholesaleCost);
                  });

                  return (
                    <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-bold whitespace-nowrap text-foreground">
                        {DATE_AR(inv.invoice_date)}
                      </td>
                      <td className="py-3 px-4 font-black text-foreground">
                        {inv.supplier_name}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          {inv.items.length} صنف
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {inv.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-[11px] bg-muted px-2 py-0.5 rounded-md border border-border"
                            >
                              {it.name} ({it.packageCount} {UNIT_LABELS[it.unitType] || it.unitType})
                            </span>
                          ))}
                        </div>
                        {inv.notes && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            ملاحظة: {inv.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-foreground font-mono">
                        {EGP(inv.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {EGP(inv.paid_amount)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {rem > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {EGP(rem)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">مسددة</span>
                        )}
                      </td>
                      {/* Expected Profit in RED */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-red-600 dark:text-red-400 font-black">
                          {EGP(invExpectedProfit)}
                        </span>
                      </td>
                      {/* Sales and Display tracking badge */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-foreground">
                            <span className="text-emerald-600 dark:text-emerald-400">{invSold}</span> / {invPieces} مباع
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            مرصوص بالمحل: {invDisplayed}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center no-print whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Link to="/sales-tracking" search={{ invoiceId: inv.id }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold gap-1 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              title="فتح صفحة ما تم بيعه والأرباح لهذه الفاتورة"
                            >
                              <ShoppingCart className="size-3.5" />
                              <span>المبيعات</span>
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingInvoice(inv)}
                            className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
                            title="عرض تفاصيل الفاتورة وتتبع المرصوص"
                          >
                            <Eye className="size-3.5" />
                            <span>عرض الفاتورة</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInvoice(inv.id, inv.supplier_name)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="حذف الفاتورة"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      لا توجد فواتير وارد مبيعات مسجلة تطابق البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DIALOG: Create Sales Purchase Invoice */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden" dir="rtl">
            <DialogHeader className="p-5 border-b border-border bg-card shrink-0 text-start">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-foreground">
                    تسجيل فاتورة وارد مبيعات بالجملة
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    سجل الفاتورة بالكرتونة أو البلتة أو العلبة وسعر الجملة والقطاعي وإجمالي المبلغ
                  </DialogDescription>
                </div>
              </div>

              {/* Invoice Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground">
                    تاريخ الفاتورة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground">
                    اسم التاجر / المورد <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="suppliers-datalist"
                    placeholder="مثال: شركة المنصورة للجملة..."
                    value={invSupplier}
                    onChange={(e) => setInvSupplier(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  />
                  <datalist id="suppliers-datalist">
                    {suppliersList.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground">
                    المبلغ الذي تم دفعه (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={`الافتراضي كامل الفاتورة: ${formCalculatedTotal}`}
                    value={invPaid}
                    onChange={(e) => setInvPaid(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold mb-1 text-muted-foreground">
                    ملاحظات الفاتورة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: دفعة تحت الحساب، باقى الفاتورة الأسبوع القادم..."
                    value={invNotes}
                    onChange={(e) => setInvNotes(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                  />
                </div>
              </div>
            </DialogHeader>

            {/* Items List inside Modal */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Boxes className="size-4 text-primary" />
                  <span>أصناف الفاتورة ({invItems.length})</span>
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/10 border-primary/30"
                >
                  <Plus className="size-3.5" />
                  <span>+ إضافة صنف آخر</span>
                </Button>
              </div>

              {/* Items Table in Form */}
              <div className="border border-border rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 text-start">الصنف</th>
                      <th className="py-2.5 px-2 text-start w-28">الوحدة الكبيرة</th>
                      <th className="py-2.5 px-2 text-center w-24">العدد بالجملة</th>
                      <th className="py-2.5 px-2 text-center w-24">القطع بالوحدة</th>
                      <th className="py-2.5 px-2 text-center w-28">سعر شراء الوحدة</th>
                      <th className="py-2.5 px-2 text-center w-28">سعر بيع القطعة</th>
                      <th className="py-2.5 px-3 text-center w-28">إجمالي الصنف</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invItems.map((item, idx) => {
                      const count = Number(item.packageCount) || 0;
                      const wPrice = Number(item.packageWholesalePrice) || 0;
                      const lineTotal = count * wPrice;
                      const perPkg = Number(item.itemsPerPackage) || 1;
                      const pieceWholesale = perPkg > 0 ? wPrice / perPkg : 0;

                      return (
                        <tr key={item.id} className="hover:bg-muted/30">
                          {/* Product Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              list="products-datalist"
                              placeholder="اسم الصنف..."
                              value={item.name}
                              onChange={(e) => updateItemRow(item.id, "name", e.target.value)}
                              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                            />
                            <datalist id="products-datalist">
                              {products.map((p) => (
                                <option key={p.id} value={p.name} />
                              ))}
                            </datalist>
                          </td>

                          {/* Unit Type */}
                          <td className="py-2 px-2">
                            <select
                              value={item.unitType}
                              onChange={(e) =>
                                updateItemRow(item.id, "unitType", e.target.value as UnitType)
                              }
                              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
                            >
                              <option value="carton">كرتونة</option>
                              <option value="pallet">بلتة</option>
                              <option value="box">علبة</option>
                              <option value="custom">أخرى</option>
                            </select>
                          </td>

                          {/* Package Count */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0.1}
                              step="any"
                              placeholder="1"
                              value={item.packageCount}
                              onChange={(e) => updateItemRow(item.id, "packageCount", e.target.value)}
                              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold text-center"
                            />
                          </td>

                          {/* Items Per Package */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={1}
                              step="1"
                              placeholder="12"
                              value={item.itemsPerPackage}
                              onChange={(e) => updateItemRow(item.id, "itemsPerPackage", e.target.value)}
                              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold text-center"
                              title="عدد القطع الفردية داخل الكرتونة أو البلتة"
                            />
                            <div className="text-[9px] text-muted-foreground text-center mt-0.5">
                              {count * perPkg} قطعة
                            </div>
                          </td>

                          {/* Package Wholesale Price */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0.00"
                              value={item.packageWholesalePrice}
                              onChange={(e) =>
                                updateItemRow(item.id, "packageWholesalePrice", e.target.value)
                              }
                              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold text-center"
                            />
                            {pieceWholesale > 0 && (
                              <div className="text-[9px] text-muted-foreground text-center mt-0.5">
                                القطعة: {EGP(pieceWholesale)}
                              </div>
                            )}
                          </td>

                          {/* Piece Retail Price */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0.00"
                              value={item.pieceRetailPrice}
                              onChange={(e) =>
                                updateItemRow(item.id, "pieceRetailPrice", e.target.value)
                              }
                              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold text-center"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-2 px-3 text-center font-black text-foreground">
                            {EGP(lineTotal)}
                          </td>

                          {/* Delete */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(item.id)}
                              className="text-destructive hover:opacity-75 p-1"
                              title="حذف البند"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer with Live Totals */}
            <DialogFooter className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground font-bold">إجمالي الفاتورة: </span>
                  <span className="text-base font-black text-foreground font-mono">
                    {EGP(formCalculatedTotal)}
                  </span>
                </div>
                {invPaid && (
                  <div>
                    <span className="text-muted-foreground font-bold">المتبقي للتأجيل: </span>
                    <span className="font-bold text-rose-600 font-mono">
                      {EGP(Math.max(0, formCalculatedTotal - (Number(invPaid) || 0)))}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-10 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSaveInvoice}
                  className="h-10 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  <Plus className="size-4" />
                  <span>حفظ الفاتورة</span>
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: View Invoice Details with Shelf Display & Sales Tracking */}
        <Dialog open={!!viewingInvoice} onOpenChange={(o) => !o && setViewingInvoice(null)}>
          <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden" dir="rtl">
            {viewingInvoice && (
              <>
                <DialogHeader className="p-5 border-b border-border bg-card shrink-0 text-start space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                        <span>فاتورة وارد: {viewingInvoice.supplier_name}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({DATE_AR(viewingInvoice.invoice_date)})
                        </span>
                      </DialogTitle>
                      {viewingInvoice.notes && (
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                          ملاحظات: {viewingInvoice.notes}
                        </DialogDescription>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link to="/sales-tracking" search={{ invoiceId: viewingInvoice.id }}>
                        <Button
                          size="sm"
                          className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <ShoppingCart className="size-3.5" />
                          <span>صفحة ما تم بيعه والأرباح</span>
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printElement(document.getElementById("single-invoice-print"))}
                        className="h-9 rounded-xl text-xs font-bold gap-1.5"
                      >
                        <Printer className="size-3.5" />
                        <span>طباعة الفاتورة</span>
                      </Button>
                    </div>
                  </div>

                  {/* Summary Stat Cards (Row 1) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border">
                      <div className="text-muted-foreground font-semibold text-[11px]">إجمالي الفاتورة (جملة)</div>
                      <div className="text-base font-black text-foreground mt-0.5 font-mono">
                        {EGP(viewingInvoice.total_amount)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <div className="font-semibold text-[11px]">المبلغ المدفوع للتاجر</div>
                      <div className="text-base font-black mt-0.5 font-mono">
                        {EGP(viewingInvoice.paid_amount)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                      <div className="font-semibold text-[11px]">المتبقي آجل للتاجر</div>
                      <div className="text-base font-black mt-0.5 font-mono">
                        {EGP(Math.max(0, viewingInvoice.total_amount - viewingInvoice.paid_amount))}
                      </div>
                    </div>

                    {/* RED: Expected Profit after Retail Sale */}
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                      <div className="font-bold text-[11px] text-red-700 dark:text-red-300">
                        الربح المتوقع بالقطاعي
                      </div>
                      <div className="text-base font-black mt-0.5 font-mono">
                        {EGP(viewingInvoiceStats?.totalExpectedProfit || 0)}
                      </div>
                      <div className="text-[9px] text-red-700/80 dark:text-red-300/80">
                        (بعد بيع كامل الوارد)
                      </div>
                    </div>

                    {/* Realized Profit from sold pieces */}
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      <div className="font-bold text-[11px]">الربح المحقق فعلياً</div>
                      <div className="text-base font-black mt-0.5 font-mono">
                        {EGP(viewingInvoiceStats?.totalRealizedProfit || 0)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        (من القطع المباعة حتى الآن)
                      </div>
                    </div>
                  </div>

                  {/* Stock Movement Overview Banner (Row 2) */}
                  {viewingInvoiceStats && (
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <Boxes className="size-4 text-primary" />
                        <span>موقف البضاعة بالفاتورة:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-semibold text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-background border border-border">
                          إجمالي الوارد: <strong className="text-primary font-mono">{viewingInvoiceStats.totalPieces}</strong> قطعة
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                          📦 بالمخزن (كرتونة): <strong className="font-mono">{viewingInvoiceStats.totalInCarton}</strong> قطعة
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                          🏪 مرصوص بالرف بالمحل: <strong className="font-mono">{viewingInvoiceStats.totalOnShelf}</strong> قطعة
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          ✅ تم بيعه: <strong className="font-mono">{viewingInvoiceStats.totalSold}</strong> قطعة ({viewingInvoiceStats.soldPercentage}%)
                        </span>
                      </div>
                    </div>
                  )}
                </DialogHeader>

                <div id="single-invoice-print" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Detailed Items Tracking Cards */}
                  <div className="space-y-4">
                    {viewingInvoice.items.map((it, idx) => {
                      const totalPieces = it.packageCount * it.itemsPerPackage;
                      const lineCost = it.packageCount * it.packageWholesalePrice;
                      const pieceWholesale = it.itemsPerPackage > 0 ? it.packageWholesalePrice / it.itemsPerPackage : 0;
                      const pieceRetail = it.pieceRetailPrice || 0;
                      const pieceProfit = Math.max(0, pieceRetail - pieceWholesale);
                      const itemExpectedProfit = (totalPieces * pieceRetail) - lineCost;

                      const displayed = Math.max(0, Math.min(totalPieces, Number(it.displayedPieces) || 0));
                      const sold = Math.max(0, Math.min(displayed, Number(it.soldPieces) || 0));
                      const inCarton = Math.max(0, totalPieces - displayed);
                      const onShelf = Math.max(0, displayed - sold);
                      const itemRealizedProfit = sold * pieceProfit;
                      const itemRemainingProfit = (totalPieces - sold) * pieceProfit;
                      const soldPct = totalPieces > 0 ? Math.round((sold / totalPieces) * 100) : 0;

                      return (
                        <div
                          key={it.id || idx}
                          className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors space-y-3"
                        >
                          {/* Item Header & Pricing */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="size-6 rounded-md bg-primary/10 text-primary font-bold text-xs grid place-items-center">
                                  {idx + 1}
                                </span>
                                <h4 className="text-sm font-black text-foreground">
                                  {it.name}
                                </h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground border border-border">
                                  {it.packageCount} {UNIT_LABELS[it.unitType] || it.unitType} ({it.itemsPerPackage} قطعة بالوحدة)
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 font-black text-primary">
                                  الإجمالي: {NUM(totalPieces)} قطعة
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 pt-0.5">
                                <span>شراء الوحدة جملة: <strong className="text-foreground font-mono">{EGP(it.packageWholesalePrice)}</strong></span>
                                <span>•</span>
                                <span>تكلفة القطعة جملة: <strong className="text-foreground font-mono">{EGP(pieceWholesale)}</strong></span>
                                <span>•</span>
                                <span>سعر بيع القطاعي: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{EGP(pieceRetail)}</strong></span>
                                <span>•</span>
                                <span>ربح القطعة: <strong className="text-foreground font-mono">{EGP(pieceProfit)}</strong></span>
                              </div>
                            </div>

                            {/* Prominent Red Profit Block for this item */}
                            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-3.5 py-2 rounded-xl text-center shrink-0">
                              <div>
                                <div className="text-[10px] font-bold text-red-700 dark:text-red-300">
                                  إجمالي الربح المتوقع بالقطاعي
                                </div>
                                <div className="text-base font-black text-red-600 dark:text-red-400 font-mono">
                                  {EGP(itemExpectedProfit)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tracking & Movement: Step 1 (Shelf Display) + Dedicated Page Link for Sales & Profits */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* STEP 1: المرصوص بالمحل أو كتابة الباقي مع الحساب التلقائي */}
                            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                  <Store className="size-4" />
                                  <span>1. المرصوص بالرف أو كتابة الباقي</span>
                                </span>
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                  حساب تلقائي ⚡
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                اكتب كمية <strong className="text-foreground">المرصوص</strong> أو اكتب <strong className="text-foreground">الباقي بالمخزن</strong> وسيقوم النظام بحساب الآخر وتسجيله تلقائياً.
                              </p>

                              {/* Two Synchronized Inputs */}
                              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                                {/* Input 1: المرصوص بالرف */}
                                <div className="p-2 rounded-xl bg-background border border-indigo-500/30 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                    <span>المرصوص بالرف:</span>
                                    <span className="text-[10px] font-mono text-muted-foreground">/{totalPieces} ق</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      disabled={displayed <= sold}
                                      onClick={() => handleUpdateItemDisplayed(it.id, displayed - 1)}
                                      className="size-7 rounded-md shrink-0"
                                      title="إنقاص المرصوص"
                                    >
                                      <Minus className="size-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={sold}
                                      max={totalPieces}
                                      value={displayed}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        handleUpdateItemDisplayed(it.id, val);
                                      }}
                                      className="h-7 text-center font-black text-xs font-mono text-indigo-600 dark:text-indigo-400"
                                      title="اكتب المرصوص وسيحسب الباقي تلقائياً"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      disabled={displayed >= totalPieces}
                                      onClick={() => handleUpdateItemDisplayed(it.id, displayed + 1)}
                                      className="size-7 rounded-md shrink-0"
                                      title="زيادة المرصوص"
                                    >
                                      <Plus className="size-3" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Input 2: الباقي غير المرصوص بالمخزن */}
                                <div className="p-2 rounded-xl bg-background border border-sky-500/30 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-sky-700 dark:text-sky-300">
                                    <span>الباقي (غير المرصوص):</span>
                                    <span className="text-[10px] font-mono text-muted-foreground">بالمخزن</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={Math.max(0, totalPieces - sold)}
                                      value={inCarton}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        handleUpdateItemInCarton(it.id, val);
                                      }}
                                      className="h-7 text-center font-bold text-xs font-mono text-sky-700 dark:text-sky-300"
                                      title="اكتب الباقي وسيحسب المرصوص تلقائياً ويسجله"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemDisplayed(it.id, totalPieces)}
                                      className="h-7 px-2 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 shrink-0"
                                      title="رص كل البضاعة بالرف (الباقي بالمخزن = 0)"
                                    >
                                      رص الكل
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* DEDICATED LINK: 2. ما تم بيعه & 3. الموقف المالي والأرباح */}
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <ShoppingCart className="size-4" />
                                  <span>2. ما تم بيعه و 3. الموقف المالي والأرباح</span>
                                </span>
                                <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10">
                                  {soldPct}% تم بيعه
                                </span>
                              </div>

                              <p className="text-[11px] text-muted-foreground">
                                يتم تسجيل الكميات المباعة ومتابعة الأرباح المحققة كاش في صفحة مخصصة مستقلة.
                              </p>

                              <div className="space-y-1.5 pt-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">ما تم بيعه حتى الآن:</span>
                                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                    {sold} من {displayed} قطعة معروضة
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">الربح المحقق كاش:</span>
                                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                    {EGP(itemRealizedProfit)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">متبقي على الرف للزبائن:</span>
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {onShelf} قطعة
                                  </span>
                                </div>
                              </div>

                              <Link to="/sales-tracking" search={{ invoiceId: viewingInvoice.id }} className="w-full pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="w-full h-8 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                                >
                                  <ShoppingCart className="size-3.5" />
                                  <span>الانتقال لتسجيل ما تم بيعه والأرباح لهذا الصنف ←</span>
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Printable Summary Table for single invoice */}
                  <div className="hidden print:block border border-border rounded-xl mt-4">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                        <tr>
                          <th className="py-2 px-2 text-start">الصنف</th>
                          <th className="py-2 px-2 text-center">الوحدة</th>
                          <th className="py-2 px-2 text-center">إجمالي القطع</th>
                          <th className="py-2 px-2 text-center">تكلفة جملة</th>
                          <th className="py-2 px-2 text-center">سعر قطاعي</th>
                          <th className="py-2 px-2 text-center text-red-600">الربح المتوقع بالقطاعي</th>
                          <th className="py-2 px-2 text-center">المرصوص بالرف</th>
                          <th className="py-2 px-2 text-center">المباع</th>
                          <th className="py-2 px-2 text-center">متبقي بالمخزن</th>
                          <th className="py-2 px-2 text-center">الربح المحقق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewingInvoice.items.map((it, idx) => {
                          const totalPieces = it.packageCount * it.itemsPerPackage;
                          const lineCost = it.packageCount * it.packageWholesalePrice;
                          const pieceWholesale = it.itemsPerPackage > 0 ? it.packageWholesalePrice / it.itemsPerPackage : 0;
                          const pieceRetail = it.pieceRetailPrice || 0;
                          const pieceProfit = Math.max(0, pieceRetail - pieceWholesale);
                          const itemExpectedProfit = (totalPieces * pieceRetail) - lineCost;
                          const displayed = it.displayedPieces || 0;
                          const sold = it.soldPieces || 0;
                          const inCarton = totalPieces - displayed;
                          const itemRealizedProfit = sold * pieceProfit;

                          return (
                            <tr key={idx}>
                              <td className="py-2 px-2 font-bold">{it.name}</td>
                              <td className="py-2 px-2 text-center">{UNIT_LABELS[it.unitType] || it.unitType}</td>
                              <td className="py-2 px-2 text-center font-bold">{totalPieces}</td>
                              <td className="py-2 px-2 text-center">{EGP(pieceWholesale)}</td>
                              <td className="py-2 px-2 text-center">{EGP(pieceRetail)}</td>
                              <td className="py-2 px-2 text-center font-bold text-red-600">{EGP(itemExpectedProfit)}</td>
                              <td className="py-2 px-2 text-center">{displayed}</td>
                              <td className="py-2 px-2 text-center font-bold">{sold}</td>
                              <td className="py-2 px-2 text-center">{inCarton}</td>
                              <td className="py-2 px-2 text-center font-bold text-emerald-600">{EGP(itemRealizedProfit)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteInvoice(viewingInvoice.id, viewingInvoice.supplier_name)}
                    className="text-xs text-destructive hover:bg-destructive/10 font-bold gap-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span>حذف هذه الفاتورة</span>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setViewingInvoice(null)}
                    className="h-9 px-6 rounded-xl text-xs font-bold"
                  >
                    تم / إغلاق
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
