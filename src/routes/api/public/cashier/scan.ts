import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { cairoToday, checkKey, db, json, preflight, readBody } from "@/lib/cashier.server";

const ScanSchema = z.object({
  barcode: z.string().trim().min(1).max(64),
  quantity: z.coerce.number().positive().max(100000).default(1),
});

export const Route = createFileRoute("/api/public/cashier/scan")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        const parsed = ScanSchema.safeParse(await readBody(request));
        if (!parsed.success) return json({ success: false, error: "بيانات غير صحيحة" }, 400);
        const { barcode, quantity } = parsed.data;
        const sb = db();

        const { data: p, error: pErr } = await sb.from("cashier_products").select("*").eq("barcode", barcode).maybeSingle();
        if (pErr) return json({ success: false, error: pErr.message }, 500);
        if (!p) return json({ success: false, error: "لا يوجد صنف بهذا الباركود" }, 404);
        if (Number(p.quantity) < quantity)
          return json({ success: false, error: `الكمية المتاحة (${p.quantity}) لا تكفي` }, 409);

        const today = cairoToday();
        const newStock = Number(p.quantity) - quantity;

        const { data: sale, error: sErr } = await sb
          .from("cashier_sales")
          .insert({
            product_id: p.id,
            barcode,
            product_name: p.name,
            quantity,
            wholesale_price: p.wholesale_price,
            retail_price: p.retail_price,
            sale_date: today,
          })
          .select()
          .single();
        if (sErr) return json({ success: false, error: sErr.message }, 500);

        await sb.from("cashier_products").update({ quantity: newStock }).eq("id", p.id);

        // ربط مع الجرد اليومي في الموقع
        const { data: ds } = await sb
          .from("daily_sales")
          .select("*")
          .eq("product_id", p.id)
          .eq("sale_date", today)
          .maybeSingle();
        if (ds) {
          await sb.from("daily_sales").update({ quantity_sold: Number(ds.quantity_sold) + quantity }).eq("id", ds.id);
        } else {
          await sb.from("daily_sales").insert({
            product_id: p.id,
            sale_date: today,
            quantity_sold: quantity,
            wholesale_price_snapshot: p.wholesale_price,
            retail_price_snapshot: p.retail_price,
          });
        }

        return json({
          success: true,
          data: {
            sale,
            product: { ...p, quantity: newStock },
            total: quantity * Number(p.retail_price),
            profit: quantity * (Number(p.retail_price) - Number(p.wholesale_price)),
            low_stock: newStock > 0 && newStock <= Number(p.low_stock_threshold),
            out_of_stock: newStock <= 0,
          },
        }, 201);
      },
    },
  },
});
