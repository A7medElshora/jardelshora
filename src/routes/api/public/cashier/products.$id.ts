import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { checkKey, db, json, preflight, readBody } from "@/lib/cashier.server";

const PatchSchema = z
  .object({
    barcode: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(200),
    wholesale_price: z.coerce.number().min(0),
    retail_price: z.coerce.number().min(0),
    quantity: z.coerce.number().min(0),
    low_stock_threshold: z.coerce.number().min(0),
  })
  .partial();

const Id = z.string().uuid();

export const Route = createFileRoute("/api/public/cashier/products/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      PUT: async ({ request, params }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        if (!Id.safeParse(params.id).success) return json({ success: false, error: "معرّف غير صحيح" }, 400);
        const parsed = PatchSchema.safeParse(await readBody(request));
        if (!parsed.success || Object.keys(parsed.data).length === 0)
          return json({ success: false, error: "بيانات غير صحيحة" }, 400);
        const { data, error } = await db().from("cashier_products").update(parsed.data).eq("id", params.id).select().maybeSingle();
        if (error) return json({ success: false, error: error.code === "23505" ? "الباركود أو الاسم مستخدم" : error.message }, error.code === "23505" ? 409 : 500);
        if (!data) return json({ success: false, error: "الصنف غير موجود" }, 404);
        return json({ success: true, data });
      },
      DELETE: async ({ request, params }) => {
        const denied = checkKey(request);
        if (denied) return denied;
        if (!Id.safeParse(params.id).success) return json({ success: false, error: "معرّف غير صحيح" }, 400);
        const { data, error } = await db().from("cashier_products").delete().eq("id", params.id).select("id");
        if (error) return json({ success: false, error: error.message }, 500);
        if (!data?.length) return json({ success: false, error: "الصنف غير موجود" }, 404);
        return json({ success: true });
      },
    },
  },
});
