import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { listDailySales } from "@/lib/api";
import { EGP, DATE_AR, monthRange, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Wallet, HandCoins, PiggyBank, Save, MinusCircle, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/profits")({
  head: () => ({
    meta: [
      { title: "الأرباح — الشوره ماركت" },
      { name: "description", content: "عرض الأرباح الفعلية لكل يوم والمبلغ المأخوذ منها فعلياً." },
      { property: "og:title", content: "الأرباح — الشوره ماركت" },
      { property: "og:description", content: "عرض الأرباح الفعلية والمأخوذ فعلياً بالتواريخ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfitsPage,
});

type Withdrawal = { id: string; profit_date: string; taken_amount: number; note: string | null };

async function listWithdrawals(from: string, to: string): Promise<Withdrawal[]> {
  const { data, error } = await (supabase as any)
    .from("profit_withdrawals")
    .select("*")
    .gte("profit_date", from)
    .lte("profit_date", to);
  if (error) throw error;
  return (data ?? []) as Withdrawal[];
}

type Expense = { id: string; expense_date: string; amount: number; reason: string | null };

async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const { data, error } = await (supabase as any)
    .from("profit_expenses").select("*").gte("expense_date", from).lte("expense_date", to)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

function ProfitsPage() {
  const now = new Date();
  const m = monthRange(now.getFullYear(), now.getMonth());
  const [from, setFrom] = useState(m.start);
  const [to, setTo] = useState(m.end);
  const qc = useQueryClient();

  const salesQ = useQuery({ queryKey: ["sales", from, to], queryFn: () => listDailySales(from, to) });
  const wQ = useQuery({ queryKey: ["withdrawals", from, to], queryFn: () => listWithdrawals(from, to) });

  const eQ = useQuery({ queryKey: ["profit-expenses", from, to], queryFn: () => listExpenses(from, to) });
  const expenses = eQ.data ?? [];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const [eDate, setEDate] = useState(todayISO());
  const [eAmount, setEAmount] = useState("");
  const [eReason, setEReason] = useState("");

  async function addExpense() {
    const amount = Number(eAmount);
    if (!(amount > 0)) return toast.error("اكتب مبلغ المسحوب");
    if (!eReason.trim()) return toast.error("اكتب سبب الصرف");
    const { error } = await (supabase as any).from("profit_expenses").insert({ expense_date: eDate, amount, reason: eReason.trim() });
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success("تم تسجيل المسحوب");
    setEAmount(""); setEReason("");
    qc.invalidateQueries({ queryKey: ["profit-expenses"] });
  }
  async function editExpense(e: Expense) {
    const a = window.prompt("المبلغ", String(e.amount));
    if (a === null) return;
    const reason = window.prompt("سبب الصرف", e.reason ?? "");
    if (reason === null) return;
    const amount = Number(a);
    if (!(amount > 0)) return toast.error("اكتب مبلغاً صحيحاً");
    const { error } = await (supabase as any).from("profit_expenses").update({ amount, reason }).eq("id", e.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profit-expenses"] });
  }
  async function deleteExpense(e: Expense) {
    if (!window.confirm("حذف هذا المسحوب؟")) return;
    const { error } = await (supabase as any).from("profit_expenses").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profit-expenses"] });
  }

  const rows = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of salesQ.data ?? []) {
      const q = Number(s.quantity_sold);
      const p = q * (Number(s.retail_price_snapshot) - Number(s.wholesale_price_snapshot));
      byDate.set(s.sale_date, (byDate.get(s.sale_date) ?? 0) + p);
    }
    const wmap = new Map((wQ.data ?? []).map((w) => [w.profit_date, w]));
    for (const d of wmap.keys()) if (!byDate.has(d)) byDate.set(d, 0);
    return Array.from(byDate.entries())
      .map(([date, profit]) => ({ date, profit, w: wmap.get(date) }))
      .filter((r) => r.profit !== 0 || r.w)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [salesQ.data, wQ.data]);

  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totalTaken = rows.reduce((s, r) => s + Number(r.w?.taken_amount ?? 0), 0);

  async function save(date: string, taken: number, note: string) {
    const { error } = await (supabase as any)
      .from("profit_withdrawals")
      .upsert({ profit_date: date, taken_amount: taken, note: note || null }, { onConflict: "profit_date" });
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success("تم حفظ المبلغ المأخوذ");
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
  }

  return (
    <AppShell title="الأرباح">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="الأرباح الفعلية" value={EGP(totalProfit)} icon={Wallet} variant="success" hint="إجمالي أرباح الفترة" />
        <StatCard label="المأخوذ فعلياً (بعد المسحوبات)" value={EGP(totalTaken - totalExpenses)} icon={HandCoins} variant="warning" hint={`المأخوذ ${EGP(totalTaken)} − المسحوبات ${EGP(totalExpenses)}`} />
        <StatCard label="المسحوبات من الأرباح" value={EGP(totalExpenses)} icon={MinusCircle} variant="danger" hint="مصروفات بسبب" />
        <StatCard label="المتبقي" value={EGP(totalProfit - (totalTaken - totalExpenses))} icon={PiggyBank} variant="info" hint="الأرباح غير المسحوبة" />
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">من تاريخ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">إلى تاريخ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-3 py-2.5 text-right">التاريخ</th>
                <th className="px-3 py-2.5 text-right">الأرباح الفعلية</th>
                <th className="px-3 py-2.5 text-right">المأخوذ فعلياً</th>
                <th className="px-3 py-2.5 text-right">المتبقي</th>
                <th className="px-3 py-2.5 text-right">ملاحظة</th>
                <th className="px-3 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <Row key={r.date + (r.w?.taken_amount ?? "") + (r.w?.note ?? "")} date={r.date} profit={r.profit} w={r.w} onSave={save} />
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">لا توجد أرباح مسجلة في هذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-6 bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-bold flex items-center gap-2"><MinusCircle className="size-4" /> مسحوبات من الأرباح</div>
        <div className="px-5 py-4 flex flex-wrap items-end gap-3 border-b border-border no-print">
          <div>
            <label className="text-xs font-bold block mb-1">التاريخ</label>
            <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">المبلغ</label>
            <input type="number" min={0} step="0.01" value={eAmount} onChange={(e) => setEAmount(e.target.value)} className="h-10 w-32 rounded-lg border border-input bg-background px-3 text-sm" placeholder="0" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs font-bold block mb-1">سبب الصرف</label>
            <input value={eReason} onChange={(e) => setEReason(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" placeholder="مثال: كهرباء، إيجار…" />
          </div>
          <Button onClick={addExpense}><Plus className="size-4 ms-1" />إضافة</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-3 py-2.5 text-right">التاريخ</th>
                <th className="px-3 py-2.5 text-right">المبلغ</th>
                <th className="px-3 py-2.5 text-right">سبب الصرف</th>
                <th className="px-3 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{DATE_AR(e.expense_date)}</td>
                  <td className="px-3 py-2 text-destructive font-bold">{EGP(Number(e.amount))}</td>
                  <td className="px-3 py-2">{e.reason ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => editExpense(e)} className="text-primary hover:opacity-70 me-2" aria-label="تعديل"><Pencil className="size-4" /></button>
                    <button onClick={() => deleteExpense(e)} className="text-destructive hover:opacity-70" aria-label="حذف"><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">لا توجد مسحوبات في هذه الفترة.</td></tr>
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot><tr className="bg-muted/60 font-extrabold"><td className="px-3 py-2">الإجمالي</td><td className="px-3 py-2 text-destructive">{EGP(totalExpenses)}</td><td colSpan={2}></td></tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ date, profit, w, onSave }: { date: string; profit: number; w?: Withdrawal; onSave: (d: string, t: number, n: string) => Promise<unknown> }) {
  const [taken, setTaken] = useState(String(w?.taken_amount ?? 0));
  const [note, setNote] = useState(w?.note ?? "");
  const [busy, setBusy] = useState(false);
  const t = Number(taken) || 0;
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-3 py-2 font-bold">{DATE_AR(date)}</td>
      <td className="px-3 py-2 text-success font-bold">{EGP(profit)}</td>
      <td className="px-3 py-2">
        <input type="number" min={0} step="0.01" value={taken} onChange={(e) => setTaken(e.target.value)} className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-sm" />
      </td>
      <td className="px-3 py-2">{EGP(profit - t)}</td>
      <td className="px-3 py-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" className="h-9 w-40 rounded-lg border border-input bg-background px-2 text-sm" />
      </td>
      <td className="px-3 py-2">
        <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await onSave(date, Math.max(0, t), note); setBusy(false); }}>
          <Save className="size-4 ms-1" />حفظ
        </Button>
      </td>
    </tr>
  );
}
