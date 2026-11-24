/**
 * Servicio de Contabilidad Básica (solo Administrador).
 * Gestiona gastos, pagos al personal (sin cálculo de nómina) y equilibrio financiero.
 */

import { getLocalDateTimeISO, formatCOP } from '../utils/formatters.js';
import {
  requireNonEmpty,
  requirePositiveInt,
  validateDateRange
} from '../utils/validators.js';

export const EXPENSE_CATEGORIES = [
  'Insumos y Materia Prima',
  'Servicios Públicos',
  'Arriendo',
  'Mantenimiento y Aseo',
  'Transporte y Domicilios',
  'Otros Gastos'
];

export function createAccountingService(repo, authService) {
  function listExpenses({ from = '', to = '', category = '' } = {}) {
    authService.requirePermission('accounting.manage');
    validateDateRange(from, to);
    return repo.getCollection('expenses').filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (category && e.category !== category) return false;
      return true;
    });
  }

  function createExpense(data) {
    const user = authService.requirePermission('accounting.manage');
    const description = requireNonEmpty(data.description, 'Descripción');
    const date = requireNonEmpty(data.date, 'Fecha');
    const category = requireNonEmpty(data.category, 'Categoría');
    const amount = requirePositiveInt(data.amount, 'Valor');

    let supplierId = data.supplierId || null;
    let supplierName = null;
    if (supplierId) {
      const sup = repo.getCollection('suppliers').find((s) => s.id === supplierId);
      if (!sup || !sup.active) {
        throw new Error('El proveedor seleccionado no existe o está inactivo.');
      }
      supplierName = sup.name;
    }

    const expenses = repo.getCollection('expenses');
    const expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      date,
      category,
      amount,
      supplierId,
      supplierName,
      responsibleUserId: user.id,
      responsibleName: user.fullName,
      status: 'ACTIVO',
      voidReason: null,
      voidedAt: null,
      voidedBy: null
    };
    expenses.unshift(expense);
    repo.saveCollection('expenses', expenses);
    return expense;
  }

  function updateExpense(id, data) {
    authService.requirePermission('accounting.manage');
    const expenses = repo.getCollection('expenses');
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Gasto no encontrado.');

    const existing = expenses[idx];
    if (existing.status === 'ANULADO') {
      throw new Error('No se puede editar un gasto anulado.');
    }

    const description = requireNonEmpty(data.description ?? existing.description, 'Descripción');
    const date = requireNonEmpty(data.date ?? existing.date, 'Fecha');
    const category = requireNonEmpty(data.category ?? existing.category, 'Categoría');
    const amount = requirePositiveInt(data.amount ?? existing.amount, 'Valor');

    let supplierId = data.supplierId !== undefined ? data.supplierId || null : existing.supplierId;
    let supplierName = existing.supplierName;

    if (supplierId) {
      const sup = repo.getCollection('suppliers').find((s) => s.id === supplierId);
      if (!sup) throw new Error('Proveedor no encontrado.');
      if (!sup.active && supplierId !== existing.supplierId) {
        throw new Error('No se puede asignar un proveedor inactivo.');
      }
      supplierName = sup.name;
    } else {
      supplierName = null;
    }

    expenses[idx] = {
      ...existing,
      description,
      date,
      category,
      amount,
      supplierId,
      supplierName
    };
    repo.saveCollection('expenses', expenses);
    return expenses[idx];
  }

  function voidExpense(id, reason) {
    const user = authService.requirePermission('accounting.manage');
    const cleanReason = requireNonEmpty(reason, 'Motivo de anulación');
    const expenses = repo.getCollection('expenses');
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Gasto no encontrado.');
    if (expenses[idx].status === 'ANULADO') {
      throw new Error('El gasto ya está anulado.');
    }

    expenses[idx] = {
      ...expenses[idx],
      status: 'ANULADO',
      voidReason: cleanReason,
      voidedAt: getLocalDateTimeISO(),
      voidedBy: user.username
    };
    repo.saveCollection('expenses', expenses);
    authService.logAudit(
      'ANULACION_GASTO',
      `Gasto "${expenses[idx].description}" (${formatCOP(expenses[idx].amount)}) anulado: ${cleanReason}`,
      user
    );
    return expenses[idx];
  }

  function listStaffPayments({ from = '', to = '', workerId = '' } = {}) {
    authService.requirePermission('accounting.manage');
    validateDateRange(from, to);
    return repo.getCollection('staffPayments').filter((p) => {
      if (from && p.date < from) return false;
      if (to && p.date > to) return false;
      if (workerId && p.workerId !== workerId) return false;
      return true;
    });
  }

  function createStaffPayment(data) {
    authService.requirePermission('accounting.manage');
    const workerId = requireNonEmpty(data.workerId, 'Trabajador');
    const date = requireNonEmpty(data.date, 'Fecha');
    const concept = requireNonEmpty(data.concept, 'Concepto');
    const amount = requirePositiveInt(data.amount, 'Valor');

    const workers = repo.getCollection('workers');
    const worker = workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'ACTIVO') {
      throw new Error('Solo se pueden registrar pagos a trabajadores en estado ACTIVO.');
    }
    const resume = repo.getCollection('resumes').find((r) => r.id === worker.resumeId);
    const workerName = resume ? resume.fullName : worker.id;

    const payments = repo.getCollection('staffPayments');
    const payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workerId,
      workerName,
      date,
      concept,
      amount,
      status: 'ACTIVO',
      voidReason: null,
      voidedAt: null,
      voidedBy: null
    };
    payments.unshift(payment);
    repo.saveCollection('staffPayments', payments);
    return payment;
  }

  function voidStaffPayment(id, reason) {
    const user = authService.requirePermission('accounting.manage');
    const cleanReason = requireNonEmpty(reason, 'Motivo de anulación');
    const payments = repo.getCollection('staffPayments');
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Pago no encontrado.');
    if (payments[idx].status === 'ANULADO') {
      throw new Error('Este pago ya está anulado.');
    }

    payments[idx] = {
      ...payments[idx],
      status: 'ANULADO',
      voidReason: cleanReason,
      voidedAt: getLocalDateTimeISO(),
      voidedBy: user.username
    };
    repo.saveCollection('staffPayments', payments);
    authService.logAudit(
      'ANULACION_PAGO_PERSONAL',
      `Pago a ${payments[idx].workerName} (${formatCOP(payments[idx].amount)}) anulado: ${cleanReason}`,
      user
    );
    return payments[idx];
  }

  /**
   * Resumen financiero por rango de fechas. Excluye registros anulados.
   * Equilibrio = ventas - gastos - pagos.
   */
  function getFinancialSummary(from = '', to = '') {
    authService.requirePermission('accounting.manage');
    validateDateRange(from, to);

    const sales = repo.getCollection('sales').filter((s) => {
      if (s.voided) return false;
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });

    const expenses = repo.getCollection('expenses').filter((e) => {
      if (e.status === 'ANULADO') return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });

    const payments = repo.getCollection('staffPayments').filter((p) => {
      if (p.status === 'ANULADO') return false;
      if (from && p.date < from) return false;
      if (to && p.date > to) return false;
      return true;
    });

    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
    const equilibrium = totalSales - totalExpenses - totalPayments;

    const expensesByCategory = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    }

    return {
      from,
      to,
      salesCount: sales.length,
      expensesCount: expenses.length,
      paymentsCount: payments.length,
      totalSales,
      totalExpenses,
      totalPayments,
      equilibrium,
      expensesByCategory
    };
  }

  return {
    listExpenses,
    createExpense,
    updateExpense,
    voidExpense,
    listStaffPayments,
    createStaffPayment,
    voidStaffPayment,
    getFinancialSummary
  };
}