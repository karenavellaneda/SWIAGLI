/**
 * Vista "Mi cuenta": información del usuario actual y cambio de contraseña.
 */

import { escapeHtml } from '../utils/formatters.js';
import { showToast } from './components.js';

export function renderAccountView(container, { user, services }) {
  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h2 class="card-title">Información de mi cuenta</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(user.fullName)}</p>
        <p><strong>Usuario:</strong> <code>${escapeHtml(user.username)}</code></p>
        <p><strong>Correo:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Rol:</strong> ${escapeHtml(user.role)}</p>
      </div>

      <div class="card">
        <h2 class="card-title">Cambiar contraseña</h2>
        <form id="change-pwd-form">
          <div class="form-group">
            <label for="cp-current">Contraseña actual</label>
            <input id="cp-current" class="form-control" type="password" required />
          </div>
          <div class="form-group">
            <label for="cp-new">Nueva contraseña (mín. 8 caracteres, 1 mayúscula y 1 número)</label>
            <input id="cp-new" class="form-control" type="password" required />
          </div>
          <div class="form-group">
            <label for="cp-confirm">Confirmar nueva contraseña</label>
            <input id="cp-confirm" class="form-control" type="password" required />
          </div>
          <button type="submit" class="btn btn-primary">Actualizar contraseña</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('change-pwd-form').onsubmit = async (e) => {
    e.preventDefault();
    const current = document.getElementById('cp-current').value;
    const next = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;

    if (next !== confirm) {
      showToast('La confirmación no coincide con la nueva contraseña.', 'error');
      return;
    }
    try {
      await services.authService.changeOwnPassword(current, next);
      showToast('Contraseña actualizada correctamente.', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}