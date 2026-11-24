/**
 * Vista de Contabilidad Básica (solo Administrador):
 * Gastos, Pagos al Personal (no liquida nómina) y Equilibrio Financiero.
 */

import { EXPENSE_CATEGORIES } from '../services/accountingService.js';
import { escapeHtml, formatCOP, formatDate, getLocalDateString } from '../utils/formatters.js';
import { renderAccessDenied, showConfirmDialog, showToast, statusBadge } from './components.js';

export function renderAccountingView(container, { user, services }) {
  if (!services.authService.hasPermission('accounting.manage', user)) {
    renderAccessDenied(container);
    return;
  }

  const today = getLocalDateString();
  const monthStart = `${today.slice(0, 8)}01`;

  let activeTab = 'expenses';
  let editingExpenseId = null;
  let period = { from: monthStart, to: today };

  function render() {
    const activeSuppliers = services.inventoryService.listSuppliers(true);
    const activeWorkers = services.hrService.listWorkers(true);
    const expenses = services.accountingService.listExpenses({});
    const payments = services.accountingService.listStaffPayments({});
    const editingExpense = editingExpenseId ? expenses.find((e) => e.id === editingExpenseId) : null;

    let summary = null;
    let summaryError = '';
    try {
      summary = services.accountingService.getFinancialSummary(period.from, period.to);
    } catch (err) {
      summaryError = err.message;
    }

    container.innerHTML = `
      <div class="tabs" role="tablist">
        <button type="button" class="tab-btn ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Gastos</button>
        <button type="button" class="tab-btn ${activeTab === 'payments' ? 'active' : ''}" data-tab="payments">Pagos al personal</button>
        <button type="button" class="tab-btn ${activeTab === 'summary' ? 'active' : ''}" data-tab="summary">Resumen y equilibrio</button>
      </div>

      ${
        activeTab === 'expenses'
          ? `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${editingExpense ? 'Editar gasto' : 'Registrar nuevo gasto'}</h2>
            ${editingExpense ? '<button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-exp">Cancelar edición</button>' : ''}
          </div>
          <form id="expense-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="exp-desc">Descripción</label>
                <input id="exp-desc" class="form-control" type="text" required value="${escapeHtml(editingExpense?.description || '')}" />
              </div>
              <div class="form-group">
                <label for="exp-date">Fecha</label>
                <input id="exp-date" class="form-control" type="date" required value="${editingExpense?.date || today}" />
              </div>
              <div class="form-group">
                <label for="exp-cat">Categoría</label>
                <select id="exp-cat" class="form-control" required>
                  ${EXPENSE_CATEGORIES.map(
                    (c) => `<option value="${escapeHtml(c)}" ${editingExpense?.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="exp-amount">Valor (COP)</label>
                <input id="exp-amount" class="form-control" type="number" min="1" step="1" required value="${editingExpense?.amount || ''}" />
              </div>
              <div class="form-group">
                <label for="exp-sup">Proveedor (opcional, solo activos)</label>
                <select id="exp-sup" class="form-control">
                  <option value="">Sin proveedor</option>
                  ${activeSuppliers
                    .map(
                      (s) =>
                        `<option value="${s.id}" ${editingExpense?.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">${editingExpense ? 'Actualizar gasto' : 'Guardar gasto'}</button>
          </form>
        </div>

        <div class="card">
          <h2 class="card-title">Historial de gastos</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Proveedor</th>
                  <th>Responsable</th>
                  <th class="text-right">Valor</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${expenses
                  .map(
                    (e) => `
                  <tr>
                    <td>${formatDate(e.date)}</td>
                    <td>${escapeHtml(e.category)}</td>
                    <td>${escapeHtml(e.description)}</td>
                    <td>${e.supplierName ? escapeHtml(e.supplierName) : '—'}</td>
                    <td>${escapeHtml(e.responsibleName)}</td>
                    <td class="text-right"><strong>${formatCOP(e.amount)}</strong></td>
                    <td>
                      ${statusBadge(e.status)}
                      ${e.status === 'ANULADO' ? `<br /><small>${escapeHtml(e.voidReason || '')}</small>` : ''}
                    </td>
                    <td>
                      ${
                        e.status === 'ACTIVO'
                          ? `<div class="btn-group">
                               <button type="button" class="btn btn-secondary btn-sm" data-edit-exp="${e.id}">Editar</button>