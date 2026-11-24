/**
 * Vista de Seguridad: Usuarios, Permisos por rol y Auditoría (solo Administrador).
 */

import { ALL_PERMISSIONS_META } from '../data/seed.js';
import { escapeHtml, formatDateTime } from '../utils/formatters.js';
import { renderAccessDenied, showToast, statusBadge, showConfirmDialog } from './components.js';

export function renderUsersView(container, { user, services }) {
  if (!services.authService.hasPermission('users.manage', user)) {
    renderAccessDenied(container);
    return;
  }

  let activeTab = 'users';
  let editingUserId = null;

  function render() {
    const users = services.authService.listUsers();
    const workers = services.hrService.listWorkers(false);
    const rolePermissions = services.authService.getRolePermissions();
    const auditLogs = services.authService.listAuditLogs();
    const editingUser = editingUserId ? users.find((u) => u.id === editingUserId) : null;

    container.innerHTML = `
      <div class="tabs" role="tablist">
        <button type="button" class="tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users">Usuarios</button>
        <button type="button" class="tab-btn ${activeTab === 'permissions' ? 'active' : ''}" data-tab="permissions">Permisos por rol</button>
        <button type="button" class="tab-btn ${activeTab === 'audit' ? 'active' : ''}" data-tab="audit">Registro de auditoría</button>
      </div>

      ${
        activeTab === 'users'
          ? `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${editingUser ? `Editar usuario: ${escapeHtml(editingUser.username)}` : 'Crear nuevo usuario'}</h2>
            ${editingUser ? '<button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-usr">Cancelar edición</button>' : ''}
          </div>
          <form id="user-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="usr-username">Usuario</label>
                <input id="usr-username" class="form-control" type="text" required value="${escapeHtml(editingUser?.username || '')}" ${editingUser ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="usr-fullname">Nombre completo</label>
                <input id="usr-fullname" class="form-control" type="text" required value="${escapeHtml(editingUser?.fullName || '')}" />
              </div>
              <div class="form-group">
                <label for="usr-email">Correo electrónico</label>
                <input id="usr-email" class="form-control" type="email" required value="${escapeHtml(editingUser?.email || '')}" />
              </div>
              <div class="form-group">
                <label for="usr-role">Rol</label>
                <select id="usr-role" class="form-control">
                  <option value="ADMIN" ${editingUser?.role === 'ADMIN' ? 'selected' : ''}>Administrador</option>
                  <option value="VENDEDOR" ${editingUser?.role === 'VENDEDOR' ? 'selected' : ''}>Vendedor</option>
                  <option value="TRABAJADOR" ${editingUser?.role === 'TRABAJADOR' ? 'selected' : ''}>Trabajador</option>
                </select>
              </div>
              ${
                editingUser
                  ? `<div class="form-group">
                       <label for="usr-status">Estado</label>
                       <select id="usr-status" class="form-control">
                         <option value="ACTIVO" ${editingUser.status === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                         <option value="INACTIVO" ${editingUser.status === 'INACTIVO' ? 'selected' : ''}>INACTIVO</option>
                         <option value="BLOQUEADO" ${editingUser.status === 'BLOQUEADO' ? 'selected' : ''}>BLOQUEADO</option>
                       </select>
                     </div>`
                  : `<div class="form-group">
                       <label for="usr-password">Contraseña (mín. 8 car., 1 mayús., 1 núm.)</label>
                       <input id="usr-password" class="form-control" type="password" required />
                     </div>`
              }
              <div class="form-group">
                <label for="usr-worker">Vincular con trabajador (opcional)</label>
                <select id="usr-worker" class="form-control">
                  <option value="">Sin vínculo</option>
                  ${workers
                    .map(
                      (w) =>
                        `<option value="${w.id}" ${editingUser?.workerId === w.id ? 'selected' : ''}>${escapeHtml(w.fullName)} (${escapeHtml(w.position)})</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">${editingUser ? 'Guardar cambios' : 'Crear usuario'}</button>
          </form>
        </div>

        <div class="card">
          <h2 class="card-title">Listado de usuarios</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Trabajador vinculado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${users
                  .map((u) => {
                    const wrk = workers.find((w) => w.id === u.workerId);
                    return `
                    <tr>
                      <td><strong>${escapeHtml(u.username)}</strong></td>
                      <td>${escapeHtml(u.fullName)}</td>
                      <td>${escapeHtml(u.email)}</td>
                      <td>${escapeHtml(u.role)}</td>
                      <td>${wrk ? escapeHtml(wrk.fullName) : '—'}</td>
                      <td>${statusBadge(u.status)}</td>
                      <td>
                        <div class="btn-group">
                          <button type="button" class="btn btn-secondary btn-sm" data-edit-usr="${u.id}">Editar</button>
                          ${
                            u.status === 'BLOQUEADO'
                              ? `<button type="button" class="btn btn-success btn-sm" data-unlock-usr="${u.id}">Desbloquear</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
          : activeTab === 'permissions'
            ? `
        <div class="grid-2">
          ${['VENDEDOR', 'TRABAJADOR']
            .map(
              (role) => `
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">Permisos del rol: ${role}</h2>
              </div>
              <form class="perm-form" data-role="${role}">
                ${ALL_PERMISSIONS_META.map(
                  (p) => `
                  <div style="margin-bottom:0.5rem;">
                    <label class="checkbox-label">
                      <input type="checkbox" name="perm" value="${p.key}" ${(rolePermissions[role] || []).includes(p.key) ? 'checked' : ''} />
                      <span>${escapeHtml(p.label)}</span>
                    </label>
                  </div>`
                ).join('')}
                <button type="submit" class="btn btn-primary" style="margin-top:0.75rem;">Guardar permisos de ${role}</button>
              </form>
            </div>`
            )
            .join('')}
        </div>
      `
            : `
        <div class="card">
          <h2 class="card-title">Registro de auditoría (${auditLogs.length} eventos)</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs
                  .slice(0, 150)
                  .map(
                    (a) => `
                  <tr>
                    <td>${formatDateTime(a.timestamp)}</td>
                    <td><code>${escapeHtml(a.username)}</code></td>
                    <td><span class="badge badge-info">${escapeHtml(a.action)}</span></td>
                    <td>${escapeHtml(a.detail)}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      }
    `;

    container.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab;
        render();
      };
    });

    if (activeTab === 'users') {
      const cancelBtn = document.getElementById('cancel-edit-usr');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          editingUserId = null;
          render();
        };
      }

      document.getElementById('user-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
          if (editingUser) {
            services.authService.updateUser(editingUser.id, {
              fullName: document.getElementById('usr-fullname').value,
              email: document.getElementById('usr-email').value,
              role: document.getElementById('usr-role').value,
              status: document.getElementById('usr-status').value,
              workerId: document.getElementById('usr-worker').value
            });
            showToast('Usuario actualizado correctamente.', 'success');
            editingUserId = null;
          } else {
            await services.authService.createUser({
              username: document.getElementById('usr-username').value,
              fullName: document.getElementById('usr-fullname').value,
              email: document.getElementById('usr-email').value,
              role: document.getElementById('usr-role').value,
              password: document.getElementById('usr-password').value,
              workerId: document.getElementById('usr-worker').value
            });
            showToast('Usuario creado correctamente.', 'success');
          }
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      container.querySelectorAll('[data-edit-usr]').forEach((btn) => {
        btn.onclick = () => {
          editingUserId = btn.dataset.editUsr;
          render();
        };
      });

      container.querySelectorAll('[data-unlock-usr]').forEach((btn) => {
        btn.onclick = async () => {
          const ok = await showConfirmDialog({
            title: 'Desbloquear usuario',
            message: '¿Confirma el desbloqueo inmediato de este usuario?',
            confirmLabel: 'Desbloquear',
            confirmVariant: 'success'
          });
          if (!ok) return;
          try {
            services.authService.unlockUser(btn.dataset.unlockUsr);
            showToast('Usuario desbloqueado.', 'success');
            render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        };
      });
    } else if (activeTab === 'permissions') {
      container.querySelectorAll('.perm-form').forEach((form) => {
        form.onsubmit = (e) => {
          e.preventDefault();
          const role = form.dataset.role;
          const selected = Array.from(form.querySelectorAll('input[name="perm"]:checked')).map((c) => c.value);
          try {
            services.authService.updateRolePermissions(role, selected);
            showToast(`Permisos de ${role} actualizados.`, 'success');
            render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        };
      });
    }
  }

  render();
}