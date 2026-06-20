import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName = "تقرير") {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!views"] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(opts: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  // Note: jsPDF Arabic shaping is limited; for production a custom font (e.g. Amiri) would be embedded.
  doc.text(opts.title, doc.internal.pageSize.getWidth() / 2, 14, { align: "center" });
  autoTable(doc, {
    head: [opts.headers],
    body: opts.rows,
    startY: 20,
    styles: { halign: "right", font: "helvetica", fontSize: 9 },
    headStyles: { fillColor: [33, 110, 130] },
    theme: "striped",
  });
  doc.save(`${opts.filename}.pdf`);
}

export function printElement(el: HTMLElement | null) {
  if (!el) return;
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة</title>
    <style>
      body{font-family:'Cairo','Tahoma',sans-serif;padding:24px;color:#0f172a}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #d1d5db;padding:8px;text-align:right}
      th{background:#0f5b6e;color:white}
      h1,h2{margin:0 0 8px}
      .meta{color:#475569;margin-bottom:16px;font-size:12px}
    </style></head><body>${el.outerHTML}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
  w.document.close();
}
