/**
 * Vista del Panel Principal (Dashboard).
 */

import { escapeHtml, formatCOP, formatDate } from '../utils/formatters.js';
import { renderAccessDenied, statusBadge } from './components.js';

export function renderDashboardView(container, { user, services, navigate }) {
  if (!services.authService.hasPermission('dashboard.view', user)) {
    renderAccessDenied(container);
    return;
  }

  const data = services.dashboardService.getDashboardData(user);

  const cardsHtml = [];
  if (data.todaySales) {
    cardsHtml.push(`
      <div class="kpi-card accent">
        <div class="kpi-label">Ventas de hoy (${formatDate(data.today)})</div>
        <div class="kpi-value">${formatCOP(data.todaySales.total)}</div>
        <div class="kpi-sub">${data.todaySales.count} venta(s) válidas registradas</div>
      </div>
    `);
  }

  if (data.cashState) {
    const cls = data.cashState.status === 'ABIERTA' ? 'success' : data.cashState.status === 'EN_ARQUEO' ? 'warning' : 'danger';
    cardsHtml.push(`
      <div class="kpi-card ${cls}">
        <div class="kpi-label">Estado de la caja</div>
        <div class="kpi-value">${escapeHtml(data.cashState.status)}</div>
        <div class="kpi-sub">
          ${data.cashState.status === 'CERRADA'
            ? 'Abra caja para iniciar ventas'
            : `Saldo esperado actual: ${formatCOP(data.cashState.availableCash)}`}
        </div>
      </div>
    `);
  }

  if (data.monthExpenses) {
    cardsHtml.push(`
      <div class="kpi-card">
        <div class="kpi-label">Gastos del mes</div>
        <div class="kpi-value">${formatCOP(data.monthExpenses.total)}</div>
        <div class="kpi-sub">${data.monthExpenses.count} gasto(s) activos</div>
      </div>
    `);
  }

  if (data.activeWorkersCount !== null) {
    cardsHtml.push(`
      <div class="kpi-card success">
        <div class="kpi-label">Trabajadores activos</div>
        <div class="kpi-value">${data.activeWorkersCount}</div>
        <div class="kpi-sub">Personal activo en planta</div>
      </div>
    `);
  }

  if (data.lowStockProducts) {
    const cls = data.lowStockProducts.length > 0 ? 'warning' : 'success';
    cardsHtml.push(`
      <div class="kpi-card ${cls}">
        <div class="kpi-label">Alerta de stock bajo / agotado</div>
        <div class="kpi-value">${data.lowStockProducts.length}</div>
        <div class="kpi-sub">Productos activos en o bajo el mínimo</div>
      </div>
    `);
  }

  const quickActions = [];
  if (services.authService.hasPermission('sales.create', user) || services.authService.hasPermission('cash.open', user)) {
    quickActions.push({ route: 'cash-sales', label: 'Ir a Caja y Ventas', variant: 'accent' });
  }
  if (services.authService.hasPermission('inventory.view', user)) {
    quickActions.push({ route: 'inventory', label: 'Consultar Inventario', variant: 'primary' });
  }
  if (services.authService.hasPermission('accounting.manage', user)) {
    quickActions.push({ route: 'accounting', label: 'Contabilidad', variant: 'secondary' });
  }
  if (services.authService.hasPermission('hr.manage', user)) {
    quickActions.push({ route: 'hr', label: 'Personal y Contratos', variant: 'secondary' });
  }
  if (services.authService.hasPermission('attendance.own', user) || services.authService.hasPermission('attendance.all', user)) {
    quickActions.push({ route: 'attendance', label: 'Horarios y Asistencia', variant: 'secondary' });
  }
  if (services.authService.hasPermission('reports.view', user)) {
    quickActions.push({ route: 'reports', label: 'Reportes PDF', variant: 'secondary' });
  }

  container.innerHTML = `
    <div class="grid-kpi">${cardsHtml.join('')}</div>

    ${
      data.lowStockProducts && data.lowStockProducts.length > 0
        ? `<div class="card">
             <div class="card-header">
               <h2 class="card-title">Alerta de productos con stock bajo o agotado</h2>
               <button type="button" class="btn btn-secondary btn-sm" data-nav="inventory">Ver inventario</button>
             </div>
             <div class="table-wrap">
               <table>
                 <thead>
                   <tr>
                     <th>Código</th>
                     <th>Producto</th>
                     <th>Categoría</th>
                     <th class="text-right">Stock actual</th>
                     <th class="text-right">Stock mínimo</th>
                     <th>Estado</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${data.lowStockProducts
                     .map(
                       (p) => `
                     <tr>
                       <td><code>${escapeHtml(p.code)}</code></td>
                       <td>${escapeHtml(p.name)}</td>
                       <td>${escapeHtml(p.category)}</td>
                       <td class="text-right"><strong>${p.stock}</strong></td>
                       <td class="text-right">${p.minStock}</td>
                       <td>${statusBadge(p.statusLabel)}</td>
                     </tr>`
                     )
                     .join('')}
                 </tbody>
               </table>
             </div>
           </div>`
        : ''
    }

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Accesos rápidos (${escapeHtml(user.role)})</h2>
      </div>
      <div class="btn-group">
        ${quickActions
          .map(
            (a) =>
              `<button type="button" class="btn btn-${a.variant}" data-nav="${a.route}">${escapeHtml(a.label)}</button>`
          )
          .join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.nav);
  });
}