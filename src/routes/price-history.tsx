import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listPriceHistory, listProducts } from "@/lib/api";
import { EGP, DATE_AR } from "@/lib/format";
import { History, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/price-history")({ component: PriceHistoryPage });

function PriceHistoryPage() {
  const phQ = useQuery({ queryKey: ["price-history"], queryFn: listPriceHistory });
  const prodQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const pmap = new Map((prodQ.data ?? []).map((p) => [p.id, p]));
  const items = phQ.data ?? [];

  return (
    <AppShell title="سجل تعديل الأسعار">
      <p className="text-sm text-muted-foreground mb-4">آخر 200 تعديل سعر — يُسجَّل تلقائياً عند احتساب متوسط التكلفة المرجح بعد إضافة وارد بسعر مختلف.</p>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-3 py-2.5 text-right">التاريخ</th>
                <th className="px-3 py-2.5 text-right">الصنف</th>
                <th className="px-3 py-2.5 text-right">السعر القديم</th>
                <th className="px-3 py-2.5 text-right"></th>
                <th className="px-3 py-2.5 text-right">السعر الجديد</th>
                <th className="px-3 py-2.5 text-right">المستخدم</th>
                <th className="px-3 py-2.5 text-right">السبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((h) => {
                const diff = Number(h.new_price) - Number(h.old_price);
                return (
                  <tr key={h.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{DATE_AR(h.created_at)}</td>
                    <td className="px-3 py-2 font-bold">{pmap.get(h.product_id)?.name ?? "—"}</td>
                    <td className="px-3 py-2">{EGP(Number(h.old_price))}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground"><ArrowLeft className="size-4 inline" /></td>
                    <td className="px-3 py-2 font-bold">
                      {EGP(Number(h.new_price))}
                      <span className={`ms-2 text-[11px] font-bold ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                        ({diff >= 0 ? "+" : ""}{EGP(diff)})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{h.changed_by ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.reason ?? "—"}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <History className="size-8 mx-auto mb-2 opacity-40" />
                  لا توجد تعديلات أسعار مسجلة بعد.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
