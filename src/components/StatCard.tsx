import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  variant = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  variant?: "primary" | "success" | "warning" | "info" | "danger";
}) {
  const bg = {
    primary: "bg-gradient-primary",
    success: "bg-gradient-success",
    warning: "bg-gradient-warning",
    info: "bg-gradient-info",
    danger: "bg-gradient-danger",
  }[variant];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-extrabold tracking-tight truncate">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className={cn("size-11 rounded-xl text-white grid place-items-center shadow-card shrink-0", bg)}>
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </div>
  );
}
