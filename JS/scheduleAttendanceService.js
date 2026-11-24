/**
 * Servicio de Horarios Semanales y Control de Asistencia.
 * La hora de registro proviene exclusivamente del reloj del sistema (no editable en UI).
 */

import {
  DAY_NAMES,
  getLocalDateString,
  getLocalTimeString,
  getDayOfWeekKey,
  timeToMinutes
} from '../utils/formatters.js';
import { validateTimeRange, validateDateRange } from '../utils/validators.js';

const TOLERANCE_MINUTES = 5;

export function createScheduleAttendanceService(repo, authService) {
  function _ensureCanAccessWorker(workerId, requireWriteAll = false) {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('Debe iniciar sesión.');

    if (authService.hasPermission('attendance.all', user)) {
      return user;
    }
    if (requireWriteAll) {
      throw new Error('Acceso denegado: solo el Administrador puede gestionar horarios.');
    }
    if (!authService.hasPermission('attendance.own', user)) {
      throw new Error('Acceso denegado: no tiene permiso de asistencia.');
    }
    if (!user.workerId || user.workerId !== workerId) {
      throw new Error('Solo puede consultar o registrar su propia asistencia y horario.');
    }
    return user;
  }

  function getWorkerSchedule(workerId) {
    _ensureCanAccessWorker(workerId, false);
    const schedules = repo.getCollection('schedules');
    const found = schedules.find((s) => s.workerId === workerId);
    if (found) return found;

    const emptyDays = {};
    for (const d of DAY_NAMES) emptyDays[d.key] = null;
    return { workerId, days: emptyDays };
  }

  function saveWorkerSchedule(workerId, weekDays) {
    authService.requirePermission('attendance.all');
    const workers = repo.getCollection('workers');
    if (!workers.some((w) => w.id === workerId)) {
      throw new Error('Trabajador no encontrado.');
    }

    const sanitized = {};
    for (const d of DAY_NAMES) {
      const slot = weekDays[d.key];
      if (!slot || (!slot.startTime && !slot.endTime)) {
        sanitized[d.key] = null; // Día libre
      } else {
        validateTimeRange(slot.startTime, slot.endTime);
        sanitized[d.key] = {
          startTime: slot.startTime,
          endTime: slot.endTime
        };
      }
    }

    const schedules = repo.getCollection('schedules');
    const idx = schedules.findIndex((s) => s.workerId === workerId);
    const record = { workerId, days: sanitized };
    if (idx === -1) {
      schedules.push(record);
    } else {
      schedules[idx] = record;
    }
    repo.saveCollection('schedules', schedules);
    return record;
  }

  function calculateObservation(workerId, dateStr, clockInTime) {
    const schedule = repo.getCollection('schedules').find((s) => s.workerId === workerId);
    if (!schedule) return 'Puntual';
    const dayKey = getDayOfWeekKey(dateStr);
    const slot = schedule.days ? schedule.days[dayKey] : null;
    if (!slot || !slot.startTime) {
      return 'Puntual';
    }
    const scheduledMin = timeToMinutes(slot.startTime);
    const actualMin = timeToMinutes(clockInTime);
    return actualMin > scheduledMin + TOLERANCE_MINUTES ? 'Retardo' : 'Puntual';
  }

  /**
   * Registra ingreso usando la hora actual del sistema.
   * El parámetro optionalNow solo se usa en pruebas automatizadas deterministas.
   */
  function clockIn(workerId, optionalNow = null) {
    _ensureCanAccessWorker(workerId, false);
    const workers = repo.getColl