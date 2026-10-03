import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { listDailySales } from "@/lib/api";
import { EGP, NUM, DATE_AR, todayISO } from "@/lib/format";
import { Cigarette, ShoppingBasket, Wallet, Layers, Plus, Trash2, Save } from "lucide-react";
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

type CigSale = { id: string; sale_date: string; retail_total: number; wholesale_total: number };
type Withdrawal = { id: string; entry_date: string; kind: "cigarettes" | "sales"; amount: number; note: string | null };

async function listCigSales(): Promise<CigSale[]> {
  const { data, error } = await supabase.from("cigarette_sales").select("*").order("sale_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CigSale[];
}

async function listWithdrawals(): Promise<Withdrawal[]> {
  const { data, error } = await supabase.from("taqseemat_withdrawals").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Withdrawal[];
}

function TaqseematPage() {
  const qc = useQueryClient();
  const [cigDate, setCigDate] = useState(todayISO());
  const [cigRetail, setCigRetail] = useState("");
  const [cigWholesale, setCigWholesale] = useState("");
  const [wDate, setWDate] = useState(todayISO());
  const [wKind, setWKind] = useState<"cigarettes" | "sales">("cigarettes");
  const [wAmount, setWAmount] = useState("");
  const [wNote, setWNote] = useState("");

  const cigQ = useQuery({ queryKey: ["cig-sales"], queryFn: listCigSales });
  const wQ = useQuery({ queryKey: ["taqseemat-withdrawals"], queryFn: listWithdrawals });
  const salesQ = useQuery({
    queryKey: ["taqseemat-daily-sales"],
    queryFn: () => listDailySales("2000-01-01", "2100-01-01"),
  });

  const cigSales = cigQ.data ?? [];
  const withdrawals = wQ.data ?? [];
  const dailySales = salesQ.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cig-sales"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["taqseemat-daily-sales"] });
  };

  // Aggregate daily_sales (باقي المبيعات) per date
  const salesByDate = useMemo(() => {
    const m = new Map<string, { revenue: number; profit: number }>();
    for (const s of dailySales) {
      const cur = m.get(s.sale_date) ?? { revenue: 0, profit: 0 };
      cur.revenue += Number(s.quantity_sold) * Number(s.retail_price_snapshot);
      cur.profit += Number(s.quantity_sold) * (Number(s.retail_price_snapshot) - Number(s.wholesale_price_snapshot));
      m.set(s.sale_date, cur);
    }
    return m;
  }, [dailySales]);

  const wByDate = useMemo(() => {
    const m = new Map<string, { cigarettes: Withdrawal[]; sales: Withdrawal[] }>();
    for (const w of withdrawals) {
      const cur = m.get(w.entry_date) ?? { cigarettes: [], sales: [] };
      cur[w.kind].push(w);
      m.set(w.entry_date, cur);
    }
    return m;
  }, [withdrawals]);

  const cigByDate = useMemo(() => new Map(cigSales.map((c) => [c.sale_date, c])), [cigSales]);

  const dates = useMemo(() => {
    const set = new Set<string>([...cigByDate.keys(), ...salesByDate.keys(), ...wByDate.keys()]);
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [cigByDate, salesByDate, wByDate]);

  // Totals
  const cigRetailTotal = cigSales.reduce((s, c) => s + Number(c.retail_total), 0);
  const salesTotal = dailySales.reduce((s, x) => s + Number(x.quantity_sold) * Number(x.retail_price_snapshot), 0);
  const cigProfitTotal = cigSales.reduce((s, c) => s + (Number(c.retail_total) - Number(c.wholesale_total)), 0);
  const salesProfitTotal = dailySales.reduce(
    (s, x) => s + Number(x.quantity_sold) * (Number(x.retail_price_snapshot) - Number(x.wholesale_price_snapshot)),
    0
  );
  const profitTotal = cigProfitTotal + salesProfitTotal;
  const grandTotal = cigRetailTotal + salesTotal + profitTotal;

  const saveCig = async () => {
    const retail = Number(cigRetail) || 0;
    const wholesale = Number(cigWholesale) || 0;
    if (!cigDate) return toast.error("اختر التاريخ");
    const { error } = await supabase
      .from("cigarette_sales")
      .upsert({ sale_date: cigDate, retail_total: retail, wholesale_total: wholesale }, { onConflict: "sale_date" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ مبيعات السجاير");
    setCigRetail("");
    setCigWholesale("");
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
    const { error } = await supabase.from("taqseemat_withdrawals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <AppShell title="تقسيمات">
      {/* Grand total */}
      <div className="rounded-2xl bg-gradient-primary text-white p-6 shadow-elevated mb-6 text-center">
        <div className="text-sm opacity-90">الإجمالي الكلي (سجاير + مبيعات + أرباح)</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight">{EGP(grandTotal)}</div>
      </div>

      {/* 3 boxes */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-8">
        <StatCard label="قطاعي سجاير (قبل سحب الأرباح)" value={EGP(cigRetailTotal)} icon={Cigarette} variant="warning" hint={`الجملة: ${EGP(cigSales.reduce((s, c) => s + Number(c.wholesale_total), 0))}`} />
        <StatCard label="إجمالي مبيعات" value={EGP(salesTotal)} icon={ShoppingBasket} variant="info" hint="من الجرد اليومي" />
        <StatCard label="إجمالي أرباح" value={EGP(profitTotal)} icon={Wallet} variant="success" hint={`سجاير: ${EGP(cigProfitTotal)} — مبيعات: ${EGP(salesProfitTotal)}`} />
      </div>

      {/* Entry forms */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-8 no-print">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Cigarette className="size-4" /> تسجيل مبيعات السجاير اليومية</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={cigDate} onChange={(e) => setCigDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">إجمالي القطاعي
              <input type="number" min="0" value={cigRetail} onChange={(e) => setCigRetail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <label className="text-xs text-muted-foreground">إجمالي الجملة
              <input type="number" min="0" value={cigWholesale} onChange={(e) => setCigWholesale(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" placeholder="0" />
            </label>
            <button onClick={saveCig} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-bold hover:opacity-90">
              <Save className="size-4" /> حفظ
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">نفس التاريخ يُحدَّث ولا يتكرر.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="size-4" /> تسجيل منصرف</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <label className="text-xs text-muted-foreground">التاريخ
              <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">النوع
              <select value={wKind} onChange={(e) => setWKind(e.target.value as "cigarettes" | "sales")} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="cigarettes">منصرف سجاير</option>
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

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h3 className="font-bold">سجل التقسيمات اليومية</h3>
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">لا توجد بيانات بعد — سجّل مبيعات السجاير أو المنصرفات من الأعلى.</td></tr>
              )}
              {dates.map((d) => {
                const cig = cigByDate.get(d);
                const sales = salesByDate.get(d);
                const w = wByDate.get(d) ?? { cigarettes: [], sales: [] };
                const cigRetail = Number(cig?.retail_total ?? 0);
                const cigProfit = cig ? Number(cig.retail_total) - Number(cig.wholesale_total) : 0;
                const salesRev = sales?.revenue ?? 0;
                const dayProfit = cigProfit + (sales?.profit ?? 0);
                const dayTotal = cigRetail + salesRev;
                return (
                  <tr key={d} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold whitespace-nowrap">{DATE_AR(d)}</td>
                    <td className="px-4 py-3 font-bold">{EGP(dayTotal)}</td>
                    <td className="px-4 py-3">{cig ? EGP(cigRetail) : "—"}</td>
                    <td className="px-4 py-3">{salesRev > 0 ? EGP(salesRev) : "—"}</td>
                    <td className="px-4 py-3 text-success font-bold">{dayProfit !== 0 ? EGP(dayProfit) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.cigarettes.length === 0 && "—"}
                        {w.cigarettes.map((x) => (
                          <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-warning/20 text-warning-foreground px-2 py-0.5 text-xs font-bold">
                            {NUM(Number(x.amount))}
                            {x.note && <span className="font-normal">({x.note})</span>}
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
                  <td className="px-4 py-3">{EGP(withdrawals.filter((x) => x.kind === "cigarettes").reduce((s, x) => s + Number(x.amount), 0))}</td>
                  <td className="px-4 py-3">{EGP(withdrawals.filter((x) => x.kind === "sales").reduce((s, x) => s + Number(x.amount), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </AppShell>
  );
}
