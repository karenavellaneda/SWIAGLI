/**
 * Servicio de Panel Principal (Dashboard).
 * Consolida indicadores respetando los permisos del usuario autenticado.
 */

import { getLocalDateString } from '../utils/formatters.js';

export function createDashboardService(repo, { authService, cashSalesService, inventoryService }) {
  function getDashboardData(user = authService.getCurrentUser()) {
    const today = getLocalDateString();
    const monthPrefix = today.slice(0, 7); // YYYY-MM

    const canSales = authService.hasPermission('sales.view', user) || authService.hasPermission('sales.create', user);
    const canCash =
      authService.hasPermission('cash.open', user) ||
      authService.hasPermission('cash.movements', user) ||
      authService.hasPermission('cash.close', user) ||
      canSales;
    const canAccounting = authService.hasPermission('accounting.manage', user);
    const canHr = authService.hasPermission('hr.manage', user);
    const canInventory = authService.hasPermission('inventory.view', user);

    let todaySales = null;
    if (canSales) {
      const list = repo
        .getCollection('sales')
        .filter((s) => !s.voided && s.date === today);
      todaySales = {
        count: list.length,
        total: list.reduce((acc, s) => acc + s.total, 0)
      };
    }

    let cashState = null;
    if (canCash) {
      const active = cashSalesService.getActiveCashRegister();
      if (active) {
        const sum = cashSalesService.getCashSummary(active.id);
        cashState = {
          status: active.status,
          availableCash: sum.availableCash,
          openedBy: active.openedByUsername
        };
      } else {
        cashState = { status: 'CERRADA', availableCash: 0, openedBy: null };
      }
    }

    let monthExpenses = null;
    if (canAccounting) {
      const list = repo
        .getCollection('expenses')
        .filter((e) => e.status !== 'ANULADO' && e.date.startsWith(monthPrefix));
      monthExpenses = {
        count: list.length,
        total: list.reduce((acc, e) => acc + e.amount, 0)
      };
    }

    let activeWorkersCount = null;
    if (canHr) {
      activeWorkersCount = repo
        .getCollection('workers')
        .filter((w) => w.status === 'ACTIVO').length;
    }

    let lowStockProducts = null;
    if (canInventory) {
      lowStockProducts = inventoryService.getLowStockProducts();
    }

    return {
      today,
      todaySales,
      cashState,
      monthExpenses,
      activeWorkersCount,
      lowStockProducts
    };
  }

  return { getDashboardData };
}