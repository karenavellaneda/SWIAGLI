/**
 * Utilidades criptográficas en cliente con Web Crypto API (SubtleCrypto).
 * Nota académica: ofrece hash SHA-256 con sal para no almacenar texto plano,
 * pero la seguridad real en producción debe ejecutarse en servidor.
 */

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(byteLength = 16) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export function generateToken(byteLength = 24) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export async function hashPassword(password, salt) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error(
      'Web Crypto API (SubtleCrypto) no está disponible. Abra la aplicación mediante localhost o HTTPS.'
    );
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyPassword(password, salt, expectedHash) {
  const computed = await hashPassword(password, salt);
  return computed === expectedHash;
}