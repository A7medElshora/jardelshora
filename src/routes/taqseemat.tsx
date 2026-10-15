import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { EGP, NUM, DATE_AR, todayISO } from "@/lib/format";
import { Cigarette, ShoppingBasket, Wallet, Layers, Plus, Trash2, Save, ChevronRight, ChevronLeft, X, Pencil, PiggyBank, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/taqseemat")({
  head: () => ({
    meta: [
      { title: "تقسيمات — الشوره ماركت" },
      { name: "description", content: "تقسيم الإيرادات اليومية: سجاير، مبيعات، أرباح، ومنصرفات." },
      { property: "og:title", content: "تقسيمات — الشوره ماركت" },
      { property: "og:description", content: "تقسيم الإيرادات اليومية: سجاير، مبيعات، أرباح، ومنصرفات." },
    ],
  }),
  component: TaqseematPage,
});

type ManualSale = { id: string; sale_date: string; amount: number };
type Withdrawal = { id: string; entry_date: string; kind: "cigarettes" | "sales"; amount: number; note: string | null };
type CigSale = { id: string; sale_date: string; retail_total: number };
type ProfitW = { id: string; profit_date: string; taken_amount: number };

async function listManualSales(): Promise<ManualSale[]> {
  const { data, error } = await supabase.from("manual_sales").select("*").order("sale_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManualSale[];
}

async function listCigSales(): Promise<CigSale[]> {
  const { data, error } = await supabase.from("cigarette_sales").select("id, sale_date, retail_total");
  if (error) throw error;
  return (data ?? []) as CigSale[];
}

async function listWithdrawals(): Promise<Withdrawal[]> {
  const { data, error } = await supabase.from("taqseemat_withdrawals").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Withdrawal[];
}

async function listTaqseematProfits(): Promise<ProfitW[]> {
  const { data, error } = await (supabase as any).from("taqseemat_profits").select("id, profit_date, amount");
  if (error) throw error;
  return ((data ?? []) as any[]).map((x) => ({ id: x.id, profit_date: x.profit_date, taken_amount: x.amount }));
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function monthKey(d: string) {
  return d.slice(0, 7); // YYYY-MM
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS_AR[Number(m) - 1]} ${y}`;
}
function currentMonthKey() {
  return todayISO().slice(0, 7);
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function TaqseematPage() {
  const qc = useQueryClient();
  const [sDate, setSDate] = useState(todayISO());
  const [sAmount, setSAmount] = useState("");
  const [cDate, setCDate] = useState(todayISO());
  const [cAmount, setCAmount] = useState("");
  const [wDate, setWDate] = useState(todayISO());
  const [wKind, setWKind] = useState<"cigarettes" | "sales">("sales");
  const [wAmount, setWAmount] = useState("");
  const [wNote, setWNote] = useState("");
  const [pDate, setPDate] = useState(todayISO());
  const [pAmount, setPAmount] = useState("");
  const [month, setMonth] = useState(currentMonthKey());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const manualQ = useQuery({ queryKey: ["manual-sales"], queryFn: listManualSales });
  const wQ = useQuery({ queryKey: ["taqseemat-withdrawals"], queryFn: listWithdrawals });
  const profitQ = useQuery({ queryKey: ["taqseemat-profits"], queryFn: listTaqseematProfits });
  const cigQ = useQuery({ queryKey: ["taqseemat-cig"], queryFn: listCigSales });

  const manualSales = manualQ.data ?? [];
  const withdrawals = wQ.data ?? [];
  const profitWs = profitQ.data ?? [];
  const cigSales = cigQ.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manual-sales"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-profits"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-cig"] });
  };

  const cigByDate = useMemo(() => new Map(cigSales.map((x) => [x.sale_date, Number(x.retail_total)])), [cigSales]);
  const manualByDate = useMemo(() => new Map(manualSales.map((x) => [x.sale_date, Number(x.amount)])), [manualSales]);
  const profitByDate = useMemo(() => new Map(profitWs.map((x) => [x.profit_date, Number(x.taken_amount)])), [profitWs]);

  const wByDate = useMemo(() => {
    const m = new Map<string, { cigarettes: Withdrawal[]; sales: Withdrawal[] }>();
    for (const w of withdrawals) {
      const cur = m.get(w.entry_date) ?? { cigarettes: [], sales: [] };
      cur[w.kind].push(w);
      m.set(w.entry_date, cur);
    }
    return m;
  }, [withdrawals]);

  const filtering = Boolean(from || to);

  const dates = useMemo(() => {
    const set = new Set<string>([...cigByDate.keys(), ...manualByDate.keys(), ...wByDate.keys(), ...profitByDate.keys()]);
    let list = [...set];
    if (filtering) {
      list = list.filter((d) => (!from || d >= from) && (!to || d <= to));
    } else {
      list = list.filter((d) => monthKey(d) === month);
    }
    return list.sort((a, b) => (a < b ? 1 : -1));
  }, [cigByDate, manualByDate, wByDate, profitByDate, filtering, from, to, month]);

  // Totals (للفترة المعروضة)
  const cigRetailTotal = dates.reduce((s, d) => s + (cigByDate.get(d) ?? 0), 0);
  const salesTotal = dates.reduce((s, d) => s + (manualByDate.get(d) ?? 0), 0);
  const profitTotal = dates.reduce((s, d) => s + (profitByDate.get(d) ?? 0), 0);
  const sumW = (d: string, k: "cigarettes" | "sales") => (wByDate.get(d)?.[k] ?? []).reduce((a, x) => a + Number(x.amount), 0);
  const cigExpTotal = dates.reduce((s, d) => s + sumW(d, "cigarettes"), 0);
  const salesExpTotal = dates.reduce((s, d) => s + sumW(d, "sales"), 0);
  const daysTotal = cigRetailTotal + salesTotal + profitTotal;
  const remaining = daysTotal - profitTotal - cigExpTotal - salesExpTotal;

  const saveCig = async (date: string, amount: number) => {
    const { error } = await supabase.from("cigarette_sales").upsert({ sale_date: date, retail_total: amount }, { onConflict: "sale_date" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ قطاعي السجاير");
    refresh();
  };
  const saveSales = async (date: string, amount: number) => {
    const { error } = await supabase.from("manual_sales").upsert({ sale_date: date, amount }, { onConflict: "sale_date" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ المبيعات");
    refresh();
  };
  const saveProfit = async (date: string, amount: number) => {
    const { error } = await (supabase as any).from("taqseemat_profits").upsert({ profit_date: date, amount }, { onConflict: "profit_date" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ الأرباح");
    refresh();
  };
  const deleteProfit = async (date: string) => {
    if (!window.confirm("حذف أرباح هذا اليوم؟")) return;
    const { error } = await (supabase as any).from("taqseemat_profits").delete().eq("profit_date", date);
    if (error) return toast.error(error.message);
    refresh();
  };
  const editValue = (label: string, cur: number, fn: (n: number) => void) => {
    const v = window.prompt(`تعديل ${label}`, String(cur));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return toast.error("اكتب رقماً صحيحاً");
    fn(n);
  };
  const deleteCig = async (date: string) => {
    if (!window.confirm("حذف قطاعي السجاير لهذا اليوم؟")) return;
    const { error } = await supabase.from("cigarette_sales").delete().eq("sale_date", date);
    if (error) return toast.error(error.message);
    refresh();
  };
  const deleteSales = async (date: string) => {
    if (!window.confirm("حذف مبيعات هذا اليوم؟")) return;
    const { error } = await supabase.from("manual_sales").delete().eq("sale_date", date);
    if (error) return toast.error(error.message);
    refresh();
  };
  const changeDate = async (d: string) => {
    const nd = window.prompt("التاريخ الجديد (YYYY-MM-DD)", d);
    if (!nd || nd === d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) return toast.error("اكتب التاريخ بصيغة YYYY-MM-DD");
    if ((cigByDate.has(d) && cigByDate.has(nd)) || (manualByDate.has(d) && manualByDate.has(nd)) || (profitByDate.has(d) && profitByDate.has(nd)))
      return toast.error("التاريخ الجديد فيه بيانات بالفعل، عدّلها أو احذفها أولاً");
    const sb = supabase as any;
    const r = await Promise.all([
      sb.from("cigarette_sales").update({ sale_date: nd }).eq("sale_date", d),
      sb.from("manual_sales").update({ sale_date: nd }).eq("sale_date", d),
      sb.from("taqseemat_profits").update({ profit_date: nd }).eq("profit_date", d),
      sb.from("taqseemat_withdrawals").update({ entry_date: nd }).eq("entry_date", d),
    ]);
    const err = r.find((x: any) => x.error)?.error;
    if (err) return toast.error(err.message);
    toast.success("تم تعديل التاريخ");
    refresh();
  };
  const [ndDate, setNdDate] = useState(todayISO());
  const [ndCig, setNdCig] = useState("");
  const [ndSales, setNdSales] = useState("");
  const [ndProfit, setNdProfit] = useState("");
  const addDay = async () => {
    if (!ndDate) return toast.error("اختر التاريخ");
    const sb = supabase as any;
    const ops: any[] = [];
    if (ndCig !== "") ops.push(sb.from("cigarette_sales").upsert({ sale_date: ndDate, retail_total: Number(ndCig) || 0 }, { onConflict: "sale_date" }));
    if (ndSales !== "") ops.push(sb.from("manual_sales").upsert({ sale_date: ndDate, amount: Number(ndSales) || 0 }, { onConflict: "sale_date" }));
    if (ndProfit !== "") ops.push(sb.from("taqseemat_profits").upsert({ profit_date: ndDate, amount: Number(ndProfit) || 0 }, { onConflict: "profit_date" }));
    if (!ops.length) ops.push(sb.from("manual_sales").upsert({ sale_date: ndDate, amount: 0 }, { onConflict: "sale_date" }));
    const r = await Promise.all(ops);
    const err = r.find((x: any) => x.error)?.error;
    if (err) return toast.error(err.message);
    toast.success("تمت إضافة اليوم");
    setNdCig(""); setNdSales(""); setNdProfit("");
    refresh();
  };
  const editWithdrawal = (x: Withdrawal) =>
    editValue("المنصرف", Number(x.amount), async (n) => {
      const { error } = await supabase.from("taqseemat_withdrawals").update({ amount: n }).eq("id", x.id);
      if (error) return toast.error(error.message);
      refresh();
    });

  const saveManualSale = async () => {
    const amount = Number(sAmount) || 0;
    if (!sDate) return toast.error("اختر التاريخ");
    const { error } = await supabase
      .from("manual_sales")
      .upsert({ sale_date: sDate, amount }, { onConflict: "sale_date" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ مبيعات اليوم");
    setSAmount("");
    refresh();
  };

  const addWithdrawal = async () => {
    const amount = Number(wAmount) || 0;
    if (amount <= 0) return toast.error("اكتب مبلغ المنصرف");
    const { error } = await supabase
      .from("taqseemat_withdrawals")
      .insert({ entry_date: wDate, kind: wKind, amount, note: wNote || null });
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل المنصرف");
    setWAmount("");
    setWNote("");
    refresh();
  };

  const deleteWithdrawal = async (id: string) => {
    if (!window.confirm("حذف هذا المنصرف؟")) return;
    const { error } = await supabase.from("taqseemat_withdrawals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const exportTaqseematPDF = () => {
    if (dates.length === 0) {
      toast.error("لا توجد بيانات لتصديرها كـ PDF");
      return;
    }

    const printWin = window.open("", "_blank", "width=1000,height=800");
    if (!printWin) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لإنشاء ملف الـ PDF");
      return;
    }

    const periodText = filtering
      ? `الفترة من ${from || "البداية"} إلى ${to || "اليوم"}`
      : `شهر ${monthLabel(month)}`;

    const todayDate = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const rowsHtml = dates
      .map((d, idx) => {
        const cigRetail = cigByDate.get(d) ?? 0;
        const salesRev = manualByDate.get(d) ?? 0;
        const dayProfit = profitByDate.get(d) ?? 0;
        const dayTotal = cigRetail + salesRev + dayProfit;
        const hasCig = cigByDate.has(d);
        const hasSales = manualByDate.has(d);
        const hasProfit = profitByDate.has(d);
        const w = wByDate.get(d) ?? { cigarettes: [], sales: [] };

        const cigWStr = w.cigarettes.length === 0
          ? "—"
          : w.cigarettes.map((x) => `${NUM(Number(x.amount))}${x.note ? ` (${x.note})` : ""}`).join(" ، ");

        const salesWStr = w.sales.length === 0
          ? "—"
          : w.sales.map((x) => `${NUM(Number(x.amount))}${x.note ? ` (${x.note})` : ""}`).join(" ، ");

        return `
          <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding:8px 10px; font-weight:700; border-bottom:1px solid #e2e8f0; white-space:nowrap;">${DATE_AR(d)}</td>
            <td style="padding:8px 10px; font-weight:800; border-bottom:1px solid #e2e8f0; color:#0f172a;">${EGP(dayTotal)}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">${hasCig ? EGP(cigRetail) : "—"}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">${hasSales ? EGP(salesRev) : "—"}</td>
            <td style="padding:8px 10px; font-weight:700; border-bottom:1px solid #e2e8f0; color:#16a34a;">${hasProfit ? EGP(dayProfit) : "—"}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#d97706;">${cigWStr}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#0284c7;">${salesWStr}</td>
          </tr>
        `;
      })
      .join("");

    printWin.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>سجل_التقسيمات_${periodText.replace(/\\s+/g, "_")}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            body {
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 16px;
              direction: rtl;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0f766e;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .header h1 {
              margin: 0;
              font-size: 20px;
              font-weight: 900;
              color: #0f766e;
            }
            .header p {
              margin: 4px 0 0;
              font-size: 12px;
              color: #64748b;
            }
            .stats-bar {
              display: flex;
              gap: 10px;
              margin-bottom: 16px;
            }
            .stat-box {
              flex: 1;
              padding: 10px 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              text-align: center;
            }
            .stat-title {
              font-size: 11px;
              color: #64748b;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .stat-val {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
            }
            .stat-highlight {
              background: #0f766e;
              color: #fff;
              border-color: #0f766e;
            }
            .stat-highlight .stat-title {
              color: rgba(255,255,255,0.85);
            }
            .stat-highlight .stat-val {
              color: #fff;
              font-size: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
            }
            th {
              background: #0f766e;
              color: #ffffff;
              padding: 10px 8px;
              font-weight: 800;
              text-align: right;
            }
            tfoot tr {
              background: #e2e8f0;
              font-weight: 900;
            }
            tfoot td {
              padding: 10px 8px;
              border-top: 2px solid #cbd5e1;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>الشوره ماركت — سجل التقسيمات اليومية</h1>
            <p>${periodText} — تاريخ الطباعة: ${todayDate}</p>
          </div>

          <div class="stats-bar">
            <div class="stat-box stat-highlight">
              <div class="stat-title">المتبقي (الصافي)</div>
              <div class="stat-val">${EGP(remaining)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">إجمالي الأيام</div>
              <div class="stat-val">${EGP(daysTotal)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">قطاعي السجاير</div>
              <div class="stat-val">${EGP(cigRetailTotal)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">المبيعات</div>
              <div class="stat-val">${EGP(salesTotal)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">الأرباح</div>
              <div class="stat-val" style="color:#16a34a;">${EGP(profitTotal)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">منصرف سجاير</div>
              <div class="stat-val" style="color:#d97706;">${EGP(cigExpTotal)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-title">منصرف مبيعات</div>
              <div class="stat-val" style="color:#0284c7;">${EGP(salesExpTotal)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>إجمالي اليوم</th>
                <th>السجاير</th>
                <th>باقي المبيعات</th>
                <th>الأرباح</th>
                <th>منصرف سجاير</th>
                <th>منصرف مبيعات</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
                <td>${EGP(daysTotal)}</td>
                <td>${EGP(cigRetailTotal)}</td>
                <td>${EGP(salesTotal)}</td>
                <td style="color:#16a34a;">${EGP(profitTotal)}</td>
                <td style="color:#d97706;">${EGP(cigExpTotal)}</td>
                <td style="color:#0284c7;">${EGP(salesExpTotal)}</td>
              </tr>
            </tfoot>
          </table>

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
  };

  return (
    <AppShell title="تقسيمات">
      {/* Grand total */}
      <div className="rounded-2xl bg-gradient-primary text-white p-6 shadow-elevated mb-6 text-center">
        <div className="text-sm opacity-90">المتبقي = إجمالي الأيام − الأرباح − منصرفات السجاير والمبيعات{filtering ? " — للفترة المحددة" : ` — ${monthLabel(month)}`}</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight">{EGP(remaining)}</div>
      </div>

      {/* 3 boxes */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <StatCard label="قطاعي سجاير (قبل سحب الأرباح)" value={EGP(cigRetailTotal)} icon={Cigarette} variant="warning" hint="إدخال يدوي" />
        <StatCard label="إجمالي مبيعات" value={EGP(salesTotal)} icon={ShoppingBasket} variant="info" hint="إدخال يدوي" />
        <StatCard label="إجمالي أرباح" value={EGP(profitTotal)} icon={Wallet} variant="success" hint="إدخال يدوي" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-8">
        <StatCard label="إجمالي منصرف سجاير" value={EGP(cigExpTotal)} icon={PiggyBank} variant="danger" hint="إدخال يدوي" />
        <StatCard label="إجمالي منصرف مبيعات" value={EGP(salesExpTotal)} icon={PiggyBank} variant="danger" hint="إدخال يدوي" />
      </div>

      {/* Entry forms */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-4 mb-8 no-print">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Cigarette className="size-4" /> تسجيل قطاعي السجاير (يدوي)</h3>
...
          <p className="text-xs text-muted-foreground mt-2">نفس التاريخ يُحدَّث ولا يتكرر.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Wallet className="size-4" /> تسجيل أرباح اليوم (يدوي)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">الأرباح
              <input type="number" min="0" value={pAmount} onChange={(e) => setPAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <button onClick={async () => { if (!pDate) return toast.error("اختر التاريخ"); await saveProfit(pDate, Number(pAmount) || 0); setPAmount(""); }} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90">
              <Save className="size-4" /> حفظ
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">نفس التاريخ يُحدَّث ولا يتكرر.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="size-4" /> تسجيل منصرف</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">النوع
              <select value={wKind} onChange={(e) => setWKind(e.target.value as "cigarettes" | "sales")} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="sales">منصرف مبيعات</option>
                <option value="cigarettes">منصرف سجاير</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">المبلغ
              <input type="number" min="0" value={wAmount} onChange={(e) => setWAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <label className="text-xs text-muted-foreground">ملاحظة
              <input type="text" value={wNote} onChange={(e) => setWNote(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="اختياري" />
            </label>
            <button onClick={addWithdrawal} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90">
              <Plus className="size-4" /> إضافة
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">يمكن تسجيل أكثر من منصرف في نفس اليوم.</p>
        </div>
      </div>

      {/* Month nav / filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        {!filtering && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-card">
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1 rounded-lg hover:bg-muted" aria-label="الشهر التالي">
              <ChevronRight className="size-4" />
            </button>
            <span className="font-bold text-sm min-w-28 text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1 rounded-lg hover:bg-muted" aria-label="الشهر السابق">
              <ChevronLeft className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-card text-sm">
          <span className="text-muted-foreground text-xs">تصفية من</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          <span className="text-muted-foreground text-xs">إلى</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          {filtering && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="flex items-center gap-1 text-xs text-destructive hover:opacity-80">
              <X className="size-3" /> إلغاء التصفية
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h3 className="font-bold">سجل التقسيمات اليومية{filtering ? " — الفترة المحددة" : ` — ${monthLabel(month)}`}</h3>
          </div>
          <button
            onClick={exportTaqseematPDF}
            className="flex items-center gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-xl transition-all shadow-sm no-print"
          >
            <FileDown className="size-4" />
            <span>تصدير PDF</span>
          </button>
        </div>
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-end gap-3 no-print">
          <div className="text-sm font-bold w-full">إضافة يوم جديد</div>
          <div><label className="text-xs font-bold block mb-1">التاريخ</label><input type="date" value={ndDate} onChange={(e) => setNdDate(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" /></div>
          <div><label className="text-xs font-bold block mb-1">السجاير</label><input type="number" min={0} value={ndCig} onChange={(e) => setNdCig(e.target.value)} className="h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm" /></div>
          <div><label className="text-xs font-bold block mb-1">باقي المبيعات</label><input type="number" min={0} value={ndSales} onChange={(e) => setNdSales(e.target.value)} className="h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm" /></div>
          <div><label className="text-xs font-bold block mb-1">الأرباح</label><input type="number" min={0} value={ndProfit} onChange={(e) => setNdProfit(e.target.value)} className="h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm" /></div>
          <button onClick={addDay} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1"><Plus className="size-4" />إضافة اليوم</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-right font-bold">التاريخ</th>
                <th className="px-4 py-3 text-right font-bold">إجمالي اليوم</th>
                <th className="px-4 py-3 text-right font-bold">السجاير</th>
                <th className="px-4 py-3 text-right font-bold">باقي المبيعات</th>
                <th className="px-4 py-3 text-right font-bold">الأرباح</th>
                <th className="px-4 py-3 text-right font-bold">منصرف سجاير</th>
                <th className="px-4 py-3 text-right font-bold">منصرف مبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dates.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">لا توجد بيانات في هذه الفترة.</td></tr>
              )}
              {dates.map((d) => {
                const cigRetail = cigByDate.get(d) ?? 0;
                const salesRev = manualByDate.get(d) ?? 0;
                const dayProfit = profitByDate.get(d) ?? 0;
                const dayTotal = cigRetail + salesRev + dayProfit;
                const hasCig = cigByDate.has(d);
                const hasSales = manualByDate.has(d);
                const hasProfit = profitByDate.has(d);
                const cellBtns = (onEdit: () => void, onDel?: () => void) => (
                  <span className="inline-flex gap-1 ms-2 no-print">
                    <button onClick={onEdit} className="text-primary hover:opacity-70" aria-label="تعديل"><Pencil className="size-3.5" /></button>
                    {onDel && <button onClick={onDel} className="text-destructive hover:opacity-70" aria-label="حذف"><Trash2 className="size-3.5" /></button>}
                  </span>
                );
                const w = wByDate.get(d) ?? { cigarettes: [], sales: [] };
                return (
                  <tr key={d} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold whitespace-nowrap">{DATE_AR(d)}<button onClick={() => changeDate(d)} className="text-primary hover:opacity-70 ms-2 align-middle" aria-label="تعديل التاريخ"><Pencil className="size-3.5" /></button></td>
                    <td className="px-4 py-3 font-bold">{EGP(dayTotal)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{hasCig ? EGP(cigRetail) : "—"}{cellBtns(() => editValue("قطاعي السجاير", cigRetail, (n) => saveCig(d, n)), hasCig ? () => deleteCig(d) : undefined)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{hasSales ? EGP(salesRev) : "—"}{cellBtns(() => editValue("المبيعات", salesRev, (n) => saveSales(d, n)), hasSales ? () => deleteSales(d) : undefined)}</td>
                    <td className="px-4 py-3 text-success font-bold whitespace-nowrap">{hasProfit ? EGP(dayProfit) : "—"}{cellBtns(() => editValue("الأرباح", dayProfit, (n) => saveProfit(d, n)), hasProfit ? () => deleteProfit(d) : undefined)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.cigarettes.length === 0 && "—"}
                        {w.cigarettes.map((x) => (
                          <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-warning/20 text-warning-foreground px-2 py-0.5 text-xs font-bold">
                            {NUM(Number(x.amount))}
                            {x.note && <span className="font-normal">({x.note})</span>}
                            <button onClick={() => editWithdrawal(x)} className="text-primary hover:opacity-70" aria-label="تعديل المنصرف"><Pencil className="size-3" /></button>
                            <button onClick={() => deleteWithdrawal(x.id)} className="text-destructive hover:opacity-70" aria-label="حذف المنصرف">
                              <Trash2 className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.sales.length === 0 && "—"}
                        {w.sales.map((x) => (
                          <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-info/20 px-2 py-0.5 text-xs font-bold">
                            {NUM(Number(x.amount))}
                            {x.note && <span className="font-normal">({x.note})</span>}
                            <button onClick={() => editWithdrawal(x)} className="text-primary hover:opacity-70" aria-label="تعديل المنصرف"><Pencil className="size-3" /></button>
                            <button onClick={() => deleteWithdrawal(x.id)} className="text-destructive hover:opacity-70" aria-label="حذف المنصرف">
                              <Trash2 className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {dates.length > 0 && (
              <tfoot>
                <tr className="bg-muted/60 font-extrabold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3">{EGP(daysTotal)}</td>
                  <td className="px-4 py-3">{EGP(cigRetailTotal)}</td>
                  <td className="px-4 py-3">{EGP(salesTotal)}</td>
                  <td className="px-4 py-3 text-success">{EGP(profitTotal)}</td>
                  <td className="px-4 py-3">{EGP(cigExpTotal)}</td>
                  <td className="px-4 py-3">{EGP(salesExpTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </AppShell>
  );
}
