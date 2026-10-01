import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

/** يرجع Response خطأ إذا كان المفتاح غير صحيح، وإلا null */
export function checkKey(request: Request): Response | null {
  const expected = process.env["CASHIER_API_KEY"];
  if (!expected) return json({ success: false, error: "مفتاح API غير مُعد على الخادم" }, 500);
  const got = request.headers.get("x-api-key") ?? "";
  if (got.length !== expected.length) return json({ success: false, error: "غير مصرح" }, 401);
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return json({ success: false, error: "غير مصرح" }, 401);
  return null;
}

export function db() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export function cairoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
