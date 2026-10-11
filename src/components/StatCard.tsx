import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  variant = "primary",
  to,
  badge,
  badgeVariant = "neutral",
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  variant?: "primary" | "success" | "warning" | "info" | "danger";
  to?: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "danger" | "info" | "neutral";
  trend?: { value: string; positive?: boolean };
}) {
  const bg = {
    primary: "bg-gradient-primary shadow-primary/20",
    success: "bg-gradient-success shadow-success/20",
    warning: "bg-gradient-warning shadow-warning/20",
    info: "bg-gradient-info shadow-info/20",
    danger: "bg-gradient-danger shadow-destructive/20",
  }[variant];

  const borderAccent = {
    primary: "hover:border-primary/40",
    success: "hover:border-success/40",
    warning: "hover:border-warning/40",
    info: "hover:border-info/40",
    danger: "hover:border-destructive/40",
  }[variant];

  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    neutral: "bg-muted text-muted-foreground border-border",
  }[badgeVariant];

  const content = (
    <div
      className={cn(
        "group relative overflow-hidden bg-card/90 backdrop-blur-sm border border-border/80 rounded-2xl p-5 shadow-card transition-all duration-200",
        borderAccent,
        to && "cursor-pointer hover:-translate-y-1 hover:shadow-elevated"
      )}
    >
      {/* Subtle top ambient glow */}
      <div className={cn("absolute top-0 right-0 left-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity", bg)} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">{label}</span>
            {badge && (
              <span className={cn("inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border", badgeColors)}>
                {badge}
              </span>
            )}
          </div>

          <div className="mt-2 text-2xl lg:text-3xl font-extrabold tracking-tight truncate text-foreground">
            {value}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded",
                  trend.positive
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                    : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                )}
              >
                {trend.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                <span>{trend.value}</span>
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              "size-12 rounded-2xl text-white grid place-items-center shadow-lg shrink-0 transition-transform duration-200 group-hover:scale-110",
              bg
            )}
          >
            <Icon className="size-6" />
          </div>
        )}
      </div>

      {to && (
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
          <span>عرض التفاصيل</span>
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to as never} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

