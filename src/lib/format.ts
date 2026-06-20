export const EGP = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

export const NUM = (n: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

export const DATE_AR = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
};

export const WEEK_DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/** Returns YYYY-MM-DD for current week's Sunday..Saturday (Cairo-ish, local). */
export function getWeekDates(reference: Date = new Date()): string[] {
  const d = new Date(reference);
  const day = d.getDay(); // 0=Sun..6=Sat
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(sunday);
    x.setDate(sunday.getDate() + i);
    return toISODate(x);
  });
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function monthRange(year: number, month0: number) {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}
