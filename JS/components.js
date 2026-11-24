/**
 * Componentes visuales reutilizables, toasts, diálogos de confirmación y acceso denegado.
 */

import { escapeHtml, formatCOP, formatDateTime } from '../utils/formatters.js';

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 4200);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

/**
 * Diálogo modal accesible para confirmar acciones destructivas o anulaciones.
 */
export function showConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmVariant = 'danger',
  requireReason = false,
  reasonLabel = 'Motivo obligatorio'
}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-confirm-title">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 id="modal-confirm-title">${escapeHtml(title)}</h3>
            <button type="button" class="btn btn-secondary btn-sm" id="modal-close-x" aria-label="Cerrar">✕</button>
          </div>
          <p>${escapeHtml(message)}</p>
          ${
            requireReason
              ? `<div class="form-group">
                   <label for="modal-reason-input">${escapeHtml(reasonLabel)}</label>
                   <textarea id="modal-reason-input" class="form-control" rows="3" required placeholder="Escriba el motivo..."></textarea>
                   <small id="modal-reason-error" style="color: var(--danger-text); display:none;">Debe ingresar un motivo.</small>
                 </div>`
              : ''
          }
          <div class="btn-group" style="justify-content: flex-end; margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
            <button type="button" class="btn btn-${confirmVariant}" id="modal-ok-btn">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      closeModal();
      resolve(result);
    };

    document.getElementById('modal-cancel-btn').onclick = () => cleanup(null);
    document.getElementById('modal-close-x').onclick = () => cleanup(null);
    document.getElementById('modal-ok-btn').onclick = () => {
      if (requireReason) {
        const val = document.getElementById('modal-reason-input').value.trim();
        if (!val) {
          document.getElementById('modal-reason-error').style.display = 'block';
          return;
        }
        cleanup(val);
      } else {
        cleanup(true);
      }
    };
  });
}

export function renderAccessDenied(container, detail = 'No tiene permisos suficientes para ver este módulo.') {
  container.innerHTML = `
    <div class="card">
      <div class="alert alert-danger" role="alert">
        <strong>Acceso denegado</strong><br />
        ${escapeHtml(detail)}
      </div>
    </div>
  `;
}

export function showSaleReceiptModal(sale, lowStockWarnings = []) {
  const root = document.getElementById('modal-root');
  const warningHtml =
    lowStockWarnings.length > 0
      ? `<div class="alert alert-warning">
           <strong>Alerta de inventario tras la venta:</strong><br />
           ${lowStockWarnings
             .map((w) => `${escapeHtml(w.name)} quedó con ${w.stock} unidades (mínimo: ${w.minStock}).`)
             .join('<br />')}
         </div>`
      : '';

  root.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="receipt-modal-title">Comprobante de Venta ${escapeHtml(sale.number)}</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="receipt-close-btn">✕</button>
        </div>
        ${warningHtml}
        <div id="printable-receipt" class="receipt-box">
          <div style="text-align:center;">
            <strong>SWIACLI — CAFETERÍA Y PANADERÍA</strong><br />
            Tunja, Boyacá - Colombia<br />
            Comprobante de Venta N.º ${escapeHtml(sale.number)}
          </div>
          <hr />
          <div>Fecha: ${escapeHtml(formatDateTime(sale.dateTime))}</div>
          <div>Atendió: ${escapeHtml(sale.sellerName || sale.username)}</div>
          <div>Pago: ${escapeHtml(sale.paymentMethod)}</div>
          <hr />
          <table style="width:100%; font-size:0.85rem;">
            <thead>
              <tr>
                <th style="background:none; padding:2px 0;">Producto</th>
                <th style="background:none; padding:2px 0; text-align:right;">Cant</th>
                <th style="background:none; padding:2px 0; text-align:right;">Subt.</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items
                .map(
                  (i) => `
                <tr>
                  <td style="padding:2px 0;">${escapeHtml(i.productName)} (${formatCOP(i.unitPrice)})</td>
                  <td style="padding:2px 0; text-align:right;">${i.quantity}</td>
                  <td style="padding:2px 0; text-align:right;">${formatCOP(i.subtotal)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
          <hr />
          <div style="display:flex; justify-content:space-between; font-weight:700;">
            <span>TOTAL</span>
            <span>${formatCOP(sale.total)}</span>
          </div>
          ${
            sale.paymentMethod === 'EFECTIVO'
              ? `<div style="display:flex; justify-content:space-between;">
                   <span>Recibido</span><span>${formatCOP(sale.cashReceived)}</span>
                 </div>
                 <div style="display:flex; justify-content:space-between;">
                   <span>Cambio</span><span>${formatCOP(sale.change)}</span>
                 </div>`
              : ''
          }
          <hr />
          <div style="text-align:center;">¡Gracias por su compra!</div>
        </div>
        <div class="btn-group" style="justify-content:flex-end; margin-top:1rem;">
          <button type="button" class="btn btn-secondary" id="receipt-ok-btn">Cerrar</button>
          <button type="button" class="btn btn-primary" id="receipt-print-btn">Imprimir comprobante</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('receipt-close-btn').onclick = closeModal;
  document.getElementById('receipt-ok-btn').onclick = closeModal;
  document.getElementById('receipt-print-btn').onclick = () => window.print();
}

export function statusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (['ACTIVO', 'ABIERTA', 'DISPONIBLE', 'VIGENTE', 'PUNTUAL'].includes(s)) {
    return `<span class="badge badge-success">${escapeHtml(statu