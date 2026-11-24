/**
 * Vista de Caja y Ventas (POS, movimientos de caja, arqueo/cierre, historial y anulación).
 */

import { escapeHtml, formatCOP, formatDate, formatDateTime, getLocalDateString } from '../utils/formatters.js';
import {
  renderAccessDenied,
  showConfirmDialog,
  showSaleReceiptModal,
  showToast,
  statusBadge
} from './components.js';

export function renderCashSalesView(container, { user, services }) {
  const canSell = services.authService.hasPermission('sales.create', user);
  const canViewSales = services.authService.hasPermission('sales.view', user);
  const canOpenCash = services.authService.hasPermission('cash.open', user);
  const canCashMov = services.authService.hasPermission('cash.movements', user);
  const canCloseCash = services.authService.hasPermission('cash.close', user);
  const canVoidSale = services.authService.hasPermission('sales.void', user);

  if (!canSell && !canViewSales && !canOpenCash && !canCashMov && !canCloseCash) {
    renderAccessDenied(container);
    return;
  }

  let activeTab = canSell ? 'pos' : canViewSales ? 'sales' : canCashMov ? 'cash-mov' : 'history';
  let cart = []; // [{ productId, quantity }]
  let posSearch = '';
  let saleFilters = {
    from: getLocalDateString(),
    to: getLocalDateString(),
    number: '',
    product: ''
  };

  function addToCart(productId) {
    const prod = services.inventoryService.getProductById(productId);
    if (!prod || !prod.active || prod.stock <= 0) {
      showToast('Producto sin stock disponible.', 'warning');
      return;
    }
    const existing = cart.find((c) => c.productId === productId);
    if (existing) {
      if (existing.quantity + 1 > prod.stock) {
        showToast(`Stock máximo alcanzado para ${prod.name} (${prod.stock}).`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      cart.push({ productId, quantity: 1 });
    }
    render();
  }

  function render() {
    const activeRegister = services.cashSalesService.getActiveCashRegister();
    const cashSummary = activeRegister ? services.cashSalesService.getCashSummary(activeRegister.id) : null;
    const allRegisters = services.cashSalesService.listCashRegisters();
    const activeCashMovs = activeRegister ? services.cashSalesService.listCashMovements(activeRegister.id) : [];

    const catalog = services.inventoryService
      .listProducts({ search: posSearch, onlyActive: true })
      .filter((p) => p.stock > 0);

    let salesList = [];
    let filterError = '';
    if (canViewSales) {
      try {
        salesList = services.cashSalesService.listSales(saleFilters);
      } catch (err) {
        filterError = err.message;
      }
    }

    const cartDetailed = cart
      .map((item) => {
        const prod = services.inventoryService.getProductById(item.productId);
        if (!prod) return null;
        return {
          ...item,
          name: prod.name,
          code: prod.code,
          unitPrice: prod.salePrice,
          stock: prod.stock,
          subtotal: prod.salePrice * item.quantity
        };
      })
      .filter(Boolean);
    const cartTotal = cartDetailed.reduce((acc, i) => acc + i.subtotal, 0);

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Estado actual de caja</h2>
            ${
              activeRegister
                ? `<div style="margin-top:0.3rem;">
                     ${statusBadge(activeRegister.status)}
                     <span style="margin-left:0.5rem; font-size:0.9rem;">
                       Abierta por <strong>${escapeHtml(activeRegister.openedByUsername)}</strong> el ${formatDateTime(activeRegister.openedAt)} |
                       Inicial: <strong>${formatCOP(activeRegister.initialAmount)}</strong> |
                       Disponible esperado: <strong>${formatCOP(cashSummary.availableCash)}</strong>
                     </span>
                   </div>`
                : `<div style="margin-top:0.3rem;">${statusBadge('CERRADA')} <span style="margin-left:0.5rem;">No hay caja abierta actualmente.</span></div>`
            }
          </div>
          <div class="btn-group">
            ${
              !activeRegister && canOpenCash
                ? `<form id="open-cash-form" class="btn-group">
                     <label for="open-cash-amount" class="sr-only">Monto inicial</label>
                     <input id="open-cash-amount" class="form-control" style="width:155px;" type="number" min="0" step="1" value="100000" required placeholder="Monto inicial" />
                     <button type="submit" class="btn btn-success">Abrir caja</button>
                   </form>`
                : ''
            }
            ${
              activeRegister && activeRegister.status === 'ABIERTA' && canCloseCash
                ? `<button type="button" class="btn btn-danger" id="start-closing-btn">Cerrar caja (Arqueo)</button>`
                : ''
            }
          </div>
        </div>

        ${
          activeRegister && activeRegister.status === 'EN_ARQUEO' && c