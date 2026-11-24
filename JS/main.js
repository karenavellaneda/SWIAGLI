/**
 * Punto de entrada de la aplicación SWIACLI.
 * Inicializa repositorio, datos semilla, servicios y coordina login vs aplicación.
 */

import { defaultRepo } from './data/repository.js';
import { ensureSeeded, resetToSeed } from './data/seed.js';
import { createAuthService } from './services/authService.js';
import { createInventoryService } from './services/inventoryService.js';
import { createCashSalesService } from './services/cashSalesService.js';
import { createAccountingService } from './services/accountingService.js';
import { createHrService } from './services/hrService.js';
import { createScheduleAttendanceService } from './services/scheduleAttendanceService.js';
import { createReportService } from './services/reportService.js';
import { createDashboardService } from './services/dashboardService.js';
import { renderAuthView } from './ui/authView.js';
import { createAppShell } from './ui/router.js';

function buildServices(repo) {
  const authService = createAuthService(repo);
  const inventoryService = createInventoryService(repo, authService);
  const cashSalesService = createCashSalesService(repo, authService, inventoryService);
  const accountingService = createAccountingService(repo, authService);
  const hrService = createHrService(repo, authService);
  const scheduleAttendanceService = createScheduleAttendanceService(repo, authService);
  const reportService = createReportService(repo, {
    authService,
    cashSalesService,
    inventoryService,
    accountingService,
    scheduleAttendanceService
  });
  const dashboardService = createDashboardService(repo, {
    authService,
    cashSalesService,
    inventoryService
  });

  return {
    authService,
    inventoryService,
    cashSalesService,
    accountingService,
    hrService,
    scheduleAttendanceService,
    reportService,
    dashboardService
  };
}

async function bootstrap() {
  const appEl = document.getElementById('app');

  try {
    await ensureSeeded(defaultRepo);
  } catch (err) {
    appEl.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="alert alert-danger">
            <strong>Error de inicialización:</strong> ${err.message}
          </div>
        </div>
      </div>`;
    return;
  }

  const services = buildServices(defaultRepo);

  async function handleResetSampleData() {
    await resetToSeed(defaultRepo);
  }

  function showLogin(initialToken = '') {
    renderAuthView(appEl, {
      authService: services.authService,
      initialToken,
      onLoginSuccess: () => showShell(),
      onResetSampleData: handleResetSampleData
    });
  }

  function showShell() {
    createAppShell(appEl, {
      services,
      onLogout: () => {
        window.location.hash = '';
        showLogin();
      },
      onResetSampleData: handleResetSampleData
    });
  }

  const resetMatch = window.location.hash.match(/token=([a-zA-Z0-9]+)/);
  if (resetMatch) {
    showLogin(resetMatch[1]);
    return;
  }

  if (services.authService.getCurrentUser()) {
    showShell();
  } else {
    showLogin();
  }
}

bootstrap();