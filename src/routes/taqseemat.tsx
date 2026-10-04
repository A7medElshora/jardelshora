import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { listPurchases } from "@/lib/api";
import { EGP, NUM, DATE_AR, todayISO } from "@/lib/format";
import { Cigarette, ShoppingBasket, Wallet, Layers, Plus, Trash2, Save, ChevronRight, ChevronLeft, X, Pencil, PiggyBank } from "lucide-react";
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

async function listProfitWithdrawals(): Promise<ProfitW[]> {
  const { data, error } = await supabase.from("profit_withdrawals").select("id, profit_date, taken_amount");
  if (error) throw error;
  return (data ?? []) as ProfitW[];
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
  const [month, setMonth] = useState(currentMonthKey());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const manualQ = useQuery({ queryKey: ["manual-sales"], queryFn: listManualSales });
  const wQ = useQuery({ queryKey: ["taqseemat-withdrawals"], queryFn: listWithdrawals });
  const profitQ = useQuery({ queryKey: ["taqseemat-profits"], queryFn: listProfitWithdrawals });
  const cigQ = useQuery({ queryKey: ["taqseemat-cig"], queryFn: listCigSales });
  const purQ = useQuery({ queryKey: ["taqseemat-purchases"], queryFn: () => listPurchases() });

  const manualSales = manualQ.data ?? [];
  const withdrawals = wQ.data ?? [];
  const profitWs = profitQ.data ?? [];
  const cigSales = cigQ.data ?? [];
  const purchases = purQ.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manual-sales"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-profits"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-cig"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-purchases"] });
  };

  // قطاعي السجاير من الجرد اليومي (كل أصناف الجرد سجاير)
  const cigByDate = useMemo(() => new Map(cigSales.map((x) => [x.sale_date, Number(x.retail_total)])), [cigSales]);
  // منصرف السجاير من الوارد (الكمية × سعر الجملة) حسب اليوم
  const purByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of purchases) m.set(p.purchase_date, (m.get(p.purchase_date) ?? 0) + Number(p.quantity) * Number(p.wholesale_price));
    return m;
  }, [purchases]);

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
    const set = new Set<string>([...cigByDate.keys(), ...manualByDate.keys(), ...wByDate.keys(), ...profitByDate.keys(), ...purByDate.keys()]);
    let list = [...set];
    if (filtering) {
      list = list.filter((d) => (!from || d >= from) && (!to || d <= to));
    } else {
      list = list.filter((d) => monthKey(d) === month);
    }
    return list.sort((a, b) => (a < b ? 1 : -1));
  }, [cigByDate, manualByDate, wByDate, profitByDate, purByDate, filtering, from, to, month]);

  // Totals (للفترة المعروضة)
  const cigRetailTotal = dates.reduce((s, d) => s + (cigByDate.get(d) ?? 0), 0);
  const salesTotal = dates.reduce((s, d) => s + (manualByDate.get(d) ?? 0), 0);
  const profitTotal = dates.reduce((s, d) => s + (profitByDate.get(d) ?? 0), 0);
  const sumW = (d: string, k: "cigarettes" | "sales") => (wByDate.get(d)?.[k] ?? []).reduce((a, x) => a + Number(x.amount), 0);
  const cigExpTotal = dates.reduce((s, d) => s + (purByDate.get(d) ?? 0) + sumW(d, "cigarettes"), 0);
  const salesExpTotal = dates.reduce((s, d) => s + sumW(d, "sales"), 0);
  const remaining = cigRetailTotal + salesTotal - profitTotal - cigExpTotal - salesExpTotal;

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

  return (
    <AppShell title="تقسيمات">
      {/* Grand total */}
      <div className="rounded-2xl bg-gradient-primary text-white p-6 shadow-elevated mb-6 text-center">
        <div className="text-sm opacity-90">المتبقي (قطاعي + مبيعات − أرباح − منصرفات){filtering ? " — للفترة المحددة" : ` — ${monthLabel(month)}`}</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight">{EGP(remaining)}</div>
      </div>

      {/* 3 boxes */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <StatCard label="قطاعي سجاير (قبل سحب الأرباح)" value={EGP(cigRetailTotal)} icon={Cigarette} variant="warning" hint="إدخال يدوي" />
        <StatCard label="إجمالي مبيعات" value={EGP(salesTotal)} icon={ShoppingBasket} variant="info" hint="إدخال يدوي" />
        <StatCard label="إجمالي أرباح" value={EGP(profitTotal)} icon={Wallet} variant="success" hint="المأخوذ من الأرباح" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-8">
        <StatCard label="إجمالي منصرف سجاير" value={EGP(cigExpTotal)} icon={PiggyBank} variant="danger" hint="من الوارد" />
        <StatCard label="إجمالي منصرف مبيعات" value={EGP(salesExpTotal)} icon={PiggyBank} variant="danger" hint="إدخال يدوي" />
      </div>

      {/* Entry forms */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-8 no-print">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Cigarette className="size-4" /> تسجيل قطاعي السجاير (يدوي)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">قطاعي السجاير
              <input type="number" min="0" value={cAmount} onChange={(e) => setCAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <button onClick={async () => { if (!cDate) return toast.error("اختر التاريخ"); await saveCig(cDate, Number(cAmount) || 0); setCAmount(""); }} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90">
              <Save className="size-4" /> حفظ
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">نفس التاريخ يُحدَّث ولا يتكرر.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingBasket className="size-4" /> تسجيل مبيعات اليوم (يدوي)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">إجمالي المبيعات
              <input type="number" min="0" value={sAmount} onChange={(e) => setSAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <button onClick={saveManualSale} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90">
              <Save className="size-4" /> حفظ
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">نفس التاريخ يُحدَّث ولا يتكرر.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="size-4" /> تسجيل منصرف مبيعات</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">النوع
              <select value={wKind} onChange={(e) => setWKind(e.target.value as "cigarettes" | "sales")} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="sales">منصرف مبيعات</option>
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
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h3 className="font-bold">سجل التقسيمات اليومية{filtering ? " — الفترة المحددة" : ` — ${monthLabel(month)}`}</h3>
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
                const dayTotal = cigRetail + salesRev;
                const purExp = purByDate.get(d) ?? 0;
                const hasCig = cigByDate.has(d);
                const hasSales = manualByDate.has(d);
                const cellBtns = (onEdit: () => void, onDel?: () => void) => (
                  <span className="inline-flex gap-1 ms-2 no-print">
                    <button onClick={onEdit} className="text-primary hover:opacity-70" aria-label="تعديل"><Pencil className="size-3.5" /></button>
                    {onDel && <button onClick={onDel} className="text-destructive hover:opacity-70" aria-label="حذف"><Trash2 className="size-3.5" /></button>}
                  </span>
                );
                const w = wByDate.get(d) ?? { cigarettes: [], sales: [] };
                return (
                  <tr key={d} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold whitespace-nowrap">{DATE_AR(d)}</td>
                    <td className="px-4 py-3 font-bold">{EGP(dayTotal)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{hasCig ? EGP(cigRetail) : "—"}{cellBtns(() => editValue("قطاعي السجاير", cigRetail, (n) => saveCig(d, n)), hasCig ? () => deleteCig(d) : undefined)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{hasSales ? EGP(salesRev) : "—"}{cellBtns(() => editValue("المبيعات", salesRev, (n) => saveSales(d, n)), hasSales ? () => deleteSales(d) : undefined)}</td>
                    <td className="px-4 py-3 text-success font-bold">{dayProfit !== 0 ? EGP(dayProfit) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {purExp > 0 && <span className="inline-flex rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold" title="من الوارد">{NUM(purExp)} (وارد)</span>}
                        {w.cigarettes.length === 0 && purExp === 0 && "—"}
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
                  <td className="px-4 py-3">{EGP(cigRetailTotal + salesTotal)}</td>
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
