import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listPurchases, addPurchase, createProduct, deletePurchase } from "@/lib/api";
import { EGP, NUM, todayISO, DATE_AR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, FileSpreadsheet, Printer, Info, Calculator, Filter, Calendar, User, Search, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, printElement } from "@/lib/export";

export const Route = createFileRoute("/purchases")({ component: PurchasesPage });

function PurchasesPage() {
  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const purchasesQ = useQuery({ queryKey: ["purchases-all"], queryFn: () => listPurchases() });
  const products = productsQ.data ?? [];
  const allPurchases = purchasesQ.data ?? [];
  const pmap = new Map(products.map((p) => [p.id, p]));

  // فلترة العرض فقط — لا تؤثر على كميات الأصناف أو أي بيانات
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const purchases = allPurchases.filter((p) => {
    if (filterFrom && p.purchase_date < filterFrom) return false;
    if (filterTo && p.purchase_date > filterTo) return false;
    return true;
  });
  const periodTotal = purchases.reduce((sum, p) => sum + Number(p.quantity) * Number(p.wholesale_price), 0);
  const periodQty = purchases.reduce((sum, p) => sum + Number(p.quantity), 0);

  // نافذة إجماليات الأصناف
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryFilterType, setSummaryFilterType] = useState<"all" | "date" | "supplier">("all");
  const [summaryDate, setSummaryDate] = useState(todayISO());
  const [summarySupplier, setSummarySupplier] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // قائمة الموردين والتواريخ المميزة
  const uniqueSuppliers = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPurchases) {
      if (p.supplier?.trim()) s.add(p.supplier.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allPurchases]);

  const uniqueDates = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPurchases) {
      if (p.purchase_date) s.add(p.purchase_date);
    }
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allPurchases]);

  // تجميع وحساب إجماليات الأصناف وفقاً للفلتر المختار
  const aggregatedSummary = useMemo(() => {
    let filtered = allPurchases;

    if (summaryFilterType === "date" && summaryDate) {
      filtered = filtered.filter((p) => p.purchase_date === summaryDate);
    } else if (summaryFilterType === "supplier" && summarySupplier) {
      filtered = filtered.filter((p) => (p.supplier?.trim() || "") === summarySupplier.trim());
    }

    const groupMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalQty: number;
        totalCost: number;
        entriesCount: number;
        suppliers: Set<string>;
        dates: Set<string>;
        records: Array<{
          id: string;
          date: string;
          qty: number;
          price: number;
          total: number;
          supplier: string;
        }>;
      }
    >();

    for (const p of filtered) {
      const prodName = pmap.get(p.product_id)?.name || "صنف غير معروف";
      const q = Number(p.quantity) || 0;
      const price = Number(p.wholesale_price) || 0;
      const cost = q * price;

      const existing = groupMap.get(p.product_id) || {
        productId: p.product_id,
        productName: prodName,
        totalQty: 0,
        totalCost: 0,
        entriesCount: 0,
        suppliers: new Set<string>(),
        dates: new Set<string>(),
        records: [],
      };

      existing.totalQty += q;
      existing.totalCost += cost;
      existing.entriesCount += 1;
      if (p.supplier?.trim()) existing.suppliers.add(p.supplier.trim());
      if (p.purchase_date) existing.dates.add(p.purchase_date);
      existing.records.push({
        id: p.id,
        date: p.purchase_date,
        qty: q,
        price: price,
        total: cost,
        supplier: p.supplier || "—",
      });

      groupMap.set(p.product_id, existing);
    }

    let result = Array.from(groupMap.values()).map((item) => ({
      ...item,
      avgPrice: item.totalQty > 0 ? item.totalCost / item.totalQty : 0,
    }));

    if (summarySearch.trim()) {
      const q = summarySearch.trim().toLowerCase();
      result = result.filter((item) => item.productName.toLowerCase().includes(q));
    }

    return result.sort((a, b) => b.totalCost - a.totalCost);
  }, [allPurchases, summaryFilterType, summaryDate, summarySupplier, summarySearch, pmap]);

  const summaryGrandQty = aggregatedSummary.reduce((s, i) => s + i.totalQty, 0);
  const summaryGrandCost = aggregatedSummary.reduce((s, i) => s + i.totalCost, 0);

  const [form, setForm] = useState({
    purchase_date: todayISO(),
    product_id: "",
    new_product_name: "",
    quantity: "",
    wholesale_price: "",
    retail_price: "",
    supplier: "",
  });
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const mut = useMutation({
    mutationFn: async () => {
      let productId = form.product_id;
      if (mode === "new") {
        if (!form.new_product_name.trim()) throw new Error("أدخل اسم الصنف الجديد");
        const wp = Number(form.wholesale_price);
        const rp = Number(form.retail_price);
        const created = await createProduct({
          name: form.new_product_name.trim(),
          quantity: 0,
          wholesale_price: wp,
          retail_price: rp || wp,
          low_stock_threshold: 5,
        });
        productId = created.id;
      }
      if (!productId) throw new Error("اختر الصنف");
      const q = Number(form.quantity);
      const w = Number(form.wholesale_price);
      if (!(q > 0)) throw new Error("الكمية يجب أن تكون أكبر من صفر");
      if (!(w > 0)) throw new Error("سعر الجملة يجب أن يكون أكبر من صفر");
      return addPurchase({
        purchase_date: form.purchase_date,
        product_id: productId,
        quantity: q,
        wholesale_price: w,
        supplier: form.supplier || null,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["purchases-all"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      if (res.priceChanged) {
        toast.success(
          `تم تحديث السعر بعد المتوسط: ${EGP(res.oldPrice)} → ${EGP(res.newPrice)}`,
          { description: "تم احتساب متوسط التكلفة المرجح وحفظ التعديل في سجل الأسعار.", duration: 7000 }
        );
      } else {
        toast.success("تمت إضافة الوارد بنجاح");
      }
      setForm({ ...form, quantity: "", new_product_name: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => {
      toast.success("تم حذف السجل");
      qc.invalidateQueries({ queryKey: ["purchases-all"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mut.mutate();
  }

  function exportExcel() {
    exportToExcel(
      purchases.map((p) => ({
        "التاريخ": p.purchase_date,
        "الصنف": pmap.get(p.product_id)?.name ?? "—",
        "العدد": Number(p.quantity),
        "سعر الجملة": Number(p.wholesale_price),
        "إجمالي الشراء": Number(p.quantity) * Number(p.wholesale_price),
        "جهة الشراء": p.supplier ?? "",
      })),
      `المضاف-${todayISO()}`
    );
  }

  return (
    <AppShell title="المضاف (الوارد)">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={onSubmit} className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-card space-y-3 no-print">
          <h3 className="font-bold mb-2">إضافة وارد جديد</h3>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("existing")} className={`flex-1 h-9 rounded-lg text-sm font-bold transition-colors ${mode === "existing" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>صنف موجود</button>
            <button type="button" onClick={() => setMode("new")} className={`flex-1 h-9 rounded-lg text-sm font-bold transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>صنف جديد</button>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">التاريخ</label>
            <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
          </div>

          {mode === "existing" ? (
            <div>
              <label className="text-xs font-bold block mb-1">الصنف</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required>
                <option value="">— اختر الصنف —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (المتاح: {NUM(Number(p.quantity))})</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold block mb-1">اسم الصنف الجديد</label>
                <input value={form.new_product_name} onChange={(e) => setForm({ ...form, new_product_name: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: كليوباترا" required />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">سعر القطاعي</label>
                <input type="number" step="0.01" value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: 55" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">العدد</label>
              <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">سعر الجملة</label>
              <input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">جهة الشراء</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: شركة كليوباترا للدخان" />
          </div>

          <Button type="submit" disabled={mut.isPending} className="w-full h-11 bg-gradient-primary text-white shadow-elevated">
            <Plus className="size-4 ms-1" />
            {mut.isPending ? "جارٍ الحفظ..." : "إضافة"}
          </Button>

          <div className="text-[11px] text-muted-foreground flex items-start gap-2 pt-2 border-t border-border">
            <Info className="size-3.5 shrink-0 mt-0.5" />
            <span>عند اختلاف سعر الجملة الجديد عن القديم، يحسب النظام تلقائياً متوسط التكلفة المرجح ويحدّث السعر، مع حفظ التعديل في سجل الأسعار.</span>
          </div>
        </form>

        {/* Table */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3 no-print">
            <h3 className="font-bold">سجل الوارد</h3>
            <span className="text-xs text-muted-foreground">({purchases.length} سجل)</span>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-[11px] font-bold block mb-0.5">من</label>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-0.5">إلى</label>
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </div>
              {(filterFrom || filterTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterFrom(""); setFilterTo(""); }}>إظهار الكل</Button>
              )}
            </div>
            <div className="ms-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSummaryFilterType("all");
                  setSummarySearch("");
                  setIsSummaryOpen(true);
                }}
                className="bg-primary/5 border-primary/30 text-primary hover:bg-primary/10 font-bold"
              >
                <Calculator className="size-4 ms-1" />
                إجماليات الأصناف
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-4 ms-1" />Excel</Button>
              <Button variant="outline" size="sm" onClick={() => printElement(document.getElementById("purch-print"))}><Printer className="size-4 ms-1" />طباعة</Button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-border flex flex-wrap gap-3">
            <div className="flex-1 min-w-36 rounded-xl bg-gradient-warning text-white p-3 shadow-card">
              <div className="text-[11px] opacity-90">إجمالي الوارد {(filterFrom || filterTo) ? "للفترة المحددة" : "(الكل)"}</div>
              <div className="text-lg font-extrabold">{EGP(periodTotal)}</div>
            </div>
            <div className="flex-1 min-w-36 rounded-xl bg-gradient-info text-white p-3 shadow-card">
              <div className="text-[11px] opacity-90">إجمالي العدد الوارد</div>
              <div className="text-lg font-extrabold">{NUM(periodQty)}</div>
            </div>
          </div>
          <div id="purch-print" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-right">التاريخ</th>
                  <th className="px-3 py-2.5 text-right">العدد</th>
                  <th className="px-3 py-2.5 text-right">الصنف</th>
                  <th className="px-3 py-2.5 text-right">سعر الجملة</th>
                  <th className="px-3 py-2.5 text-right">إجمالي الشراء</th>
                  <th className="px-3 py-2.5 text-right">جهة الشراء</th>
                  <th className="px-3 py-2.5 text-right no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap">{DATE_AR(p.purchase_date)}</td>
                    <td className="px-3 py-2 font-bold">{NUM(Number(p.quantity))}</td>
                    <td className="px-3 py-2">{pmap.get(p.product_id)?.name ?? "—"}</td>
                    <td className="px-3 py-2">{EGP(Number(p.wholesale_price))}</td>
                    <td className="px-3 py-2 font-bold">{EGP(Number(p.quantity) * Number(p.wholesale_price))}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.supplier ?? "—"}</td>
                    <td className="px-3 py-2 text-left no-print">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("هل تريد حذف هذا السجل؟")) delMut.mutate(p.id); }} aria-label="حذف">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">لا توجد سجلات وارد بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DIALOG: Product Totals Summary (إجماليات الأصناف المجمعة) */}
      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden" dir="rtl">
          <DialogHeader className="p-5 border-b border-border bg-card shrink-0 text-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    إجماليات الأصناف الواردة
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    تجميع الكميات والمبالغ الإجمالية لكل صنف على حدة حسب اليوم أو المورد
                  </DialogDescription>
                </div>
              </div>

              {/* Action Buttons in header */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printElement(document.getElementById("summary-print"))}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5"
                >
                  <Printer className="size-3.5" />
                  <span>طباعة</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportToExcel(
                      aggregatedSummary.map((item) => ({
                        "الصنف": item.productName,
                        "إجمالي العدد": item.totalQty,
                        "متوسط التكلفة للوحدة": Math.round(item.avgPrice * 100) / 100,
                        "إجمالي المبلغ (ج.م)": item.totalCost,
                        "عدد مرات الشراء": item.entriesCount,
                        "الموردون": Array.from(item.suppliers).join("، ") || "—",
                      })),
                      `اجماليات-الاصناف-${todayISO()}`
                    );
                  }}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span>Excel</span>
                </Button>
              </div>
            </div>

            {/* Filter Selector Options */}
            <div className="mt-4 pt-4 border-t border-border/70 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSummaryFilterType("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    summaryFilterType === "all"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  كافة السجلات
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryFilterType("date")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    summaryFilterType === "date"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="size-3.5" />
                  <span>حسب اليوم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryFilterType("supplier")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    summaryFilterType === "supplier"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="size-3.5" />
                  <span>حسب التاجر (المورد)</span>
                </button>
              </div>

              {/* Dynamic Filter Input */}
              {summaryFilterType === "date" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">اختر اليوم:</span>
                  <input
                    type="date"
                    value={summaryDate}
                    onChange={(e) => setSummaryDate(e.target.value)}
                    className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  />
                  {uniqueDates.length > 0 && (
                    <select
                      value={summaryDate}
                      onChange={(e) => setSummaryDate(e.target.value)}
                      className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs"
                    >
                      <option value="">— أيام بها وارد —</option>
                      {uniqueDates.map((d) => (
                        <option key={d} value={d}>
                          {DATE_AR(d)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {summaryFilterType === "supplier" && (
                <div className="flex items-center gap-2 flex-1 min-w-56">
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                    اختر التاجر:
                  </span>
                  <select
                    value={summarySupplier}
                    onChange={(e) => setSummarySupplier(e.target.value)}
                    className="h-9 flex-1 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  >
                    <option value="">— اختر جهة الشراء / التاجر —</option>
                    {uniqueSuppliers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search input inside modal */}
              <div className="relative ms-auto flex-1 max-w-xs">
                <Search className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث عن صنف..."
                  value={summarySearch}
                  onChange={(e) => setSummarySearch(e.target.value)}
                  className="w-full pr-8 h-9 rounded-xl border border-input bg-background text-xs font-semibold"
                />
              </div>
            </div>
          </DialogHeader>

          {/* Quick Stats Ribbon */}
          <div className="px-5 py-3 border-b border-border bg-muted/30 grid grid-cols-3 gap-3 shrink-0">
            <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs text-center">
              <div className="text-[11px] text-muted-foreground font-semibold">عدد الأصناف المجمعة</div>
              <div className="text-base font-extrabold text-foreground mt-0.5">
                {NUM(aggregatedSummary.length)} صنف
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs text-center">
              <div className="text-[11px] text-muted-foreground font-semibold">إجمالي عدد القطع</div>
              <div className="text-base font-extrabold text-primary mt-0.5">
                {NUM(summaryGrandQty)} قطعة
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs text-center">
              <div className="text-[11px] text-muted-foreground font-semibold">إجمالي المبلغ الكلي</div>
              <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {EGP(summaryGrandCost)}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div id="summary-print" className="flex-1 overflow-y-auto p-5">
            <div className="border border-border rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0 font-bold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 text-start">الصنف</th>
                    <th className="py-2.5 px-3 text-center">إجمالي العدد</th>
                    <th className="py-2.5 px-4 text-center">متوسط سعر الجملة</th>
                    <th className="py-2.5 px-4 text-center">إجمالي المبلغ الكلي</th>
                    <th className="py-2.5 px-3 text-center">عدد العمليات</th>
                    <th className="py-2.5 px-4 text-start">
                      {summaryFilterType === "supplier" ? "التواريخ" : "جهة الشراء / المورد"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {aggregatedSummary.map((item, idx) => {
                    const isExpanded = expandedProductId === item.productId;
                    return (
                      <React.Fragment key={item.productId}>
                        <tr
                          onClick={() => setExpandedProductId(isExpanded ? null : item.productId)}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-black grid place-items-center shrink-0">
                                {idx + 1}
                              </span>
                              <span>{item.productName}</span>
                              <span className="text-muted-foreground me-1 no-print">
                                {isExpanded ? <ChevronUp className="size-3.5 inline" /> : <ChevronDown className="size-3.5 inline" />}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-black text-xs">
                              {NUM(item.totalQty)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-foreground">
                            {EGP(item.avgPrice)}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-emerald-700 dark:text-emerald-300 text-sm">
                            {EGP(item.totalCost)}
                          </td>
                          <td className="py-3 px-3 text-center text-xs text-muted-foreground font-semibold">
                            {item.entriesCount} مرة
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                            {summaryFilterType === "supplier"
                              ? Array.from(item.dates).map((d) => DATE_AR(d)).join(" ، ") || "—"
                              : Array.from(item.suppliers).join(" ، ") || "—"}
                          </td>
                        </tr>

                        {/* تفاصيل العمليات الفردية عند الضغط على الصنف */}
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="p-3 px-6">
                              <div className="bg-card border border-border rounded-xl p-3 shadow-inner space-y-2">
                                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                  <span>تفاصيل حركات الشراء المسجلة لـ: {item.productName} ({item.records.length} حركة)</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    المجموع: {NUM(item.totalQty)} علبة بقيمة {EGP(item.totalCost)}
                                  </span>
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border text-muted-foreground">
                                      <th className="py-1 px-2 text-start">التاريخ</th>
                                      <th className="py-1 px-2 text-center">الكمية المسجلة</th>
                                      <th className="py-1 px-2 text-center">سعر الشراء المسجل</th>
                                      <th className="py-1 px-2 text-center">الإجمالي (الكمية × السعر)</th>
                                      <th className="py-1 px-2 text-start">جهة الشراء</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60">
                                    {item.records.map((r, rIdx) => (
                                      <tr key={r.id || rIdx} className="hover:bg-muted/40">
                                        <td className="py-1.5 px-2 font-semibold">{DATE_AR(r.date)}</td>
                                        <td className="py-1.5 px-2 text-center font-bold text-primary">{NUM(r.qty)}</td>
                                        <td className="py-1.5 px-2 text-center font-semibold text-foreground">{EGP(r.price)}</td>
                                        <td className="py-1.5 px-2 text-center font-bold text-emerald-700 dark:text-emerald-300">{EGP(r.total)}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground">{r.supplier}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {aggregatedSummary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        لا توجد أصناف تطابق الفلتر المحدد.
                      </td>
                    </tr>
                  )}
                </tbody>
                {aggregatedSummary.length > 0 && (
                  <tfoot className="bg-muted/70 font-black border-t-2 border-border text-foreground">
                    <tr>
                      <td className="py-3.5 px-4">الإجمالي الكلي</td>
                      <td className="py-3.5 px-3 text-center text-primary text-base">
                        {NUM(summaryGrandQty)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground text-xs">—</td>
                      <td className="py-3.5 px-4 text-center text-emerald-700 dark:text-emerald-300 text-base">
                        {EGP(summaryGrandCost)}
                      </td>
                      <td colSpan={2} className="py-3.5 px-4 text-xs text-muted-foreground">
                        إجمالي الأصناف المجمعة أعلاه
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              * تم تجميع كافة الأصناف المتكررة تلقائياً لحساب الإجمالي الكلي للكميات والمبالغ بدقة.
            </span>
            <Button
              variant="outline"
              onClick={() => setIsSummaryOpen(false)}
              className="h-9 rounded-xl text-xs font-bold"
            >
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
