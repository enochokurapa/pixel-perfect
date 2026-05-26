import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportRow = Record<string, string | number | null | undefined>;

export function exportExcel(filename: string, rows: ExportRow[], sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPdf(filename: string, title: string, rows: ExportRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(`${filename}.pdf`);
}

export function exportDetailPdf(filename: string, title: string, sections: { heading: string; rows: [string, string][] }[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  let y = 24;
  sections.forEach((sec) => {
    autoTable(doc, {
      head: [[sec.heading, ""]],
      body: sec.rows,
      startY: y,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    });
    // @ts-expect-error - lastAutoTable injected by autoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  });
  doc.save(`${filename}.pdf`);
}
