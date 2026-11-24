/**
 * Validadores de reglas de entrada y negocio sin dependencia del DOM.
 */

export function requireNonEmpty(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`El campo "${fieldName}" es obligatorio.`);
  }
  return String(value).trim();
}

export function requirePositiveInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    throw new Error(`"${fieldName}" debe ser un número entero mayor a 0.`);
  }
  return num;
}

export function requireNonNegativeInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    throw new Error(`"${fieldName}" debe ser un número entero mayor o igual a 0.`);
  }
  return num;
}

export function requireValidEmail(value, fieldName = 'Correo electrónico') {
  const email = requireNonEmpty(value, fieldName);
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    throw new Error(`El campo "${fieldName}" no tiene un formato válido.`);
  }
  return email.toLowerCase();
}

export function validatePasswordStrength(password) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
  if (!/[A-ZÁÉÍÓÚÑ]/.test(pwd)) {
    throw new Error('La contraseña debe incluir al menos una letra mayúscula.');
  }
  if (!/[0-9]/.test(pwd)) {
    throw new Error('La contraseña debe incluir al menos un número.');
  }
  return true;
}

export function validateDateRange(from, to, labelFrom = 'Fecha desde', labelTo = 'Fecha hasta') {
  if (from && to && String(from) > String(to)) {
    throw new Error(`"${labelFrom}" no puede ser posterior a "${labelTo}".`);
  }
}

export function validateTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    throw new Error('Debe indicar hora de entrada y hora de salida (o dejar ambas vacías para día libre).');
  }
  if (startTime >= endTime) {
    throw new Error('La hora de entrada debe ser menor que la hora de salida.');
  }
}