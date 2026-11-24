/**
 * Capa Repositorio: abstrae la persistencia en localStorage y ofrece
 * transacciones atómicas con respaldo y rollback automático ante errores.
 */

const EMPTY_STATE = () => ({
  initialized: false,
  meta: {
    saleCounter: 0
  },
  rolePermissions: {},
  users: [],
  passwordResetTokens: [],
  auditLogs: [],
  products: [],
  inventoryMovements: [],
  suppliers: [],
  cashRegisters: [],
  cashMovements: [],
  sales: [],
  expenses: [],
  staffPayments: [],
  resumes: [],
  workers: [],
  contracts: [],
  schedules: [],
  attendance: []
});

export class Repository {
  constructor(storageKey = 'swiacli_db_v1') {
    this.storageKey = storageKey;
    this.sessionKey = `${storageKey}_session`;
  }

  _readRaw() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return EMPTY_STATE();
    }
    try {
      const parsed = JSON.parse(raw);
      return { ...EMPTY_STATE(), ...parsed };
    } catch {
      return EMPTY_STATE();
    }
  }

  _writeRaw(state) {
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  isInitialized() {
    const state = this._readRaw();
    return Boolean(state.initialized);
  }

  getState() {
    return this._readRaw();
  }

  setState(newState) {
    this._writeRaw(newState);
  }

  getCollection(name) {
    const state = this._readRaw();
    return Array.isArray(state[name]) ? state[name] : [];
  }

  saveCollection(name, items) {
    const state = this._readRaw();
    state[name] = items;
    this._writeRaw(state);
  }

  getRolePermissions() {
    const state = this._readRaw();
    return state.rolePermissions || {};
  }

  saveRolePermissions(rolePermissions) {
    const state = this._readRaw();
    state.rolePermissions = rolePermissions;
    this._writeRaw(state);
  }

  getMeta(key) {
    const state = this._readRaw();
    return state.meta ? state.meta[key] : undefined;
  }

  setMeta(key, value) {
    const state = this._readRaw();
    state.meta = state.meta || {};
    state.meta[key] = value;
    this._writeRaw(state);
  }

  /**
   * Ejecuta una función dentro de una transacción atómica.
   * Si ocurre cualquier excepción, restaura el estado previo íntegro.
   */
  runTransaction(fn) {
    const snapshot = localStorage.getItem(this.storageKey);
    try {
      return fn();
    } catch (error) {
      if (snapshot === null) {
        localStorage.removeItem(this.storageKey);
      } else {
        localStorage.setItem(this.storageKey, snapshot);
      }
      throw error;
    }
  }

  getSessionUserId() {
    return localStorage.getItem(this.sessionKey);
  }

  setSessionUserId(userId) {
    if (userId) {
      localStorage.setItem(this.sessionKey, userId);
    } else {
      localStorage.removeItem(this.sessionKey);
    }
  }

  clear() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.sessionKey);
  }
}

export const defaultRepo = new Repository('swiacli_db_v1');