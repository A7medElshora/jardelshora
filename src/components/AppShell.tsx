import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  PackagePlus,
  Boxes,
  History,
  FileBarChart2,
  LogOut,
  ScanBarcode,
  Layers,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { to: "/daily", label: "الجرد اليومي", icon: CalendarDays },
  { to: "/weekly", label: "الجرد الأسبوعي", icon: CalendarRange },
  { to: "/monthly", label: "الجرد الشهري", icon: CalendarCheck2 },
  { to: "/purchases", label: "المضاف (الوارد)", icon: PackagePlus },
  { to: "/products", label: "الأصناف", icon: Boxes },
  { to: "/profits", label: "الأرباح", icon: FileBarChart2 },
  { to: "/taqseemat", label: "تقسيمات", icon: Layers },
  { to: "/cashier", label: "الكاشير", icon: ScanBarcode },
  { to: "/quotation", label: "بيان أسعار", icon: History },
  { to: "/price-history", label: "سجل الأسعار", icon: History },
  { to: "/reports", label: "التقارير", icon: FileBarChart2 },
];

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background text-foreground" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed lg:static inset-y-0 right-0 z-40 w-72 bg-sidebar text-sidebar-foreground border-l border-sidebar-border shadow-elevated transition-transform",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center text-white font-extrabold shadow-elevated">ش</div>
            <div>
              <div className="font-bold text-base leading-tight">الشوره ماركت</div>
              <div className="text-xs text-sidebar-foreground/70">نظام الجرد والمخزون</div>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to as never}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-card"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-sidebar-border space-y-2">
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span>{theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</span>
            </span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
          >
            <LogOut className="size-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border/80 shadow-xs">
          <div className="flex items-center gap-3 px-4 lg:px-8 py-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground hover:bg-muted"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <h1 className="text-lg lg:text-xl font-extrabold tracking-tight text-foreground">{title}</h1>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
                <span>النظام متصل</span>
              </div>
            </div>

            <div className="ms-auto flex items-center gap-2">
              <Link
                to="/cashier"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
              >
                <ScanBarcode className="size-4" />
                <span>الكاشير السريع</span>
              </Link>

              <button
                onClick={toggle}
                className="size-9 rounded-xl border border-border/80 bg-card hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
                title={theme === "dark" ? "التحويل للوضع الفاتح" : "التحويل للوضع الداكن"}
              >
                {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
              </button>

              <div className="flex items-center gap-2 ps-2 border-s border-border">
                <div className="hidden sm:block text-start leading-tight">
                  <div className="text-xs font-bold text-foreground">المشرف</div>
                  <div className="text-[10px] text-muted-foreground">مدير النظام</div>
                </div>
                <div className="size-8 rounded-xl bg-gradient-primary text-white grid place-items-center text-xs font-extrabold shadow-sm">
                  A
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
