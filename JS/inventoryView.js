/**
 * Vista de Inventario: Productos, Movimientos (Entradas/Salidas) y Proveedores.
 */

import { escapeHtml, formatCOP, formatDateTime } from '../utils/formatters.js';
import { renderAccessDenied, showToast, statusBadge } from './components.js';

export function renderInventoryView(container, { user, services }) {
  if (!services.authService.hasPermission('inventory.view', user)) {
    renderAccessDenied(container);
    return;
  }

  const canManage = services.authService.hasPermission('inventory.manage', user);
  let activeTab = 'products';
  let search = '';
  let categoryFilter = '';
  let editingProductId = null;
  let editingSupplierId = null;

  function render() {
    const lowStock = services.inventoryService.getLowStockProducts();
    const categories = services.inventoryService.getCategories();
    const products = services.inventoryService.listProducts({ search, category: categoryFilter });
    const allProducts = services.inventoryService.listProducts({});
    const activeSuppliers = services.inventoryService.listSuppliers(true);
    const allSuppliers = services.inventoryService.listSuppliers(false);
    const movements = services.inventoryService.listMovements({});

    const editingProduct = editingProductId ? allProducts.find((p) => p.id === editingProductId) : null;
    const editingSupplier = editingSupplierId ? allSuppliers.find((s) => s.id === editingSupplierId) : null;

    container.innerHTML = `
      ${
        lowStock.length > 0
          ? `<div class="alert alert-warning" role="alert">
               <strong>Alerta de inventario:</strong> ${lowStock.length} producto(s) activo(s) están agotados o en stock bajo:
               ${lowStock.map((p) => `<strong>${escapeHtml(p.name)}</strong> (${p.stock}/${p.minStock})`).join(' • ')}
             </div>`
          : ''
      }

      <div class="tabs" role="tablist">
        <button type="button" class="tab-btn ${activeTab === 'products' ? 'active' : ''}" data-tab="products">Productos</button>
        <button type="button" class="tab-btn ${activeTab === 'movements' ? 'active' : ''}" data-tab="movements">Entradas y Salidas</button>
        <button type="button" class="tab-btn ${activeTab === 'suppliers' ? 'active' : ''}" data-tab="suppliers">Proveedores</button>
      </div>

      ${
        activeTab === 'products'
          ? `
        ${
          canManage
            ? `
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">${editingProduct ? `Editar producto: ${escapeHtml(editingProduct.name)}` : 'Nuevo producto'}</h2>
              ${editingProduct ? '<button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-prod">Cancelar</button>' : ''}
            </div>
            <form id="product-form">
              <div class="form-grid">
                <div class="form-group">
                  <label for="prd-code">Código único</label>
                  <input id="prd-code" class="form-control" type="text" required value="${escapeHtml(editingProduct?.code || '')}" />
                </div>
                <div class="form-group">
                  <label for="prd-name">Nombre</label>
                  <input id="prd-name" class="form-control" type="text" required value="${escapeHtml(editingProduct?.name || '')}" />
                </div>
                <div class="form-group">
                  <label for="prd-category">Categoría</label>
                  <input id="prd-category" class="form-control" type="text" required list="cat-suggestions" value="${escapeHtml(editingProduct?.category || '')}" />
                  <datalist id="cat-suggestions">
                    <option value="Bebidas Calientes"></option>
                    <option value="Bebidas Frías"></option>
                    <option value="Panadería"></option>
                    <option value="Pastelería"></option>
                    <option value="Otros"></option>
                  </datalist>
                </div>
                <div class="form-group">
                  <label for="prd-price">Precio de venta (COP entero)</label>
                  <input id="prd-price" class="form-control" type="number" min="1" step="1" required