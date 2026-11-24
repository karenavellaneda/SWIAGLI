/**
 * Vista de Reportes (solo Administrador) con vista previa y exportación PDF vía jsPDF-AutoTable.
 */

import { escapeHtml, getLocalDateString } from '../utils/formatters.js';
import { exportReportToPDF } from '../utils/pdfExporter.js';
import { renderAccessDenied, showToast } from './components.js';

const REPORT_TYPES = [
  { key: 'sales', label: 'Ventas válidas' },
  { key: 'expenses', label: 'Gastos activos' },
  { key: 'staffPayments', label: 'Pagos al personal' },
  { key: 'cashRegisters', label: 'Cajas y arqueos' },
  { key: 'inventory', label: 'Inventario actual' },
  { key: 'attendance', label: 'Asistencia' },
  { key: 'financialSummary', label: 'Resumen financiero' }
];

export function renderReportsView(container, { user, services }) {
  if (!services.authService.hasPermission('reports.view', user)) {
    renderAccessDenied(container);
    return;
  }

  const today = getLocalDateString();
  const monthStart = `${today.slice(0, 8)}01`;

  let selectedType = 'sales';
  let from = monthStart;
  let to = today;
  let currentReport = null;

  function generate() {
    try {
      currentReport = services.reportService.generateReport(selectedType, { from, to });
    } catch (err) {
      currentReport = null;
      showToast(err.message, 'error');
    }
  }

  function render() {
    if (!currentReport) generate();

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Generador de reportes (excluye registros anulados)</h2>
        <form id="report-form" class="form-grid">
          <div class="form-group">
            <label for="rep-type">Tipo de reporte</label>
            <select id="rep-type" clas