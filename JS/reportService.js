/**
 * Servicio de Reportes (solo Administrador).
 * Prepara datos estructurados sin registros anulados ni acceso al DOM.
 */

import { formatCOP, formatDate, formatDateTime } from '../utils/formatters.js';
import { validateDateRange } from '../utils/validators.js';

export function createReportService(repo, { authService, cashSalesService, inventoryService, accountingService, scheduleAttendanceService }) {
  function generateReport(type, { from = '', to = '' } = {}) {
    authService.requirePermission('reports.view');
    validateDateRange(from, to);

    const periodText =
      from && to
        ? `Período: ${formatDate(from)} al ${formatDate(to)}`
        : from
          ? `Desde: ${formatDate(from)}`
          : to
            ? `Hasta: ${formatDate(to)}`
            : 'Todos los registros';

    switch (type) {
      case 'sales': {
        const sales = repo.getCollection('sales').filter((s) => {
          if (s.voided) return false;
          if (from && s.date < from) return false;
          if (to && s.date > to) return false;
          return true;
        });
        const total = sales.reduce((acc, s) => acc + s.total, 0);
        return {
          type,
          title: 'Reporte de Ventas Válidas',
          subtitle: periodText,
          columns: ['Número', 'Fecha y Hora', 'Vendedor', 'Medio de Pago', 'Productos', 'Total'],
          rows: sales.map((s) => [
            s.number,
            formatDateTime(s.dateTime),
            s.sellerName || s.username,
            s.paymentMethod,
            s.items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
            formatCOP(s.total)
          ]),
          summaryItems: [
            { label: 'Cantidad de ventas', value: String(sales.length) },
            { label: 'Total vendido', value: formatCOP(total) }
          ]
        };
      }

      case 'expenses': {
        const expenses = repo.getCollection('expenses').filter((e) => {
          if (e.status === 'ANULADO') return false;
          if (from && e.date < from) return false;
          if (to && e.date > to) return false;
          return true;
        });
        const total = expenses.reduce((acc, e) => acc + e.amount, 0);
        return {
          type,
          title: 'Reporte de Gastos',
          subtitle: periodText,
          columns: ['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'Responsable', 'Valor'],
          rows: expenses.map((e) => [
            formatDate(e.date),
            e.category,
            e.description,
            e.supplierName || 'N/A',
            e.responsibleName,
            formatCOP(e.amount)
          ]),
          summaryItems: [
            { label: 'Registros', value: String(expenses.length) },
            { label: 'Total gastos', value: formatCOP(total) }
          ]
        };
      }

      case 'staffPayments': {
        const payments = repo.getCollection('staffPayments').filter((p) => {
          if (p.status === 'ANULADO') return false;
          if (from && p.date < from) return false;
          if (to && p.date > to) return false;
          return true;
        });
        const total = payments.reduce((acc, p) => acc + p.amount, 0);
        return {
          type,
          title: 'Reporte de Pagos al Personal',
          subtitle: periodText,
          columns: ['Fecha', 'Trabajador', 'Concepto', 'Valor'],
          rows: payments.map((p) => [
            formatDate(p.date),
            p.workerName,
            p.concept,
            formatCOP(p.amount)
          ]),
          summaryItems: [
            { label: 'Pagos realizados', value: String(payments.length) },
            { label: 'Total pagado', value: formatCOP(total) }
          ]
        };
      }

      case 'cashRegisters': {
        const registers = repo.getCollection('cashRegisters').filter((r) => {
          if (from && r.openedDate < from) return false;
          if (to && r.openedDate > to) return false;
          return true;
        });
        return {
          type,
          title: 'Reporte de Cajas',
          subtitle: periodText,
          columns: ['Apertura', 'Usuario', 'Estado', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Observación'],
          rows: registers.map((r) => {
            const sum = cashSalesService.getCashSummary(r.id);
            const exp = r.expectedAmount !== null ? r.expectedAmount : sum.expectedAmount;
            return [
              formatDateTime(r.openedAt),
              r.openedByUsername,
              r.status,
              formatCOP(r.initialAmount),
              formatCOP(exp),
              r.countedAmount !== null ? formatCOP(r.countedAmount) : '—',
              r.difference !== null ? formatCOP(r.difference) : '—',
              r.closingObservation || '—'
            ];
          }),
          summaryItems: [{ label: 'Cajas listadas', value: String(registers.length) }]
        };
      }

      case 'inventory': {
        const products = inventoryService.listProducts({});
        const totalVal = products
          .filter((p) => p.active)
          .reduce((acc, p) => acc + p.salePrice * p.stock, 0);
        return {
          type,
          title: 'Reporte de Inventario Actual',
          subtitle: 'Corte actual del catálogo',
          columns: ['Código', 'Producto', 'Categoría', 'Precio Venta', 'Stock', 'Mínimo', 'Estado'],
          rows: products.map((p) => [
            p.code,
            p.name,
            p.category,
            formatCOP(p.salePrice),
            String(p.stock),
            String(p.minStock),
            p.statusLabel
          ]),
          summaryItems: [
            { label: 'Productos totales', value: String(products.length) },
            { label: 'Valor potencial en venta', value: formatCOP(totalVal) }
          ]
        };
      }

      case 'attendance': {
        const records = scheduleAttendanceService.getAttendanceWithAbsences({ from, to });
        return {
          type,
          title: 'Reporte de Asistencia',
          subtitle: periodText,
          columns: ['Fecha', 'Trabajador', 'Ingreso', 'Salida', 'Observación'],
          rows: records.map((a) => [
            formatDate(a.date),
            a.workerName,
            a.clockIn,
            a.clockOut || 'Pendiente',
            a.observation
          ]),
          summaryItems: [{ label: 'Registros', value: String(records.length) }]
        };
      }

      case 'financialSummary': {
        const summary = accountingService.getFinancialSummary(from, to);
        const rows = [
          ['Ventas válidas', String(summary.salesCount), formatCOP(summary.totalSales)],
          ['Gastos operativos válidos', String(summary.expensesCount), formatCOP(summary.totalExpenses)],
          ['Pagos al personal válidos', String(summary.paymentsCount), formatCOP(summary.totalPayments)],
          ['EQUILIBRIO FINANCIERO (Ventas - Gastos - Pagos)', '—', formatCOP(summary.equilibrium)]
        ];
        return {
          type,
          title: 'Resumen Financiero',
          subtitle: periodText,
          columns: ['Concepto', 'Registros', 'Monto'],
          rows,
          summaryItems: [
            { label: 'Ventas', value: formatCOP(summary.totalSales) },
            { label: 'Gastos', value: formatCOP(summary.totalExpenses) },
            { label: 'Pagos personal', value: formatCOP(summary.totalPayments) },
            { label: 'Equilibrio', value: formatCOP(summary.equilibrium) }
          ]
        };
      }

      default:
        throw new Error('Tipo de reporte no reconocido.');
    }
  }

  return { generateReport };
}