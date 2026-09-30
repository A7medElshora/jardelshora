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
        <header className="no-print sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-8 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight">{title}</h1>
            <div className="ms-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">مرحباً، المشرف</span>
              <span className="size-8 rounded-full bg-gradient-primary text-white grid place-items-center text-xs font-bold">A</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
