import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { checkKey, db, json, preflight, readBody } from "@/lib/cashier.server";

const ProductSchema = z.object({
  barcode: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  wholesale_price: z.coerce.number().min(0),
  retail_price: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  low_stock_threshold: z.coerce.number().min(0).optional(),
});

export const Route = createFileRoute("/api/public/cashier/products")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const barcode = url.searchParams.get("barcode");
        let q = db().from("cashier_products").select("*").order("name");
        if (barcode) q = q.eq("barcode", barcode);
        const { data, error } = await q;
        if (error) return json({ success: false, error: error.message }, 500);
        return json({ success: true, data });
      },
      POST: async ({ request }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        const parsed = ProductSchema.safeParse(await readBody(request));
        if (!parsed.success) return json({ success: false, error: "بيانات غير صحيحة", details: parsed.error.flatten() }, 400);
        const { data, error } = await db().from("cashier_products").insert(parsed.data).select().single();
        if (error) {
          const dup = error.code === "23505";
          return json({ success: false, error: dup ? "الباركود أو اسم الصنف موجود مسبقاً" : error.message }, dup ? 409 : 500);
        }
        return json({ success: true, data }, 201);
      },
    },
  },
});
