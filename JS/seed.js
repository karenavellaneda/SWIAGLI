/**
 * Datos iniciales de ejemplo para SWIACLI (Cafetería y Panadería en Tunja, Boyacá).
 * Genera hashes SHA-256 + sal reales mediante SubtleCrypto.
 */

import { generateSalt, hashPassword } from '../utils/crypto.js';
import { getLocalDateString, getLocalDateTimeISO } from '../utils/formatters.js';

export const ALL_PERMISSIONS_META = [
  { key: 'dashboard.view', label: 'Ver panel principal' },
  { key: 'cash.open', label: 'Abrir caja' },
  { key: 'sales.create', label: 'Registrar ventas' },
  { key: 'sales.view', label: 'Consultar ventas' },
  { key: 'cash.movements', label: 'Registrar ingresos y egresos de caja' },
  { key: 'cash.close', label: 'Cerrar caja (arqueo)' },
  { key: 'sales.void', label: 'Anular ventas' },
  { key: 'inventory.view', label: 'Consultar inventario y alertas' },
  { key: 'inventory.manage', label: 'Gestionar productos, entradas/salidas y proveedores' },
  { key: 'accounting.manage', label: 'Contabilidad (gastos, pagos al personal y equilibrio)' },
  { key: 'hr.manage', label: 'Personal, hojas de vida y contratos' },
  { key: 'attendance.own', label: 'Ver horario y registrar mi propia asistencia' },
  { key: 'attendance.all', label: 'Ver y gestionar horarios y asistencia de todos' },
  { key: 'reports.view', label: 'Ver y exportar reportes en PDF' },
  { key: 'users.manage', label: 'Gestionar usuarios, permisos y auditoría' }
];

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: ALL_PERMISSIONS_META.map((p) => p.key),
  VENDEDOR: [
    'dashboard.view',
    'cash.open',
    'sales.create',
    'sales.view',
    'cash.movements',
    'inventory.view',
    'attendance.own'
  ],
  TRABAJADOR: ['attendance.own']
};

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

export async function createSeedData() {
  const today = getLocalDateString();
  const nowIso = getLocalDateTimeISO();
  const monthStart = `${today.slice(0, 8)}01`;

  const adminSalt = generateSalt();
  const vendedorSalt = generateSalt();
  const trabajadorSalt = generateSalt();

  const [adminHash, vendedorHash, trabajadorHash] = await Promise.all([
    hashPassword('Admin123', adminSalt),
    hashPassword('Clave1234', vendedorSalt),
    hashPassword('Clave1234', trabajadorSalt)
  ]);

  const resumes = [
    {
      id: 'res-1',
      document: '1049612345',
      fullName: 'Laura Camila Rojas Suárez',
      phone: '3124567890',
      email: 'laura.rojas@swiacli.co',
      address: 'Calle 19 # 10-45, Centro, Tunja',
      dataAuthorization: true,
      education: [
        {
          institution: 'SENA Regional Boyacá',
          title: 'Técnico en Panadería y Pastelería',
          startDate: '2021-02-01',
          endDate: '2022-06-30'
        }
      ],
      experience: [
        {
          company: 'Panadería Santa Inés Tunja',
          role: 'Auxiliar de mostrador y barismo',
          startDate: '2022-08-01',
          endDate: '2024-05-15',
          description: 'Atención al cliente, preparación de bebidas calientes y manejo de caja.'
        }
      ]
    },
    {
      id: 'res-2',
      document: '1049698765',
      fullName: 'Carlos Andrés Niño Moreno',
      phone: '3109876543',
      email: 'carlos.nino@swiacli.co',
      address: 'Carrera 14 # 22-18, Barrio Las Nieves, Tunja',
      dataAuthorization: true,
      education: [
        {
          institution: 'UPTC Tunja',
          title: 'Bachiller Técnico Comercial',
          startDate: '2016-02-01',
          endDate: '2020-11-30'
        }
      ],
      experience: [
        {
          company: 'Horno Boyacense SAS',
          role: 'Maestro Panadero',
          startDate: '2021-01-15',
          endDate: '2024-08-20',
          description: 'Horneado artesanal de almojábanas, pan de yuca y pan de bono.'
        }
      ]
    }
  ];

  const workers = [
    {
      id: 'wrk-1',
      resumeId: 'res-1',
      position: 'Vendedora y Cajera',
      hireDate: '2024-06-01',
      status: 'ACTIVO'
    },
    {
      id: 'wrk-2',
      resumeId: 'res-2',
      position: 'Maestro Panadero',
      hireDate: '2024-09-01',
      status: 'ACTIVO'
    }
  ];

  const contracts = [
    {
      id: 'ctr-1',
      workerId: 'wrk-1',
      type: 'TERMINO_FIJO',
      startDate: addDays(today, -300),
      endDate: addDays(today, 65),
      position: 'Vendedora y Cajera',
      salary: 1450000,
      voided: false,
      voidReason: null
    },
    {
      id: 'ctr-2',
      workerId: 'wrk-2',
      type: 'TERMINO_FIJO',
      startDate: addDays(today, -345),
      endDate: addDays(today, 20), // POR_VENCER (<= 30 días)
      position: 'Maestro Panadero',
      salary: 1750000,
      voided: false,
      voidReason: null
    }
  ];

  const users = [
    {
      id: 'usr-admin',
      username: 'admin',
      email: 'admin@swiacli.co',
      fullName: 'Administrador General',
      role: 'ADMIN',
      status: 'ACTIVO',
      passwordHash: adminHash,
      salt: adminSalt,
      failedAttempts: 0,
      lockedUntil: null,
      workerId: null
    },
    {
      id: 'usr-vendedor',
      username: 'vendedor',
      email: 'vendedor@swiacli.co',
      fullName: 'Laura Camila Rojas Suárez',
      role: 'VENDEDOR',
      status: 'ACTIVO',
      passwordHash: vendedorHash,
      salt: vendedorSalt,
      failedAttempts: 0,
      lockedUntil: null,
      workerId: 'wrk-1'
    },
    {
      id: 'usr-trabajador',
      username: 'trabajador',
      email: 'trabajador@swiacli.co',
      fullName: 'Carlos Andrés Niño Moreno',
      role: 'TRABAJADOR',
      status: 'ACTIVO',
      passwordHash: trabajadorHash,
      salt: trabajadorSalt,
      failedAttempts: 0,
      lockedUntil: null,
      workerId: 'wrk-2'
    }
  ];

  const suppliers = [
    {
      id: 'sup-1',
      name: 'Molinos de Boyacá S.A.',
      nit: '800123456-1',
      phone: '6087421100',
      email: 'ventas@molinosboyaca.co',
      active: true
    },
    {
      id: 'sup-2',
      name: 'Café Tostado Cordillera',
      nit: '900456789-2',
      phone: '3112233445',
      email: 'pedidos@cafecordillera.co',
      active: true
    },
    {
      id: 'sup-3',
      name: 'Lácteos del Valle Tunja (Inactivo)',
      nit: '890999111-3',
      phone: '6087409988',
      email: 'contacto@lacteostunja.co',
      active: false
    }
  ];

  const products = [
    {
      id: 'prd-1',
      code: 'CAF-001',
      name: 'Tinto Campesino',
      description: 'Café filtrado tradicional boyacense 7 oz',
      category: 'Bebidas Calientes',
      salePrice: 2500,
      stock: 48,
      minStock: 10,
      active: true
    },
    {
      id: 'prd-2',
      code: 'CAF-002',
      name: 'Capuchino de la Casa',
      description: 'Espresso doble con leche vaporizada y canela',
      category: 'Bebidas Calientes',
      salePrice: 6500,
      stock: 25,
      minStock: 8,
      active: true
    },
    {
      id: 'prd-3',
      code: 'PAN-001',
      name: 'Almojábana Boyacense',
      description: 'Recién horneada con cuajada fresca de Paipa',
      category: 'Panadería',
      salePrice: 3000,
      stock: 30,
      minStock: 10,
      active: true
    },
    {
      id: 'prd-4',
      code: 'PAN-002',
      name: 'Croissant de Mantequilla',
      description: 'Hojaldre artesanal dorado',
      category: 'Panadería',
      salePrice: 4500,
      stock: 5,
      minStock: 8, // Stock bajo
      active: true
    },
    {
      id: 'prd-5',
      code: 'PAS-001',
      name: 'Porción Torta de Zanahoria',
      description: 'Con cubierta cremosa de queso',
      category: 'Pastelería',
      salePrice: 7500,
      stock: 12,
      minStock: 4,
      active: true
    },
    {
      id: 'prd-6',
      code: 'BEB-001',
      name: 'Jugo Natural de Mora',
      description: 'En agua o leche 12 oz',
      category: 'Bebidas Frías',
      salePrice: 5500,
      stock: 0, // Agotado
      minStock: 6,
      active: true
    }
  ];

  const inventoryMovements = [
    {
      id: 'mov-1',
      date: nowIso,
      userId: 'usr-admin',
      username: 'admin',
      productId: 'prd-3',
      productCode: 'PAN-001',
      productName: 'Almojábana Boyacense',
      type: 'ENTRADA',
      quantity: 30,
      reason: 'Producción inicial del día',
      supplierId: 'sup-1',
      supplierName: 'Molinos de Boyacá S.A.'
    },
    {
      id: 'mov-2',
      date: nowIso,
      userId: 'usr-admin',
      username: 'admin',
      productId: 'prd-2',
      productCode: 'CAF-002',
      productName: 'Capuchino de la Casa',
      type: 'ENTRADA',
      quantity: 25,
      reason: 'Carga inicial de barra',
      supplierId: 'sup-2',
      supplierName: 'Café Tostado Cordillera'
    }
  ];

  const expenses = [
    {
      id: 'exp-1',
      description: 'Compra de harina de trigo y maíz',
      date: monthStart,
      category: 'Insumos y Materia Prima',
      amount: 185000,
      supplierId: 'sup-1',
      supplierName: 'Molinos de Boyacá S.A.',
      responsibleUserId: 'usr-admin',
      responsibleName: 'Administrador General',
      status: 'ACTIVO',
      voidReason: null,
      voidedAt: null,
      voidedBy: null
    },
    {
      id: 'exp-2',
      description: 'Factura energía eléctrica local Tunja',
      date: today,
      category: 'Servicios Públicos',
      amount: 142000,
      supplierId: null,
      supplierName: null,
      responsibleUserId: 'usr-admin',
      responsibleName: 'Administrador General',
      status: 'ACTIVO',
      voidReason: null,
      voidedAt: null,
      voidedBy: null
    }
  ];

  const staffPayments = [
    {
      id: 'pay-1',
      workerId: 'wrk-1',
      workerName: 'Laura Camila Rojas Suárez',
      date: monthStart,
      concept: 'Anticipo quincenal primera mitad del mes',
      amount: 725000,
      status: 'ACTIVO',
      voidReason: null,
      voidedAt: null,
      voidedBy: null
    }
  ];

  const schedules = [
    {
      workerId: 'wrk-1',
      days: {
        LUNES: { startTime: '07:00', endTime: '15:00' },
        MARTES: { startTime: '07:00', endTime: '15:00' },
        MIERCOLES: { startTime: '07:00', endTime: '15:00' },
        JUEVES: { startTime: '07:00', endTime: '15:00' },
        VIERNES: { startTime: '07:00', endTime: '15:00' },
        SABADO: { startTime: '08:00', endTime: '14:00' },
        DOMINGO: null
      }
    },
    {
      workerId: 'wrk-2',
      days: {
        LUNES: { startTime: '05:30', endTime: '13:30' },
        MARTES: { startTime: '05:30', endTime: '13:30' },
        MIERCOLES: { startTime: '05:30', endTime: '13:30' },
        JUEVES: { startTime: '05:30', endTime: '13:30' },
        VIERNES: { startTime: '05:30', endTime: '13:30' },
        SABADO: { startTime: '06:00', endTime: '12:00' },
        DOMINGO: null
      }
    }
  ];

  const attendance = [
    {
      id: 'att-1',
      workerId: 'wrk-1',
      workerName: 'Laura Camila Rojas Suárez',
      date: addDays(today, -1),
      clockIn: '07:02',
      clockOut: '15:04',
      observation: 'Puntual'
    },
    {
      id: 'att-2',
      workerId: 'wrk-2',
      workerName: 'Carlos Andrés Niño Moreno',
      date: addDays(today, -1),
      clockIn: '05:42',
      clockOut: '13:35',
      observation: 'Retardo'
    }
  ];

  return {
    initialized: true,
    meta: { saleCounter: 0 },
    rolePermissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)),
    users,
    passwordResetTokens: [],
    auditLogs: [
      {
        id: 'aud-1',
        timestamp: nowIso,
        userId: 'usr-admin',
        username: 'admin',
        action: 'INICIALIZACION',
        detail: 'Carga inicial de datos de ejemplo SWIACLI Tunja'
      }
    ],
    products,
    inventoryMovements,
    suppliers,
    cashRegisters: [],
    cashMovements: [],
    sales: [],
    expenses,
    staffPayments,
    resumes,
    workers,
    contracts,
    schedules,
    attendance
  };
}

export async function ensureSeeded(repo) {
  if (!repo.isInitialized()) {
    const seed = await createSeedData();
    repo.setState(seed);
  }
}

export async function resetToSeed(repo) {
  repo.clear();
  const seed = await createSeedData();
  repo.setState(seed);
}