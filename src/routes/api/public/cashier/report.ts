import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { cairoToday, checkKey, db, json, preflight } from "@/lib/cashier.server";

const D = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Route = createFileRoute("/api/public/cashier/report")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const from = url.searchParams.get("from") ?? cairoToday();
        const to = url.searchParams.get("to") ?? from;
        if (!D.safeParse(from).success || !D.safeParse(to).success)
          return json({ success: false, error: "صيغة التاريخ يجب أن تكون YYYY-MM-DD" }, 400);
        const { data, error } = await db()
          .from("cashier_sales")
          .select("*")
          .gte("sale_date", from)
          .lte("sale_date", to)
          .order("created_at", { ascending: false });
        if (error) return json({ success: false, error: error.message }, 500);
        const rows = data ?? [];
        let total_qty = 0, total_retail = 0, total_wholesale = 0;
        for (const r of rows) {
          total_qty += Number(r.quantity);
          total_retail += Number(r.quantity) * Number(r.retail_price);
          total_wholesale += Number(r.quantity) * Number(r.wholesale_price);
        }
        return json({
          success: true,
          data: {
            from, to,
            summary: { operations: rows.length, total_qty, total_retail, total_wholesale, total_profit: total_retail - total_wholesale },
            sales: rows,
          },
        });
      },
    },
  },
});
