import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { listProducts, listPurchases, type Product } from "@/lib/api";
import { EGP, NUM, DATE_AR } from "@/lib/format";
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
  Printer,
  RotateCcw,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  Search,
  Store,
  ShieldAlert,
  Copy,
  SlidersHorizontal,
  Check,
  GitCompare,
  ArrowLeftRight,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCustomSuppliers,
  saveCustomSupplier,
  deleteCustomSupplier,
  setSupplierProductPrice,
  type CustomSupplier,
} from "@/lib/customSuppliers";

export const Route = createFileRoute("/quotation")({
  head: () => ({
    meta: [
      { title: "بيان أسعار — الشوره ماركت" },
      { name: "description", content: "بيان أسعار الأصناف ومقارنة عروض أسعار الموردين الحقيقيين والتجريبيين." },
      { property: "og:title", content: "بيان أسعار — الشوره ماركت" },
      { property: "og:description", content: "احسب إجمالي طلبية المورد حسب أحدث الأسعار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotationPage,
});

function QuotationPage() {
  const purQ = useQuery({ queryKey: ["purchases-all"], queryFn: () => listPurchases() });
  const prodQ = useQuery({ queryKey: ["products"], queryFn: listProducts });

  // Custom (mock/experimental) suppliers list state
  const [customSuppliers, setCustomSuppliers] = useState<CustomSupplier[]>([]);

  useEffect(() => {
    setCustomSuppliers(getCustomSuppliers());
    const handler = () => setCustomSuppliers(getCustomSuppliers());
    window.addEventListener("custom-suppliers-updated", handler);
    return () => window.removeEventListener("custom-suppliers-updated", handler);
  }, []);

  // Selected supplier can be: "real:SUPPLIER_NAME" or "custom:SUPPLIER_ID"
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "priced" | "with_qty">("all");

  // Dialog state for adding/editing custom supplier
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<CustomSupplier | null>(null);
  const [supplierFormName, setSupplierFormName] = useState("");
  const [supplierFormNotes, setSupplierFormNotes] = useState("");
  const [supplierFormPhone, setSupplierFormPhone] = useState("");
  const [supplierFormPrices, setSupplierFormPrices] = useState<Record<string, string>>({});
  const [modalSearch, setModalSearch] = useState("");

  // Quick price edit state (on-the-fly inside quotation cards)
  const [inlinePriceTarget, setInlinePriceTarget] = useState<{ productId: string; productName: string; currentPrice: number } | null>(null);
  const [inlineNewPrice, setInlineNewPrice] = useState("");

  // Comparison State
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareKeyA, setCompareKeyA] = useState<string>("");
  const [compareKeyB, setCompareKeyB] = useState<string>("");

  // Real suppliers from purchases
  const realSuppliers = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of purQ.data ?? []) {
      const s = p.supplier?.trim();
      if (!s) continue;
      const key = p.purchase_date + p.created_at;
      if (!m.has(s) || key > m.get(s)!) m.set(s, key);
    }
    return Array.from(m.entries())
      .map(([name, k]) => ({ name, last: k.slice(0, 10) }))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [purQ.data]);

  // Helper to get prices for any supplier key
  const getSupplierPricesMap = (key: string) => {
    const map = new Map<string, number>();
    const products = prodQ.data ?? [];
    if (!key) return map;

    if (key.startsWith("custom:")) {
      const sup = customSuppliers.find((s) => `custom:${s.id}` === key);
      for (const p of products) {
        const has = sup && sup.prices[p.id] !== undefined;
        map.set(p.id, has ? Number(sup!.prices[p.id]) : Number(p.wholesale_price));
      }
    } else if (key.startsWith("real:")) {
      const supName = key.replace("real:", "");
      const latest = new Map<string, { price: number; key: string }>();
      for (const p of purQ.data ?? []) {
        if (p.supplier?.trim() !== supName) continue;
        const pKey = p.purchase_date + p.created_at;
        const cur = latest.get(p.product_id);
        if (!cur || pKey > cur.key) {
          latest.set(p.product_id, { price: Number(p.wholesale_price), key: pKey });
        }
      }
      for (const p of products) {
        const item = latest.get(p.id);
        map.set(p.id, item ? item.price : Number(p.wholesale_price));
      }
    }
    return map;
  };

  const getSupplierNameByKey = (key: string) => {
    if (!key) return "";
    if (key.startsWith("custom:")) {
      return customSuppliers.find((s) => `custom:${s.id}` === key)?.name || "مورد تجريبي";
    }
    return key.replace("real:", "");
  };

  // Selected supplier details
  const isCustom = selectedKey.startsWith("custom:");
  const selectedCustomSupplier = isCustom
    ? customSuppliers.find((s) => `custom:${s.id}` === selectedKey)
    : null;
  const selectedRealSupplierName = selectedKey.startsWith("real:")
    ? selectedKey.replace("real:", "")
    : "";

  const currentSupplierDisplayName = isCustom
    ? selectedCustomSupplier?.name || "مورد تجريبي"
    : selectedRealSupplierName;

  // Build items list according to selected supplier
  const items = useMemo(() => {
    if (!selectedKey) return [];
    const products = prodQ.data ?? [];

    if (isCustom && selectedCustomSupplier) {
      // Custom / Mock supplier prices
      return products
        .map((p) => {
          const hasCustom = selectedCustomSupplier.prices[p.id] !== undefined;
          const price = hasCustom
            ? Number(selectedCustomSupplier.prices[p.id])
            : Number(p.wholesale_price);
          return {
            id: p.id,
            name: p.name,
            price,
            fromSupplier: hasCustom,
            isCustomSupplier: true,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }

    if (!isCustom && selectedRealSupplierName) {
      // Real supplier from purchases
      const latest = new Map<string, { price: number; key: string }>();
      for (const p of purQ.data ?? []) {
        if (p.supplier?.trim() !== selectedRealSupplierName) continue;
        const key = p.purchase_date + p.created_at;
        const cur = latest.get(p.product_id);
        if (!cur || key > cur.key) {
          latest.set(p.product_id, { price: Number(p.wholesale_price), key });
        }
      }

      return products
        .map((p) => {
          const sup = latest.get(p.id);
          return {
            id: p.id,
            name: p.name,
            price: sup ? sup.price : Number(p.wholesale_price),
            fromSupplier: !!sup,
            isCustomSupplier: false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }

    return [];
  }, [selectedKey, isCustom, selectedCustomSupplier, selectedRealSupplierName, purQ.data, prodQ.data]);

  // Filtered items for display
  const displayedItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      if (filterMode === "priced" && !item.fromSupplier) {
        return false;
      }
      if (filterMode === "with_qty" && !(Number(qty[item.id]) > 0)) {
        return false;
      }
      return true;
    });
  }, [items, searchQuery, filterMode, qty]);

  const total = items.reduce((s, i) => s + (Number(qty[i.id]) || 0) * i.price, 0);
  const totalItemsCount = items.filter((i) => (Number(qty[i.id]) || 0) > 0).length;

  // Open modal to create a new custom supplier
  function openCreateModal() {
    setEditingSupplier(null);
    setSupplierFormName("");
    setSupplierFormNotes("");
    setSupplierFormPhone("");
    setSupplierFormPrices({});
    setModalSearch("");
    setIsEditorOpen(true);
  }

  // Open modal to edit existing custom supplier
  function openEditModal(sup: CustomSupplier) {
    setEditingSupplier(sup);
    setSupplierFormName(sup.name);
    setSupplierFormNotes(sup.notes || "");
    setSupplierFormPhone(sup.phone || "");
    const pricesStr: Record<string, string> = {};
    for (const [pid, val] of Object.entries(sup.prices)) {
      pricesStr[pid] = String(val);
    }
    setSupplierFormPrices(pricesStr);
    setModalSearch("");
    setIsEditorOpen(true);
  }

  // Save custom supplier
  function handleSaveSupplier() {
    if (!supplierFormName.trim()) {
      toast.error("يرجى إدخال اسم التاجر / المورد");
      return;
    }

    const pricesNum: Record<string, number> = {};
    for (const [pid, val] of Object.entries(supplierFormPrices)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        pricesNum[pid] = num;
      }
    }

    const saved = saveCustomSupplier({
      id: editingSupplier?.id,
      name: supplierFormName,
      phone: supplierFormPhone,
      notes: supplierFormNotes,
      prices: pricesNum,
    });

    toast.success(editingSupplier ? "تم تحديث بيانات وأسعار المورد" : "تمت إضافة المورد التجريبي بنجاح");
    setIsEditorOpen(false);
    setSelectedKey(`custom:${saved.id}`);
  }

  // Delete custom supplier
  function handleDeleteSupplier(sup: CustomSupplier) {
    if (!window.confirm(`هل أنت متأكد من حذف المورد التجريبي "${sup.name}" وجميع أسعاره المسجلة؟`)) {
      return;
    }
    deleteCustomSupplier(sup.id);
    if (selectedKey === `custom:${sup.id}`) {
      setSelectedKey("");
      setQty({});
    }
    toast.success("تم حذف المورد التجريبي بنجاح");
  }

  // Save inline price edit
  function handleSaveInlinePrice() {
    if (!inlinePriceTarget || !selectedCustomSupplier) return;
    const p = Number(inlineNewPrice);
    if (!Number.isFinite(p) || p <= 0) {
      toast.error("أدخل سعراً صحيحاً");
      return;
    }

    setSupplierProductPrice(selectedCustomSupplier.id, inlinePriceTarget.productId, p);
    toast.success(`تم تحديث سعر ${inlinePriceTarget.productName} لدى ${selectedCustomSupplier.name}`);
    setInlinePriceTarget(null);
    setInlineNewPrice("");
  }

  // Copy all current wholesale prices into modal
  function copyAllStorePricesToModal() {
    const products = prodQ.data ?? [];
    const copy: Record<string, string> = { ...supplierFormPrices };
    for (const p of products) {
      if (!copy[p.id] || copy[p.id] === "") {
        copy[p.id] = String(p.wholesale_price);
      }
    }
    setSupplierFormPrices(copy);
    toast.info("تم ملء أسعار الجملة الحالية لجميع الأصناف");
  }

  function shareWhatsApp() {
    const wanted = items.filter((i) => (Number(qty[i.id]) || 0) > 0);
    if (wanted.length === 0) {
      toast.error("اكتب الكمية المطلوبة من الأصناف أولاً");
      return;
    }
    const lines = wanted.map(
      (i) => `• ${i.name}\nالكمية: ${NUM(Number(qty[i.id]))} — السعر: ${EGP(i.price)} — الإجمالي: ${EGP((Number(qty[i.id]) || 0) * i.price)}`
    );
    const wantedTotal = wanted.reduce((s, i) => s + (Number(qty[i.id]) || 0) * i.price, 0);
    const headerPrefix = isCustom ? `[عرض أسعار تقديري / تاجر تجريبي]` : `[بيان أسعار]`;
    const msg = `*${headerPrefix}: ${currentSupplierDisplayName}*\n\n${lines.join("\n\n")}\n\n*إجمالي الطلبية: ${EGP(wantedTotal)}*`;
    window.open(`https://wa.me/201050815073?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function generateComparisonPDF(
    queriedItems: Array<{ id: string; name: string }>,
    nameA: string,
    nameB: string,
    mapA: Map<string, number>,
    mapB: Map<string, number>,
    sumA: number,
    sumB: number
  ) {
    if (queriedItems.length === 0) {
      toast.error("لا توجد أصناف محددة للمقارنة");
      return;
    }
    const diff = Math.abs(sumA - sumB);
    const winnerText =
      sumA === sumB
        ? "العرضان متطابقان تماماً في الإجمالي"
        : sumA < sumB
        ? `العرض الأفضل: ${nameA} (أوفر بمقدار ${EGP(diff)})`
        : `العرض الأفضل: ${nameB} (أوفر بمقدار ${EGP(diff)})`;

    const rowsHtml = queriedItems
      .map((it, idx) => {
        const count = Number(qty[it.id]) || 0;
        const pA = mapA.get(it.id) ?? 0;
        const pB = mapB.get(it.id) ?? 0;
        const totA = count * pA;
        const totB = count * pB;
        const isACheaper = pA < pB;
        const isBCheaper = pB < pA;
        const itemDiff = Math.abs(totA - totB);

        return `
          <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding:10px 12px; font-weight:700; border-bottom:1px solid #e2e8f0; color:#0f172a;">${it.name}</td>
            <td style="padding:10px 12px; text-align:center; font-weight:700; border-bottom:1px solid #e2e8f0; color:#475569;">${NUM(count)}</td>
            <td style="padding:10px 12px; text-align:center; border-bottom:1px solid #e2e8f0; background:${isACheaper ? "#eff6ff" : "transparent"};">
              <div style="font-weight:700; color:${isACheaper ? "#1d4ed8" : "#0f172a"};">${EGP(pA)}</div>
              <div style="font-size:11px; font-weight:800; color:#0f172a; margin-top:2px;">إجمالي: ${EGP(totA)}</div>
              ${isACheaper ? `<div style="font-size:10px; color:#16a34a; font-weight:800; margin-top:2px;">★ أوفر بـ ${EGP(itemDiff)}</div>` : ""}
            </td>
            <td style="padding:10px 12px; text-align:center; border-bottom:1px solid #e2e8f0; background:${isBCheaper ? "#ecfdf5" : "transparent"};">
              <div style="font-weight:700; color:${isBCheaper ? "#047857" : "#0f172a"};">${EGP(pB)}</div>
              <div style="font-size:11px; font-weight:800; color:#0f172a; margin-top:2px;">إجمالي: ${EGP(totB)}</div>
              ${isBCheaper ? `<div style="font-size:10px; color:#16a34a; font-weight:800; margin-top:2px;">★ أوفر بـ ${EGP(itemDiff)}</div>` : ""}
            </td>
          </tr>
        `;
      })
      .join("");

    const printWin = window.open("", "_blank", "width=950,height=800");
    if (!printWin) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لإنشاء ملف الـ PDF");
      return;
    }

    const todayDate = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    printWin.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>مقارنة_أسعار_${nameA}_و_${nameB}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 20px;
              direction: rtl;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #94a3b8;
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
            }
            .header p {
              margin: 4px 0 0;
              font-size: 13px;
              color: #64748b;
            }
            .vs-banner {
              display: flex;
              gap: 16px;
              margin-bottom: 20px;
            }
            .sup-card {
              flex: 1;
              padding: 14px;
              border-radius: 12px;
              text-align: center;
            }
            .sup-card.a {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              color: #1e40af;
            }
            .sup-card.b {
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              color: #065f46;
            }
            .sup-title {
              font-size: 12px;
              font-weight: bold;
              opacity: 0.8;
            }
            .sup-name {
              font-size: 16px;
              font-weight: 900;
              margin: 4px 0;
            }
            .sup-total {
              font-size: 20px;
              font-weight: 900;
              font-family: monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
              margin-bottom: 20px;
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              overflow: hidden;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              padding: 12px;
              font-weight: 800;
            }
            .winner-box {
              background: #f1f5f9;
              border: 1.5px solid #cbd5e1;
              border-radius: 12px;
              padding: 14px;
              text-align: center;
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
            }
            .footer {
              margin-top: 25px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>الشوره ماركت — كشف مقارنة عروض أسعار</h1>
            <p>تاريخ التقرير: ${todayDate} — عدد الأصناف المقارنة: ${queriedItems.length} صنف</p>
          </div>

          <div class="vs-banner">
            <div class="sup-card a">
              <div class="sup-title">التاجر الأول (أ)</div>
              <div class="sup-name">${nameA}</div>
              <div class="sup-total">${EGP(sumA)}</div>
            </div>
            <div class="sup-card b">
              <div class="sup-title">التاجر الثاني (ب)</div>
              <div class="sup-name">${nameB}</div>
              <div class="sup-total">${EGP(sumB)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align:right;">الصنف</th>
                <th style="width:70px; text-align:center;">الكمية</th>
                <th style="width:200px; text-align:center; background:#1e3a8a;">عرض: ${nameA}</th>
                <th style="width:200px; text-align:center; background:#064e3b;">عرض: ${nameB}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc; font-weight:900;">
                <td colspan="2" style="padding:14px; font-size:14px; border-top:2px solid #cbd5e1;">إجمالي الطلبية</td>
                <td style="padding:14px; text-align:center; font-size:16px; border-top:2px solid #cbd5e1; color:#1e40af; font-family:monospace;">
                  ${EGP(sumA)}
                </td>
                <td style="padding:14px; text-align:center; font-size:16px; border-top:2px solid #cbd5e1; color:#065f46; font-family:monospace;">
                  ${EGP(sumB)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="winner-box">
            🏆 ${winnerText}
          </div>

          <div class="footer">
            تم استخراج هذا التقرير آلياً من نظام إدارة الشوره ماركت
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  return (
    <AppShell title="بيان أسعار">
      <div className="space-y-6 animate-fade-in">
        {/* Main Controls & Selection Toolbar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card no-print space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Store className="size-5 text-primary" />
                <span>اختيار المورد وإعداد بيان الأسعار</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                اختر مورداً حقيقياً من واقع المشتريات أو مورداً تجريبياً بأسعار مخصصة (تسمع هنا فقط)
              </p>
            </div>

            {/* Red Action: Add / Manage Custom Mock Suppliers */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={openCreateModal}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm shadow-rose-600/30 gap-1.5"
              >
                <Plus className="size-4" />
                <span>+ إضافة مورد تجريبي وأسعاره</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border/70">
            {/* Supplier Selector Dropdown */}
            <div className="flex-1 min-w-72">
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
                المورد / التاجر المطلوب
              </label>
              <select
                value={selectedKey}
                onChange={(e) => {
                  setSelectedKey(e.target.value);
                  setQty({});
                }}
                className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-sm font-semibold transition-all text-foreground"
              >
                <option value="">— اختر المورد لعرض الأسعار —</option>

                {/* Custom / Mock Suppliers Group (in RED) */}
                {customSuppliers.length > 0 && (
                  <optgroup label="🔴 موردون تجريبيون (أسعار مسجلة لبيان الأسعار فقط)">
                    {customSuppliers.map((s) => {
                      const count = Object.keys(s.prices).length;
                      return (
                        <option
                          key={`custom:${s.id}`}
                          value={`custom:${s.id}`}
                          className="text-rose-600 font-bold"
                        >
                          🔴 {s.name} (مورد تجريبي — {count} صنف مسعر)
                        </option>
                      );
                    })}
                  </optgroup>
                )}

                {/* Real Suppliers Group */}
                <optgroup label="الموردون الحقيقيون (من سجل الوارد والمشتريات)">
                  {realSuppliers.map((s) => (
                    <option key={`real:${s.name}`} value={`real:${s.name}`}>
                      {s.name} (آخر شراء {DATE_AR(s.last)})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <Button
              variant="outline"
              onClick={() => setQty({})}
              disabled={!selectedKey}
              className="h-11 rounded-xl text-xs font-bold gap-1.5"
            >
              <RotateCcw className="size-4" />
              <span>تصفير الكميات</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              disabled={!selectedKey}
              className="h-11 rounded-xl text-xs font-bold gap-1.5"
            >
              <Printer className="size-4" />
              <span>طباعة</span>
            </Button>

            {/* Compare Button */}
            <Button
              variant="outline"
              onClick={() => {
                setCompareKeyA(selectedKey);
                // Set initial B to another supplier if available
                const other = realSuppliers.find((s) => `real:${s.name}` !== selectedKey)?.name;
                if (other) {
                  setCompareKeyB(`real:${other}`);
                } else if (customSuppliers.length > 0 && `custom:${customSuppliers[0].id}` !== selectedKey) {
                  setCompareKeyB(`custom:${customSuppliers[0].id}`);
                }
                setIsCompareOpen(true);
              }}
              disabled={!selectedKey}
              className="h-11 rounded-xl text-xs font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <GitCompare className="size-4" />
              <span>مقارنة موردين</span>
            </Button>

            <Button
              onClick={shareWhatsApp}
              disabled={!selectedKey}
              className="h-11 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <MessageCircle className="size-4" />
              <span>مشاركة واتساب</span>
            </Button>
          </div>
        </div>

        {/* ALERT BANNER for Custom / Mock Supplier */}
        {isCustom && selectedCustomSupplier && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="size-10 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-foreground">
                    مورد تجريبي: <span className="text-rose-600 dark:text-rose-400">{selectedCustomSupplier.name}</span>
                  </span>
                  <span className="inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                    بيان أسعار فقط
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  هذا المورد مخصص لبيان الأسعار والمقارنة فقط (داتا تجريبية) — لا يظهر في الوارد أو الحسابات.
                  {selectedCustomSupplier.notes && ` (ملاحظة: ${selectedCustomSupplier.notes})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditModal(selectedCustomSupplier)}
                className="h-8 border-border hover:bg-muted text-xs font-bold gap-1.5"
              >
                <Pencil className="size-3.5" />
                <span>تعديل أسعار هذا المورد</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteSupplier(selectedCustomSupplier)}
                className="h-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 text-xs font-bold"
                title="حذف هذا المورد"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Content Section */}
        {!selectedKey ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center space-y-4">
            <div className="size-16 rounded-3xl bg-muted mx-auto grid place-items-center text-muted-foreground">
              <Store className="size-8 opacity-60" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-foreground">لم يتم اختيار أي مورد بعد</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                اختر مورداً من القائمة أعلاه لعرض أسعار الأصناف وحساب الطلبيات، أو أضف مورداً تجريبياً جديداً باللون الأحمر.
              </p>
            </div>
            {customSuppliers.length > 0 && (
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <span className="text-xs text-muted-foreground block w-full mb-1">
                  الموردون التجريبيون المتاحون حالياً:
                </span>
                {customSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedKey(`custom:${s.id}`);
                      setQty({});
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors"
                  >
                    <span>🔴 {s.name}</span>
                    <span className="text-[10px] opacity-75">({Object.keys(s.prices).length} صنف)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="ابحث عن صنف بالاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 h-10 rounded-xl text-xs bg-card"
                />
              </div>

              {/* View Filters */}
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterMode === "all"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  الكل ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("priced")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterMode === "priced"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  المسعرة فقط ({items.filter((i) => i.fromSupplier).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("with_qty")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterMode === "with_qty"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  المحددة بالطلبية ({totalItemsCount})
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedItems.map((i) => {
                const itemQty = Number(qty[i.id]) || 0;
                const lineTotal = itemQty * i.price;
                const hasCustomPrice = i.fromSupplier;

                return (
                  <div
                    key={i.id}
                    className={`rounded-2xl border p-4 shadow-card space-y-3 transition-all duration-200 ${
                      itemQty > 0
                        ? "border-primary/60 bg-card ring-1 ring-primary/30"
                        : "border-border/80 bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-extrabold text-sm text-foreground leading-tight">
                        {i.name}
                      </div>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => {
                            setInlinePriceTarget({
                              productId: i.id,
                              productName: i.name,
                              currentPrice: i.price,
                            });
                            setInlineNewPrice(String(i.price));
                          }}
                          className="size-7 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center transition-colors shrink-0"
                          title="تعديل السعر لهذا المورد"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">سعر الشراء:</span>
                        <span className="text-base font-extrabold text-foreground">
                          {EGP(i.price)}
                        </span>
                      </div>

                      {isCustom ? (
                        hasCustomPrice ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            🔴 سعر مسجل للتاجر
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground font-medium">
                            سعر الجملة بالمحل (لم يحدد سعر خاص)
                          </div>
                        )
                      ) : (
                        !i.fromSupplier && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            لم يُشترَ من هذا المورد — السعر الحالي
                          </div>
                        )
                      )}
                    </div>

                    {/* Quantity Input */}
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        الكمية المطلوبة
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        value={qty[i.id] ?? ""}
                        onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                        className="h-10 text-sm font-bold rounded-xl"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs flex items-center justify-between border border-border/60">
                      <span className="text-muted-foreground font-medium">الإجمالي</span>
                      <span className="font-extrabold text-foreground text-sm">
                        {EGP(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {displayedItems.length === 0 && (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-card">
                لا توجد أصناف مطابقة لبحثك في هذا العرض
              </div>
            )}

            {/* Sticky Grand Total Card */}
            <div className="rounded-3xl p-6 lg:p-7 shadow-elevated flex flex-col sm:flex-row items-center justify-between gap-4 text-white bg-gradient-primary">
              <div className="space-y-1 text-center sm:text-start">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20">
                    {isCustom ? "🔴 مورد تجريبي" : "مورد حقيقي"}
                  </span>
                  <span className="text-xs text-white/80">
                    {totalItemsCount} صنف في الطلبية
                  </span>
                </div>
                <h3 className="text-xl lg:text-2xl font-black">
                  إجمالي بيان أسعار: {currentSupplierDisplayName}
                </h3>
              </div>

              <div className="text-center sm:text-end shrink-0">
                <div className="text-3xl lg:text-4xl font-black tracking-tight">
                  {EGP(total)}
                </div>
                <div className="text-xs text-white/80 mt-1">
                  شامل كافة الأصناف المحددة أعلاه
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG: Add / Edit Custom Mock Supplier & Prices */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-3xl" dir="rtl">
            <DialogHeader className="border-b border-border/80 pb-4 text-start">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-rose-500/15 text-rose-600 grid place-items-center font-bold">
                  <Store className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    {editingSupplier ? "تعديل مورد تجريبي وأسعاره" : "إضافة مورد (تاجر) تجريبي جديد"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    هذه البيانات تظهر وتعمل <strong>فى صفحة بيان الأسعار فقط</strong> ولا تؤثر على المخزون أو تقارير الوارد والأرباح.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1">
              {/* Basic Supplier Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-rose-500/5 border border-rose-500/20 p-4 rounded-2xl">
                <div>
                  <label className="block text-xs font-extrabold text-foreground mb-1.5">
                    اسم المورد / التاجر <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="مثال: تاجر جملة المنصورة، مورد ألبان..."
                    value={supplierFormName}
                    onChange={(e) => setSupplierFormName(e.target.value)}
                    className="h-10 text-sm font-bold rounded-xl bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-foreground mb-1.5">
                    رقم الهاتف / وسيلة التواصل (اختياري)
                  </label>
                  <Input
                    type="text"
                    placeholder="مثال: 01012345678"
                    value={supplierFormPhone}
                    onChange={(e) => setSupplierFormPhone(e.target.value)}
                    className="h-10 text-sm rounded-xl bg-background"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-foreground mb-1.5">
                    ملاحظات عن هذا المورد (اختياري)
                  </label>
                  <Input
                    type="text"
                    placeholder="مثال: أسعار تجريبية للمقارنة، كشف أسعار خاص بشهر أكتوبر..."
                    value={supplierFormNotes}
                    onChange={(e) => setSupplierFormNotes(e.target.value)}
                    className="h-10 text-sm rounded-xl bg-background"
                  />
                </div>
              </div>

              {/* Product Pricing Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                      <SlidersHorizontal className="size-4 text-rose-600" />
                      <span>قائمة أسعار الأصناف وفقاً لهذا المورد</span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      حدد سعر الشراء لدى هذا التاجر لكل صنف. (الصنف غير المسعر سيستخدم سعر جملة المحل الافتراضي)
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyAllStorePricesToModal}
                    className="text-xs font-bold gap-1.5 h-8 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 self-start sm:self-auto"
                  >
                    <Copy className="size-3.5" />
                    <span>نسخ كل أسعار جملة المحل الحالية</span>
                  </Button>
                </div>

                {/* Filter / Search inside modal */}
                <div className="relative">
                  <Search className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="ابحث عن صنف لتحديد سعره..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="pr-9 h-9 text-xs rounded-xl bg-muted/40"
                  />
                </div>

                {/* Products Table */}
                <div className="border border-border rounded-2xl overflow-hidden max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground sticky top-0 font-bold border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-start">الصنف</th>
                        <th className="py-2.5 px-3 text-start">سعر جملة المحل</th>
                        <th className="py-2.5 px-3 text-start w-36">سعر هذا المورد (ج.م)</th>
                        <th className="py-2.5 px-3 text-center w-20">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(prodQ.data ?? [])
                        .filter((p) =>
                          modalSearch.trim()
                            ? p.name.toLowerCase().includes(modalSearch.trim().toLowerCase())
                            : true
                        )
                        .map((p) => {
                          const val = supplierFormPrices[p.id] ?? "";
                          const isCustomized = val !== "";

                          return (
                            <tr
                              key={p.id}
                              className={`transition-colors ${
                                isCustomized ? "bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-muted/40"
                              }`}
                            >
                              <td className="py-2 px-3 font-bold text-foreground">
                                {p.name}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground font-semibold">
                                {EGP(Number(p.wholesale_price))}
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  placeholder={String(p.wholesale_price)}
                                  value={val}
                                  onChange={(e) =>
                                    setSupplierFormPrices((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  className={`h-8 text-xs font-bold rounded-lg ${
                                    isCustomized
                                      ? "border-rose-400 text-rose-600 dark:text-rose-400 font-extrabold"
                                      : ""
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSupplierFormPrices((prev) => ({
                                      ...prev,
                                      [p.id]: String(p.wholesale_price),
                                    }))
                                  }
                                  className="text-[11px] font-bold text-primary hover:underline"
                                  title="نسخ سعر المحل"
                                >
                                  نسخ
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                  <span>
                    عدد الأصناف المسعرة:{" "}
                    <strong className="text-rose-600 font-bold">
                      {Object.values(supplierFormPrices).filter((v) => v !== "").length}
                    </strong>{" "}
                    من إجمالي {(prodQ.data ?? []).length} صنف
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/80 pt-4 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsEditorOpen(false)}
                className="h-10 rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveSupplier}
                className="h-10 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              >
                <Check className="size-4" />
                <span>حفظ المورد التجريبي والأسعار</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: Quick Inline Price Edit for a single item */}
        <Dialog
          open={!!inlinePriceTarget}
          onOpenChange={(open) => !open && setInlinePriceTarget(null)}
        >
          <DialogContent className="max-w-md p-6 rounded-3xl" dir="rtl">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-black text-foreground">
                تعديل سعر الصنف لدى {selectedCustomSupplier?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تعديل مباشر لسعر الشراء التجريبي لهذا الصنف فقط.
              </DialogDescription>
            </DialogHeader>

            {inlinePriceTarget && (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-2xl bg-muted/60 border border-border space-y-1">
                  <div className="font-extrabold text-sm text-foreground">
                    {inlinePriceTarget.productName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    السعر الحالي المسجل: <span className="font-bold text-foreground">{EGP(inlinePriceTarget.currentPrice)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-foreground mb-1.5">
                    السعر الجديد لهذا المورد (ج.م)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    autoFocus
                    value={inlineNewPrice}
                    onChange={(e) => setInlineNewPrice(e.target.value)}
                    className="h-11 text-base font-extrabold rounded-xl border-rose-400"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setInlinePriceTarget(null)}
                className="h-10 rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveInlinePrice}
                className="h-10 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                حفظ السعر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: Receipt Comparison Between Two Suppliers */}
        <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden" dir="rtl">
            <DialogHeader className="p-5 border-b border-border bg-muted/40 text-start">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <GitCompare className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-foreground">
                    مقارنة أسعار موردين (ورقة ريسيت)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    مقارنة الأصناف التي تم الاستعلام عنها وتحديد كميات لها فقط بين تاجرين
                  </DialogDescription>
                </div>
              </div>

              {/* Supplier Selection for Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-border/60">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    التاجر الأول (أ):
                  </label>
                  <select
                    value={compareKeyA}
                    onChange={(e) => setCompareKeyA(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                  >
                    <option value="">— اختر التاجر الأول —</option>
                    {customSuppliers.length > 0 && (
                      <optgroup label="🔴 موردون تجريبيون">
                        {customSuppliers.map((s) => (
                          <option key={`cmpA:${s.id}`} value={`custom:${s.id}`} className="text-rose-600">
                            🔴 {s.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="الموردون الحقيقيون">
                      {realSuppliers.map((s) => (
                        <option key={`cmpA:${s.name}`} value={`real:${s.name}`}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    التاجر الثاني (ب):
                  </label>
                  <select
                    value={compareKeyB}
                    onChange={(e) => setCompareKeyB(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                  >
                    <option value="">— اختر التاجر الثاني —</option>
                    {customSuppliers.length > 0 && (
                      <optgroup label="🔴 موردون تجريبيون">
                        {customSuppliers.map((s) => (
                          <option key={`cmpB:${s.id}`} value={`custom:${s.id}`} className="text-rose-600">
                            🔴 {s.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="الموردون الحقيقيون">
                      {realSuppliers.map((s) => (
                        <option key={`cmpB:${s.name}`} value={`real:${s.name}`}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </DialogHeader>

            {/* Receipt Body & Footer */}
            {(() => {
              // Only items with quantity entered (queried items)
              const queriedItems = items.filter((i) => (Number(qty[i.id]) || 0) > 0);
              const mapA = getSupplierPricesMap(compareKeyA);
              const mapB = getSupplierPricesMap(compareKeyB);
              const nameA = getSupplierNameByKey(compareKeyA);
              const nameB = getSupplierNameByKey(compareKeyB);

              let sumA = 0;
              let sumB = 0;

              queriedItems.forEach((it) => {
                const count = Number(qty[it.id]) || 0;
                const pA = mapA.get(it.id) ?? it.price;
                const pB = mapB.get(it.id) ?? it.price;
                sumA += count * pA;
                sumB += count * pB;
              });

              const diff = Math.abs(sumA - sumB);
              const winner = sumA < sumB ? "A" : sumB < sumA ? "B" : "EQUAL";

              return (
                <>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-mono text-xs">
                    {queriedItems.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground space-y-2">
                        <p className="font-bold text-sm text-foreground">لم يتم تحديد كميات لأي صنف بعد</p>
                        <p className="text-xs">قم بإدخال الكمية المطلوبة أمام الأصناف في الصفحة أولاً ثم اضغط مقارنة.</p>
                      </div>
                    ) : !compareKeyA || !compareKeyB ? (
                      <div className="p-8 text-center text-muted-foreground text-xs font-semibold">
                        اختر التاجرين (أ) و (ب) من القائمة بالأعلى لعرض ورقة المقارنة
                      </div>
                    ) : (
                      /* Receipt Paper Container */
                      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4 sm:p-5 shadow-inner space-y-4">
                        {/* Header receipt info */}
                        <div className="text-center pb-3 border-b border-dashed border-border">
                          <div className="font-black text-sm tracking-wide text-foreground">
                            الشوره ماركت — كشف مقارنة عروض أسعار
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            عدد الأصناف المستعلم عنها: {queriedItems.length} صنف
                          </div>
                        </div>

                        {/* Split Columns Header */}
                        <div className="grid grid-cols-2 gap-2 text-center pb-2 border-b border-border font-sans font-bold">
                          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            {compareKeyA.startsWith("custom:") ? "🔴 " : ""}
                            {nameA}
                          </div>
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            {compareKeyB.startsWith("custom:") ? "🔴 " : ""}
                            {nameB}
                          </div>
                        </div>

                        {/* Receipt Items List */}
                        <div className="divide-y divide-dashed divide-border/80">
                          {queriedItems.map((it) => {
                            const count = Number(qty[it.id]) || 0;
                            const pA = mapA.get(it.id) ?? it.price;
                            const pB = mapB.get(it.id) ?? it.price;
                            const totA = count * pA;
                            const totB = count * pB;
                            const isACheaper = pA < pB;
                            const isBCheaper = pB < pA;

                            return (
                              <div key={it.id} className="py-2.5 space-y-1.5 font-sans">
                                <div className="flex items-center justify-between font-extrabold text-foreground text-xs">
                                  <span>{it.name}</span>
                                  <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted">
                                    الكمية: {NUM(count)}
                                  </span>
                                </div>

                                {/* Two columns comparison for this item */}
                                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                                  {/* Supplier A side */}
                                  <div
                                    className={`p-2 rounded-lg border ${
                                      isACheaper
                                        ? "bg-blue-500/10 border-blue-400 text-blue-800 dark:text-blue-200 font-bold"
                                        : "bg-muted/30 border-border text-foreground"
                                    }`}
                                  >
                                    <div className="flex justify-between">
                                      <span className="text-[10px] text-muted-foreground">السعر:</span>
                                      <span>{EGP(pA)}</span>
                                    </div>
                                    <div className="flex justify-between font-extrabold pt-0.5 border-t border-border/40 mt-1">
                                      <span>الإجمالي:</span>
                                      <span>{EGP(totA)}</span>
                                    </div>
                                    {isACheaper && (
                                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5 text-center">
                                        ★ أرخص بـ {EGP(totB - totA)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Supplier B side */}
                                  <div
                                    className={`p-2 rounded-lg border ${
                                      isBCheaper
                                        ? "bg-emerald-500/10 border-emerald-400 text-emerald-800 dark:text-emerald-200 font-bold"
                                        : "bg-muted/30 border-border text-foreground"
                                    }`}
                                  >
                                    <div className="flex justify-between">
                                      <span className="text-[10px] text-muted-foreground">السعر:</span>
                                      <span>{EGP(pB)}</span>
                                    </div>
                                    <div className="flex justify-between font-extrabold pt-0.5 border-t border-border/40 mt-1">
                                      <span>الإجمالي:</span>
                                      <span>{EGP(totB)}</span>
                                    </div>
                                    {isBCheaper && (
                                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5 text-center">
                                        ★ أرخص بـ {EGP(totA - totB)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Receipt Grand Totals */}
                        <div className="pt-3 border-t-2 border-dashed border-border space-y-3 font-sans">
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-400/50">
                              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold">
                                إجمالي طلبية {nameA}
                              </div>
                              <div className="text-base font-black font-mono text-blue-800 dark:text-blue-200 mt-0.5">
                                {EGP(sumA)}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/50">
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                                إجمالي طلبية {nameB}
                              </div>
                              <div className="text-base font-black font-mono text-emerald-800 dark:text-emerald-200 mt-0.5">
                                {EGP(sumB)}
                              </div>
                            </div>
                          </div>

                          {/* Summary result badge */}
                          <div className="p-2.5 rounded-xl text-center font-bold text-xs bg-muted border border-border">
                            {winner === "EQUAL" ? (
                              <span>العرضان متطابقان تماماً في الإجمالي!</span>
                            ) : winner === "A" ? (
                              <span className="text-blue-700 dark:text-blue-300">
                                🏆 العرض الأفضل: <strong>{nameA}</strong> أرخص بمقدار{" "}
                                <strong>{EGP(diff)}</strong>
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                🏆 العرض الأفضل: <strong>{nameB}</strong> أرخص بمقدار{" "}
                                <strong>{EGP(diff)}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="p-4 border-t border-border bg-muted/20 gap-2 sm:gap-0">
                    <Button
                      onClick={() =>
                        generateComparisonPDF(
                          queriedItems,
                          nameA,
                          nameB,
                          mapA,
                          mapB,
                          sumA,
                          sumB
                        )
                      }
                      disabled={queriedItems.length === 0 || !compareKeyA || !compareKeyB}
                      className="h-10 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    >
                      <FileDown className="size-4" />
                      <span>تنزيل المقارنة PDF</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCompareOpen(false)}
                      className="h-10 rounded-xl text-xs font-bold"
                    >
                      إغلاق
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
