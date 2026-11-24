/**
 * Servicio de Inventario y Proveedores.
 * Regla clave: este servicio ÚNICAMENTE modifica stock y movimientos de inventario.
 * No guarda ventas ni toca el DOM.
 */

import { getLocalDateTimeISO } from '../utils/formatters.js';
import {
  requireNonEmpty,
  requirePositiveInt,
  requireNonNegativeInt,
  requireValidEmail
} from '../utils/validators.js';

export function createInventoryService(repo, authService) {
  function getProductStatus(product) {
    if (!product.active) return 'Inactivo';
    if (product.stock === 0) return 'Agotado';
    if (product.stock <= product.minStock) return 'Stock bajo';
    return 'Disponible';
  }

  function listProducts({ search = '', category = '', onlyActive = false } = {}) {
    authService.requirePermission('inventory.view');
    const term = search.trim().toLowerCase();
    return repo
      .getCollection('products')
      .filter((p) => {
        if (onlyActive && !p.active) return false;
        if (category && p.category !== category) return false;
        if (term) {
          const matchName = p.name.toLowerCase().includes(term);
          const matchCode = p.code.toLowerCase().includes(term);
          if (!matchName && !matchCode) return false;
        }
        return true;
      })
      .map((p) => ({ ...p, statusLabel: getProductStatus(p) }));
  }

  function getProductById(id) {
    const products = repo.getCollection('products');
    return products.find((p) => p.id === id) || null;
  }

  function getLowStockProducts() {
    return repo
      .getCollection('products')
      .filter((p) => p.active && p.stock <= p.minStock)
      .map((p) => ({ ...p, statusLabel: getProductStatus(p) }));
  }

  function getCategories() {
    const cats = new Set(repo.getCollection('products').map((p) => p.category));
    return [...cats].sort();
  }

  function createProduct(data) {
    authService.requirePermission('inventory.manage');
    const code = requireNonEmpty(data.code, 'Código').toUpperCase();
    const name = requireNonEmpty(data.name, 'Nombre del producto');
    const description = String(data.description || '').trim();
    const category = requireNonEmpty(data.category, 'Categoría');
    const salePrice = requirePositiveInt(data.salePrice, 'Precio de venta');
    const initialStock = requireNonNegativeInt(data.stock ?? 0, 'Stock inicial');
    const minStock = requireNonNegativeInt(data.minStock ?? 0, 'Stock mínimo');
    const active = data.active !== false;

    const products = repo.getCollection('products');
    if (products.some((p) => p.code.toUpperCase() === code)) {
      throw new Error(`Ya existe un producto con el código "${code}".`);
    }

    const user = authService.getCurrentUser();
    const product = {
      id: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      description,
      category,
      salePrice,
      stock: 0,
      minStock,
      active
    };

    return repo.runTransaction(() => {
      product.stock = initialStock;
      products.push(product);
      repo.saveCollection('products', products);

      if (initialStock > 0) {
        const movements = repo.getCollection('inventoryMovements');
        movements.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: getLocalDateTimeISO(),
          userId: user.id,
          username: user.username,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          type: 'ENTRADA',
          quantity: initialStock,
          reason: 'Stock inicial al crear producto',
          supplierId: null,
          supplierName: null
        });
        repo.saveCollection('inventoryMovements', movements);
      }

      return { ...product, statusLabel: getProductStatus(product) };
    });
  }

  function updateProduct(id, data) {
    authService.requirePermission('inventory.manage');
    const products = repo.getCollection('products');
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Producto no encontrado.');

    const existing = products[idx];
    const code = requireNonEmpty(data.code ?? existing.code, 'Código').toUpperCase();
    const name = requireNonEmpty(data.name ?? existing.name, 'Nombre del producto');
    const description = String(data.description ?? existing.description).trim();
    const category = requireNonEmpty(data.category ?? existing.category, 'Categoría');
    const salePrice = requirePositiveInt(data.salePrice ?? existing.salePrice, 'Precio de venta');
    const minStock = requireNonNegativeInt(data.minStock ?? existing.minStock, 'Stock mínimo');
    const active = data.active !== undefined ? Boolean(data.active) : existing.active;

    if (products.some((p) => p.id !== id && p.code.toUpperCase() === code)) {
      throw new Error(`Ya existe otro producto con el código "${code}".`);
    }

    // El stock nunca se edita directamente: solo cambia por movimientos, ventas o anulaciones
    const updated = {
      ...existing,
      code,
      name,
      description,
      category,
      salePrice,
      minStock,
      active
    };
    products[idx] = updated;
    repo.saveCollection('products', products);
    return { ...updated, statusLabel: getProductStatus(updated) };
  }

  function registerMovement({ productId, type, quantity, reason, supplierId = null }) {
    const user = authService.requirePermission('inventory.manage');
    if (!['ENTRADA', 'SALIDA'].includes(type)) {
      throw new Error('El tipo de movimiento debe ser ENTRADA o SALIDA.');
    }
    const qty = requirePositiveInt(quantity, 'Cantidad');
    const cleanReason = requireNonEmpty(reason, 'Motivo');

    return repo.runTransaction(() => {
      const products = repo.getCollection('products');
      const idx = products.findIndex((p) => p.id === productId);
      if (idx === -1) throw new Error('Producto no encontrado.');

      const product = products[idx];
      let supplierName = null;

      if (type === 'ENTRADA' && supplierId) {
        const suppliers = repo.getCollection('suppliers');
        const sup = suppliers.find((s) => s.id === supplierId);
        if (!sup || !sup.active) {
          throw new Error('El proveedor seleccionado no existe o está inactivo.');
        }
        supplierName = sup.name;
      }

      if (type === 'SALIDA' && qty > product.stock) {
        throw new Error(
          `La salida (${qty}) supera el stock disponible de "${product.name}" (${product.stock}).`
        );
      }

      const nextStock = type === 'ENTRADA' ? product.stock + qty : product.stock - qty;
      products[idx] = { ...product, stock: nextStock };
      repo.saveCollection('products', products);

      const movements = repo.getCollection('inventoryMovements');
      const mov = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: getLocalDateTimeISO(),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        type,
        quantity: qty,
        reason: cleanReason,
        supplierId: type === 'ENTRADA' ? supplierId || null : null,
        supplierName
      };
      movements.unshift(mov);
      repo.saveCollection('inventoryMovements', movements);
      return mov;
    });
  }

  /**
   * Método invocado únicamente desde cashSalesService dentro de una transacción.
   * Solo descuenta stock y registra movimientos SALIDA.
   */
  function deductStockForSale(items, saleNumber, user) {
    const products = repo.getCollection('products');
    const movements = repo.getCollection('inventoryMovements');
    const lowStockWarnings = [];

    for (const item of items) {
      const idx = products.findIndex((p) => p.id === item.productId);
      if (idx === -1) {
        throw new Error(`Producto no encontrado (${item.productName || item.productId}).`);
      }
      const prod = products[idx];
      if (!prod.active) {
        throw new Error(`El producto "${prod.name}" está inactivo.`);
      }
      if (prod.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, solicitado: ${item.quantity}.`
        );
      }
      const nextStock = prod.stock - item.quantity;
      products[idx] = { ...prod, stock: nextStock };

      movements.unshift({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: getLocalDateTimeISO(),
        userId: user.id,
        username: user.username,
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        type: 'SALIDA',
        quantity: item.quantity,
        reason: `Venta ${saleNumber}`,
        supplierId: null,
        supplierName: null
      });

      if (nextStock <= prod.minStock) {
        lowStockWarnings.push({
          id: prod.id,
          name: prod.name,
          stock: nextStock,
          minStock: prod.minStock
        });
      }
    }

    repo.saveCollection('products', products);
    repo.saveCollection('inventoryMovements', movements);
    return lowStockWarnings;
  }

  /**
   * Método invocado al anular una venta: restituye stock y registra ENTRADA.
   */
  function restoreStockForVoid(items, saleNumber, reason, user) {
    const products = repo.getCollection('products');
    const movements = repo.getCollection('inventoryMovements');

    for (const item of items) {
      const idx = products.findIndex((p) => p.id === item.productId);
      if (idx === -1) continue;
      const prod = products[idx];
      products[idx] = { ...prod, stock: prod.stock + item.quantity };

      movements.unshift({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: getLocalDateTimeISO(),
        userId: user.id,
        username: user.username,
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        type: 'ENTRADA',
        quantity: item.quantity,
        reason: `Anulación venta ${saleNumber}: ${reason}`,
        supplierId: null,
        supplierName: null
      });
    }

    repo.saveCollection('products', products);
    repo.saveCollection('inventoryMovements', movements);
  }

  function listMovements({ productId = '' } = {}) {
    authService.requirePermission('inventory.view');
    const list = repo.getCollection('inventoryMovements');
    if (!productId) return list;
    return list.filter((m) => m.productId === productId);
  }

  function listSuppliers(onlyActive = false) {
    authService.requirePermission('inventory.view');
    const list = repo.getCollection('suppliers');
    return onlyActive ? list.filter((s) => s.active) : list;
  }

  function createSupplier(data) {
    authService.requirePermission('inventory.manage');
    const name = requireNonEmpty(data.name, 'Nombre del proveedor');
    const nit = requireNonEmpty(data.nit, 'NIT');
    const phone = requireNonEmpty(data.phone, 'Teléfono');
    const email = requireValidEmail(data.email, 'Correo electrónico');
    const active = data.active !== false;

    const suppliers = repo.getCollection('suppliers');
    if (suppliers.some((s) => s.nit.toLowerCase() === nit.toLowerCase())) {
      throw new Error(`Ya existe un proveedor con el NIT "${nit}".`);
    }

    const sup = {
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      nit,
      phone,
      email,
      active
    };
    suppliers.push(sup);
    repo.saveCollection('suppliers', suppliers);
    return sup;
  }

  function updateSupplier(id, data) {
    authService.requirePermission('inventory.manage');
    const suppliers = repo.getCollection('suppliers');
    const idx = suppliers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Proveedor no encontrado.');

    const existing = suppliers[idx];
    const name = requireNonEmpty(data.name ?? existing.name, 'Nombre del proveedor');
    const nit = requireNonEmpty(data.nit ?? existing.nit, 'NIT');
    const phone = requireNonEmpty(data.phone ?? existing.phone, 'Teléfono');
    const email = requireValidEmail(data.email ?? existing.email, 'Correo electrónico');
    const active = data.active !== undefined ? Boolean(data.active) : existing.active;

    if (suppliers.some((s) => s.id !== id && s.nit.toLowerCase() === nit.toLowerCase())) {
      throw new Error(`Ya existe otro proveedor con el NIT "${nit}".`);
    }

    suppliers[idx] = { ...existing, name, nit, phone, email, active };
    repo.saveCollection('suppliers', suppliers);
    return suppliers[idx];
  }

  return {
    getProductStatus,
    listProducts,
    getProductById,
    getLowStockProducts,
    getCategories,
    createProduct,
    updateProduct,
    registerMovement,
    listMovements,
    deductStockForSale,
    restoreStockForVoid,
    listSuppliers,
    createSupplier,
    updateSupplier
  };
}