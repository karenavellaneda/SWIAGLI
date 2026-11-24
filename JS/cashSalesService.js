/**
 * Servicio de Caja y Ventas.
 * Ciclo de caja: ABIERTA -> EN_ARQUEO -> CERRADA (y EN_ARQUEO -> ABIERTA si se cancela).
 * Coordina transacciones atómicas de venta junto con inventoryService.
 */

import { getLocalDateTimeISO, getLocalDateString, formatCOP } from '../utils/formatters.js';
import {
  requireNonEmpty,
  requireNonNegativeInt,
  requirePositiveInt,
  validateDateRange
} from '../utils/validators.js';

export function createCashSalesService(repo, authService, inventoryService) {
  function getActiveCashRegister() {
    const registers = repo.getCollection('cashRegisters');
    return registers.find((r) => r.status === 'ABIERTA' || r.status === 'EN_ARQUEO') || null;
  }

  function listCashRegisters() {
    return repo.getCollection('cashRegisters');
  }

  function getCashSummary(registerId) {
    const registers = repo.getCollection('cashRegisters');
    const register = registers.find((r) => r.id === registerId);
    if (!register) throw new Error('Caja no encontrada.');

    const sales = repo
      .getCollection('sales')
      .filter((s) => s.cashRegisterId === registerId && !s.voided);

    const movements = repo
      .getCollection('cashMovements')
      .filter((m) => m.cashRegisterId === registerId);

    const cashSales = sales
      .filter((s) => s.paymentMethod === 'EFECTIVO')
      .reduce((acc, s) => acc + s.total, 0);
    const cardSales = sales
      .filter((s) => s.paymentMethod === 'TARJETA')
      .reduce((acc, s) => acc + s.total, 0);
    const transferSales = sales
      .filter((s) => s.paymentMethod === 'TRANSFERENCIA')
      .reduce((acc, s) => acc + s.total, 0);

    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalIncomes = movements
      .filter((m) => m.type === 'INGRESO')
      .reduce((acc, m) => acc + m.amount, 0);
    const totalExpenses = movements
      .filter((m) => m.type === 'EGRESO')
      .reduce((acc, m) => acc + m.amount, 0);

    const expectedAmount = register.initialAmount + totalSales + totalIncomes - totalExpenses;

    return {
      register,
      salesCount: sales.length,
      cashSales,
      cardSales,
      transferSales,
      totalSales,
      totalIncomes,
      totalExpenses,
      expectedAmount,
      availableCash: expectedAmount
    };
  }

  function openCashRegister(initialAmount) {
    const user = authService.requirePermission('cash.open');
    const amount = requireNonNegativeInt(initialAmount, 'Monto inicial');

    const active = getActiveCashRegister();
    if (active) {
      throw new Error(
        `Ya existe una caja en estado ${active.status}. Debe cerrarla antes de abrir una nueva.`
      );
    }

    const registers = repo.getCollection('cashRegisters');
    const newRegister = {
      id: `cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      openedAt: getLocalDateTimeISO(),
      openedDate: getLocalDateString(),
      openedByUserId: user.id,
      openedByUsername: user.username,
      initialAmount: amount,
      status: 'ABIERTA',
      expectedAmount: null,
      countedAmount: null,
      difference: null,
      closingObservation: null,
      closedAt: null,
      closedByUsername: null
    };
    registers.unshift(newRegister);
    repo.saveCollection('cashRegisters', registers);
    authService.logAudit('APERTURA_CAJA', `Caja abierta con monto inicial ${formatCOP(amount)}`, user);
    return newRegister;
  }

  function registerCashMovement(type, description, amount) {
    const user = authService.requirePermission('cash.movements');
    if (!['INGRESO', 'EGRESO'].includes(type)) {
      throw new Error('Tipo de movimiento de caja inválido.');
    }
    const cleanDesc = requireNonEmpty(description, 'Descripción');
    const val = requirePositiveInt(amount, 'Valor');

    const active = getActiveCashRegister();
    if (!active || active.status !== 'ABIERTA') {
      throw new Error('Debe existir una caja ABIERTA para registrar movimientos de caja.');
    }

    const summary = getCashSummary(active.id);
    if (type === 'EGRESO' && val > summary.availableCash) {
      throw new Error(
        `El egreso (${formatCOP(val)}) supera el dinero disponible en caja (${formatCOP(summary.availableCash)}).`
      );
    }

    const movements = repo.getCollection('cashMovements');
    const mov = {
      id: `cmov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cashRegisterId: active.id,
      date: getLocalDateTimeISO(),
      type,
      description: cleanDesc,
      amount: val,
      userId: user.id,
      username: user.username
    };
    movements.unshift(mov);
    repo.saveCollection('cashMovements', movements);
    return mov;
  }

  function listCashMovements(registerId = null) {
    const list = repo.getCollection('cashMovements');
    if (!registerId) return list;
    return list.filter((m) => m.cashRegisterId === registerId);
  }

  function startCashClosing() {
    const user = authService.requirePermission('cash.close');
    const registers = repo.getCollection('cashRegisters');
    const idx = registers.findIndex((r) => r.status === 'ABIERTA');
    if (idx === -1) {
      throw new Error('No hay una caja en estado ABIERTA para iniciar el cierre.');
    }
    registers[idx] = { ...registers[idx], status: 'EN_ARQUEO' };
    repo.saveCollection('cashRegisters', registers);
    authService.logAudit('INICIO_ARQUEO', `Caja ${registers[idx].id} pasó a EN_ARQUEO`, user);
    return registers[idx];
  }

  function cancelCashClosing() {
    const user = authService.requirePermission('cash.close');
    const registers = repo.getCollection('cashRegisters');
    const idx = registers.findIndex((r) => r.status === 'EN_ARQUEO');
    if (idx === -1) {
      throw new Error('No hay una caja en estado EN_ARQUEO para cancelar el cierre.');
    }
    registers[idx] = { ...registers[idx], status: 'ABIERTA' };
    repo.saveCollection('cashRegisters', registers);
    authService.logAudit('CANCELAR_ARQUEO', `Caja ${registers[idx].id} volvió a ABIERTA`, user);
    return registers[idx];
  }

  function confirmCashClosing(countedAmount, observation = '') {
    const user = authService.requirePermission('cash.close');
    const counted = requireNonNegativeInt(countedAmount, 'Dinero contado');
    const cleanObs = String(observation || '').trim();

    const registers = repo.getCollection('cashRegisters');
    const idx = registers.findIndex((r) => r.status === 'EN_ARQUEO');
    if (idx === -1) {
      throw new Error('La caja debe estar en estado EN_ARQUEO para confirmar el cierre.');
    }

    const summary = getCashSummary(registers[idx].id);
    const expected = summary.expectedAmount;
    const difference = counted - expected;

    if (difference !== 0 && !cleanObs) {
      throw new Error(
        `Existe una diferencia de ${formatCOP(difference)}. La observación es obligatoria.`
      );
    }

    const closed = {
      ...registers[idx],
      status: 'CERRADA',
      expectedAmount: expected,
      countedAmount: counted,
      difference,
      closingObservation: cleanObs || 'Arqueo cuadrado sin novedades.',
      closedAt: getLocalDateTimeISO(),
      closedByUsername: user.username
    };

    registers[idx] = closed;
    repo.saveCollection('cashRegisters', registers);
    authService.logAudit(
      'CIERRE_CAJA',
      `Caja cerrada. Esperado: ${formatCOP(expected)}, Contado: ${formatCOP(counted)}, Diferencia: ${formatCOP(difference)}`,
      user
    );
    return closed;
  }

  /**
   * Flujo exacto de registro de venta dentro de una transacción atómica.
   */
  function createSale({ items, paymentMethod, cashReceived = 0 }) {
    const user = authService.requirePermission('sales.create');

    // 1. Verificar caja ABIERTA
    const activeRegister = getActiveCashRegister();
    if (!activeRegister || activeRegister.status !== 'ABIERTA') {
      throw new Error('Abra la caja antes de vender');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Debe agregar al menos un producto a la venta.');
    }

    if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(paymentMethod)) {
      throw new Error('Método de pago no válido.');
    }

    /