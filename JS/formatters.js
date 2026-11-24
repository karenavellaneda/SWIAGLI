/**
 * Utilidades de formato para moneda colombiana (COP), fechas locales y texto seguro.
 */

export const DAY_NAMES = [
  { key: 'LUNES', label: 'Lunes' },
  { key: 'MARTES', label: 'Martes' },
  { key: 'MIERCOLES', label: 'Miércoles' },
  { key: 'JUEVES', label: 'Jueves' },
  { key: 'VIERNES', label: 'Viernes' },
  { key: 'SABADO', label: 'Sábado' },
  { key: 'DOMINGO', label: 'Domingo' }
];

/**
 * Formatea un valor numérico entero en pesos colombianos. Ejemplo: 16000 -> "$16.000".
 */
export function formatCOP(value) {
  const num = Math.round(Number(value) || 0);
  const absFormatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return num < 0 ? `-$${absFormatted}` : `$${absFormatted}`;
}

/**
 * Devuelve la fecha local en formato YYYY-MM-DD sin desfase UTC.
 */
export function getLocalDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Devuelve la hora local en formato HH:MM (24 horas).
 */
export function getLocalTimeString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Devuelve fecha y hora local YYYY-MM-DDTHH:MM:SS.
 */
export function getLocalDateTimeISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = getLocalDateString(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${datePart}T${hh}:${mm}:${ss}`;
}

/**
 * Formatea YYYY-MM-DD a formato local colombiano DD/MM/YYYY.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formatea fecha-hora ISO local a DD/MM/YYYY HH:MM.
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const [datePart, timePart] = String(isoStr).split('T');
  const timeShort = timePart ? timePart.slice(0, 5) : '';
  return `${formatDate(datePart)}${timeShort ? ` ${timeShort}` : ''}`;
}

/**
 * Obtiene la clave del día de la semana (LUNES..DOMINGO) para una fecha YYYY-MM-DD.
 */
export function getDayOfWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const localDate = new Date(y, m - 1, d);
  const jsDay = localDate.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const map = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  return map[jsDay];
}

/**
 * Diferencia en días enteros (dateB - dateA) usando YYYY-MM-DD.
 */
export function diffDays(dateStrA, dateStrB) {
  const [y1, m1, d1] = dateStrA.split('-').map(Number);
  const [y2, m2, d2] = dateStrB.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Convierte HH:MM a minutos desde medianoche.
 */
export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Escapa caracteres HTML para prevenir XSS al renderizar plantillas.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}