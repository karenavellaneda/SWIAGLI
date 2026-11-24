/**
 * Vista de Horarios y Asistencia.
 * La marcación usa estrictamente la hora del sistema (no editable).
 */

import {
  DAY_NAMES,
  escapeHtml,
  formatDate,
  getLocalDateString,
  getLocalTimeString
} from '../utils/formatters.js';
import { renderAccessDenied, showToast, statusBadge } from './components.js';

export function renderAttendanceView(container, { user, services }) {
  const canAll = services.authService.hasPermission('attendance.all', user);
  const canOwn = services.authService.hasPermission('attendance.own', user);

  if (!canAll && !canOwn) {
    renderAccessDenied(container);
    return;
  }

  const workers = canAll ? services.hrService.listWorkers(true) : [];
  let selectedWorkerId = canAll ? (workers[0]?.id || '') : (user.workerId || '');
  let filters = {
    from: getLocalDateString(),
    to: getLocalDateString()
  };

  let clockInterval = null;

  function render() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }

    if (!canAll && !user.workerId) {
      container.innerHTML = `
        <div class="card">
          <div class="alert alert-warning">
            Su usuario aún no está vinculado a un registro de trabajador. Solicite al Administrador vincular su usuario desde Gestión de Usuarios.
          </div>
        </div>`;
      return;
    }

    const schedule = selectedWorkerId
      ? services.scheduleAttendanceService.getWorkerSchedule(selectedWorkerId)
      : null;

    let records = [];
    let filterErr = '';
    try {
      records = services.scheduleAttendanceService.getAttendanceWithAbsences({
        from: filters.from,
        to: filters.to,
        workerId: canAll ? selectedWorkerId : user.workerId
      });
    } catch (err) {
      filterErr = err.message;
    }

    const openShift = selectedWorkerId
      ? services.scheduleAttendanceService
          .getAttendanceRecords({ workerId: selectedWorkerId })
          .find((a) => !a.clockOut)
      : null;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Registro de ingreso y salida (hora del sistema)</h2>
            <div style="font-size:0.9rem; color:var(--text-muted);">
              Reloj actual del sistema: <strong id="live-sys-clock">${formatDate(getLocalDateString())} ${getLocalTimeString()}</strong> (no editable)
            </div>
          </div>
          ${
            canAll
              ? `<div class="form-group" style="margin:0; min-width:250px;">
                   <label for="att-worker-sel">Trabajador seleccionado</label>
                   <select id="att-worker-sel" class="form-control">
                     ${workers.map((w) => `<option value="${w.id}" ${w.id === selectedWorkerId ? 'selected' : ''}>${escapeHtml(w.fullName)}</option>`).join('')}
                   </select>
                 </div>`
              : ''
          }
        </div>

        ${
          selectedWorkerId
            ? `
          <div class="btn-group">
            <button type="button" class="btn btn-success" id="btn-clock-in" ${openShift ? 'disabled' : ''}>
              Registrar INGRESO ahora
            </button>
            <button type="button" class="btn btn-danger" id="btn-clock-out" ${!openShift ? 'disabled' : ''}>
              R