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

export function exportCsv(filename: string, rows: ExportRow[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escape = (s: unknown) => {
    const str = s == null ? "" : String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPhotoPdf(
  filename: string,
  title: string,
  items: { imageUrl?: string | null; fields: [string, string][] }[],
) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 22;
  for (const item of items) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }
    let hasImage = false;
    if (item.imageUrl) {
      const dataUrl = await fetchImageAsDataUrl(item.imageUrl);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, "JPEG", 14, y, 40, 30);
          hasImage = true;
        } catch {
          try {
            doc.addImage(dataUrl, "PNG", 14, y, 40, 30);
            hasImage = true;
          } catch {
            /* skip image */
          }
        }
      }
    }
    autoTable(doc, {
      body: item.fields,
      startY: y,
      margin: { left: hasImage ? 60 : 14, right: 14 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    });
    // @ts-expect-error - lastAutoTable injected by autoTable
    const tableEnd = (doc.lastAutoTable?.finalY ?? y) + 6;
    y = Math.max(tableEnd, y + (hasImage ? 36 : 0));
  }
  doc.save(`${filename}.pdf`);
}
