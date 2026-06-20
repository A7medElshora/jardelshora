import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Lock, User, Boxes } from "lucide-react";
import { toast } from "sonner";

export function LoginScreen() {
  const { login } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const ok = login(u, p);
      setLoading(false);
      if (!ok) toast.error("بيانات الدخول غير صحيحة");
      else toast.success("تم تسجيل الدخول بنجاح");
    }, 250);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-secondary to-accent p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center text-white shadow-elevated mb-3">
            <Boxes className="size-8" />
          </div>
          <h1 className="text-2xl font-extrabold">الشوره ماركت</h1>
          <p className="text-sm text-muted-foreground mt-1">نظام الجرد وإدارة المخزون</p>
        </div>
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-elevated space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={u}
                onChange={(e) => setU(e.target.value)}
                className="w-full h-11 rounded-lg border border-input bg-background px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin"
                autoFocus
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={p}
                onChange={(e) => setP(e.target.value)}
                type="password"
                className="w-full h-11 rounded-lg border border-input bg-background px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-gradient-primary text-white font-bold hover:opacity-95 disabled:opacity-60 transition-opacity shadow-elevated"
          >
            {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
          </button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            بيانات الدخول الافتراضية: <span className="font-mono font-bold">admin / admin</span>
          </p>
        </form>
      </div>
    </div>
  );
}
