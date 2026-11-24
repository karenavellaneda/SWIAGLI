/**
 * Vista de inicio de sesión y recuperación de contraseña (modo académico).
 */

import { escapeHtml } from '../utils/formatters.js';
import { showToast, showConfirmDialog } from './components.js';

export function renderAuthView(container, { authService, onLoginSuccess, onResetSampleData, initialToken = '' }) {
  let mode = initialToken ? 'reset' : 'login';
  let generatedReset = null;

  function render() {
    container.innerHTML = `
      <div class="auth-wrapper">
        <main class="auth-card">
          <div class="auth-header">
            <div class="auth-logo" aria-hidden="true">SW</div>
            <h1>SWIACLI</h1>
            <p style="margin:0; color:var(--text-muted); font-size:0.92rem;">
              Cafetería y Panadería — Tunja, Boyacá
            </p>
          </div>

          <div id="auth-feedback"></div>

          ${
            mode === 'login'
              ? `
            <form id="login-form" novalidate>
              <div class="form-group">
                <label for="login-identifier">Usuario o correo electrónico</label>
                <input id="login-identifier" class="form-control" type="text" autocomplete="username" required placeholder="Ej: admin o admin@swiacli.co" />
              </div>
              <div class="form-group">
                <label for="login-password">Contraseña</label>
                <input id="login-password" class="form-control" type="password" autocomplete="current-password" required placeholder="••••••••" />
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;">Iniciar sesión</button>
            </form>
            <div style="margin-top:0.9rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="go-forgot-btn">¿Olvidó su contraseña?</button>
              <button type="button" class="btn btn-secondary btn-sm" id="reset-seed-login-btn">Restablecer datos de ejemplo</button>
            </div>
            <div class="demo-credentials">
              <strong>Usuarios de ejemplo:</strong><br />
              • Admin: <code>admin</code> / <code>Admin123</code><br />
              • Vendedor: <code>vendedor</code> / <code>Clave1234</code><br />
              • Trabajador: <code>trabajador</code> / <code>Clave1234</code>
            </div>
          `
              : mode === 'forgot'
                ? `
            <h2 style="font-size:1.1rem;">Restablecer contraseña</h2>
            <p style="font-size:0.88rem; color:var(--text-muted);">
              Ingrese su usuario o correo. En modo académico el enlace temporal (30 minutos, un solo uso) se mostrará en pantalla.
            </p>
            <form id="forgot-form">
              <div class="form-group">
                <label for="forgot-identifier">Usuario o correo</label>
                <input id="forgot-identifier" class="form-control" type="text" required />
              </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary">Generar enlace</button>
                <button type="button" class="btn btn-secondary" id="back-login-btn">Volver</button>
              </div>
            </form>
            ${
              generatedReset
                ? `<div class="alert alert-info" style="margin-top:1rem;">
                     <strong>Enlace de recuperación (30 min, un solo uso):</strong><br />
                     <button type="button" class="btn btn-accent btn-sm" id="use-reset-token-btn" style="margin-top:0.5rem;">
                       Abrir enlace de restablecimiento
                     </button>
                     <div style="word-break:break-all; font-size:0.78rem; margin-top:0.4rem;">
                       Token: <code>${escapeHtml(generatedReset.token)}</code>
                     </div>
                   </div>`
                : ''
            }
          `
                : `
            <h2 style="font-size:1.1rem;">Nueva contraseña</h2>
            <form id="reset-form">
              <div class="form-group">
                <label for="reset-token">Token</label>
                <input id="reset-token" class="form-control" type="text" value="${escapeHtml(initialToken || (generatedReset ? generatedReset.token : ''))}" required />
              </div>
              <div class="form-group">
                <label for="reset-new-pwd">Nueva contraseña (mín. 8 caracteres, 1 mayúscula, 1 número)</label>
                <input id="reset-new-pwd" class="form-control" type="password" required />
              </div>
              <div class="form-group">
                <label for="reset-confirm-pwd">Confirmar contraseña</label>
                <input id="reset-confirm-pwd" class="form-control" type="password" required />
              </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary">Guardar nueva contraseña</button>
                <button type="button" class="btn btn-secondary" id="back-login-btn">Volver</button>
              </div>
            </form>
          `
          }
        </main>
      </div>
    `;

    const feedback = document.getElementById('auth-feedback');

    if (mode === 'login') {
      document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        feedback.innerHTML = '';
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;
        try {
          const user = await authService.login(identifier, password);
          showToast(`Bienvenido, ${user.fullName}`, 'success');
          onLoginSuccess(user);
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-danger" role="alert">${escapeHtml(err.message)}</div>`;
        }
      };

      document.getElementById('go-forgot-btn').onclick = () => {
        mode = 'forgot';
        generatedReset = null;
        render();
      };

      document.getElementById('reset-seed-login-btn').onclick = async () => {
        const ok = await showConfirmDialog({
          title: 'Restablecer datos de ejemplo',
          message: 'Esta acción borrará los cambios actuales y restaurará los datos iniciales de ejemplo. ¿Desea continuar?',
          con