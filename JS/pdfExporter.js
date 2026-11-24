/**
 * Exportador de reportes a PDF usando jsPDF + jsPDF-AutoTable cargados vía CDN.
 */

import { getLocalDateTimeISO, formatDateTime } from './formatters.js';

export function exportReportToPDF(report) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('No se pudo cargar la librería jsPDF desde el CDN.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(15);
  doc.setTextColor(62, 39, 35);
  doc.text('SWIACLI - Cafetería y Panadería Tunja', 14, 16);

  doc.setFontSize(12);
  doc.text(report.title, 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(92, 75, 69);
  doc.text(`${report.subtitle} | Generado: ${formatDateTime(getLocalDateTimeISO())}`, 14, 30);

  let startY = 36;

  if (report.summaryItems && report.summaryItems.length > 0) {
    const summaryLine = report.summaryItems.map((s) => `${s.label}: ${s.value}`).join('   |   ');
    doc.setFontSize(9.5);
    doc.setTextColor(35, 23, 19);
    const split = doc.splitTextToSize(summaryLine, doc.internal.pageSize.getWidth() - 28);
    doc.text(split, 14, startY);
    startY += split.length * 5 + 4;
  }

  if (typeof doc.autoTable !== 'function') {
    throw new Error('El plugin jsPDF-AutoTable no está disponible.');
  }

  doc.autoTable({
    startY,
    head: [report.columns],
    body: report.rows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    headStyles: {
      fillColor: [62, 39, 35],
      textColor: [255, 250, 244]
    },
    alternateRowStyles: {
      fillColor: [250, 243, 232]
    }
  });

  const fileSlug = report.type || 'reporte';
  doc.save(`swiacli_${fileSlug}_${getLocalDateTimeISO().slice(0, 10)}.pdf`);
}