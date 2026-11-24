/**
 * Enrutador y Shell principal autenticado.
 * Construye el menú según permisos del rol y valida acceso en cada vista.
 */

import { escapeHtml } from '../utils/formatters.js';
import { renderAccessDenied, showConfirmDialog, showToast } from './components.js';
import { renderDashboardView } from './dashboardView.js';
import { renderCashSalesView } from './cashSalesView.js';
import { renderInventoryView } from './inventoryView.js';
import { renderAccountingView } from './accountingView.js';
import { renderHrView } from './hrView.js';
import { renderAttendanceView } from './attendanceView.js';
import { renderReportsView } from './reportsView.js';
import { renderUsersView } from './usersView.js';
import { renderAccountView } from './accountView.js';

export function createAppShell(rootEl, { services, onLogout, onResetSampleData }) {
  let currentRoute = null;
  let sidebarOpen = false;

  const ROUTES = [
    {
      key: 'dashboard',
      label: 'Panel principal',
      isAllowed: (u) => services.authService.hasPermission('dashboard.view', u),
      render: renderDashboardView
    },
    {
      key: 'cash-sales',
      label: 'Caja y Ventas',
      isAllowed: (u) =>
        services.authService.hasPermission('sales.create', u) ||
        services.authService.hasPermission('sales.view', u) ||
        services.authService.hasPermission('cash.open', u) ||
        services.authService.hasPermission('cash.movements', u) ||
        services.authService.hasPermission('cash.close', u),
      render: renderCashSalesView
    },
    {
      key: 'inventory',
      label: 'Inventario',
      isAllowed: (u) => services.authService.hasPermission('inventory.view', u),
      render: renderInventoryView
    },
    {
      key: 'accounting',
      label: 'Contabilidad',
      isAllowed: (u) => services.authService.hasPermission('accounting.manage', u),
      render: renderAccountingView
    },
    {
      key: 'hr',
      label: 'Personal y Contratos',
      isAllowed: (u) => services.authService.hasPermission('hr.manage', u),
      render: renderHrView
    },
    {
      key: 'attendance',
      label: 'Horarios y Asistencia',
      isAllowed: (u) =>
        services.authService.hasPermission('attendance.own', u) ||
        services.authService.hasPermission('attendance.all', u),
      render: renderAttendanceView
    },
    {
      key: 'reports',
      label: 'Reportes PDF',
      isAllowed: (u) => services.authService.hasPermission('reports.view', u),
      render: renderReportsView
    },
    {
      key: 'users',
      label: 'Usuarios y Seguridad',
      isAllowed: (u) => services.authService.hasPermission('users.manage', u),
      render: renderUsersView
    },
    {
      key: 'account',
      label: 'Mi cuenta',
      isAllowed: () => true,
      render: renderAccountView
    }
  ];

  function getDefaultRoute(user) {
    const firstAllowed = ROUTES.find((r) => r.isAllowed(user));
    return firstAllowed ? firstAllowed.key : 'account';
  }

  function navigate(routeKey) {
    currentRoute = routeKey;
    sidebarOpen = false;
    window.location.hash = `#/${routeKey}`;
    render();
  }

  function render() {
    const user = services.authService.getCurrentUser();
    if (!user) {
      onLogout();
      return;
    }

    const hashMatch = window.location.hash.match(/^#\/([a-z-]+)/);
    const requestedRoute = hashMatch ? hashMatch[1] : currentRoute || getDefaultRoute(user);
    currentRoute = requestedRoute;

    const visibleNav = ROUTES.filter((r) => r.isAllowed(user));
    const routeObj = ROUTES.find((r) => r.key === currentRoute);

    rootEl.innerHTML = `
      <div class="layout">
        <aside class="sidebar ${sidebarOpen ? 'open' : ''}" aria-label="Menú principal">
          <div class="brand">
            <div class="brand-icon" aria-hidden="true">SW</div>
            <div>
              <p class="brand-title">SWIACLI</p>
              <span class="brand-sub">Cafetería Tunja</span>
            </div>
          </div>

          <ul class="nav-list">
            ${visibleNav
              .map(
                (r) => `
              <li>
                <button type="button" class="nav-btn ${r.key === currentRoute ? 'active' : ''}" data-route="${r.key}">
                  ${escapeHtml(r.label)}
                </button>
              </li>`
              )
              .join('')}
          </ul>

          <div class="sidebar-footer">
            <button type="button" class="btn btn-secondary btn-sm" id="reset-sample-btn">Restablecer datos de ejemplo</button>
            <button type="button" class="btn btn-danger btn-sm" id="logout-btn">Cerrar sesión</button>
          </div>
        </aside>

        <div class="main-area">
          <header class="topbar">
            <div class="topbar-left">
              <button type="button" class="menu-toggle" id="menu-toggle-btn" aria-label="Abrir menú">☰</button>
              <h1 class="topbar-title">${escapeHtml(routeObj ? routeObj.label : 'SWIACLI')}</h1>
            </div>
            <div class="topbar-user">
              <span class="user-pill">${escapeHtml(user.fullName)} (${escapeHtml(user.role)})</span>
            </div>
          </header>

          <main id="view-content" class="content"></main>
        </div>
      </div>
    `;

    const viewContainer = document.getElementById('view-content');
    if (!routeObj || !routeObj.isAllowed(user)) {
      renderAccessDenied(viewContainer);
    } else {
      routeObj.render(viewContainer, { user, services, navigate });
    }

    rootEl.querySelectorAll('[data-route]').forEach((btn) => {
      btn.onclick = () => navigate(btn.dataset.route);
    });

    document.getElementById('menu-toggle-btn').onclick = () => {
      sidebarOpen = !sidebarOpen;
      const sb = rootEl.querySelector('.sidebar');
      if (sb) sb.classList.toggle('open', sidebarOpen);
    };

    document.getElementById('logout-btn').onclick = () => {
      services.authService.logout();
      onLogout();
    };

    document.getElementById('reset-sample-btn').onclick = async () => {
      const ok = await showConfirmDialog({
        title: 'Restablecer datos de ejemplo',
        message: 'Se borrarán los datos actuales del navegador y se cargarán los datos iniciales de ejemplo. ¿Continuar?',
        confirmLabel: 'Sí, restablecer',
        confirmVariant: 'danger'
      });
      if (!ok) return;
      await onResetSampleData();
      showToast('Datos de ejemplo restablecidos. Inicie sesión nuevamente.', 'success');
      onLogout();
    };
  }

  window.addEventListener('hashchange', () => {
    if (services.authService.getCurrentUser()) {
      render();
    }
  });

  render();
}