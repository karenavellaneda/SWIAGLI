/**
 * Vista de Personal (solo Administrador):
 * Hojas de vida (Ley 1581 de 2012), Trabajadores, Contratos y Ficha de Trabajador con 6 pestañas.
 */

import { CONTRACT_TYPES } from '../services/hrService.js';
import { DAY_NAMES, escapeHtml, formatCOP, formatDate, getLocalDateString } from '../utils/formatters.js';
import { renderAccessDenied, showConfirmDialog, showToast, statusBadge } from './components.js';

export function renderHrView(container, { user, services }) {
  if (!services.authService.hasPermission('hr.manage', user)) {
    renderAccessDenied(container);
    return;
  }

  let selectedWorkerId = null;
  let profileTab = 'datos';

  // Estado temporal para estudios y experiencia al crear/editar hoja de vida
  let draftEducation = [];
  let draftExperience = [];

  function openProfile(workerId) {
    selectedWorkerId = workerId;
    profileTab = 'datos';
    const prof = services.hrService.getWorkerProfile(workerId);
    draftEducation = JSON.parse(JSON.stringify(prof.resume?.education || []));
    draftExperience = JSON.parse(JSON.stringify(prof.resume?.experience || []));
    render();
  }

  function renderSubItemsHtml(items, prefix) {
    if (items.length === 0) return '<p style="font-size:0.85rem; color:var(--text-muted);">Sin registros agregados.</p>';
    return items
      .map((item, idx) =>
        prefix === 'edu'
          ? `
        <div class="form-grid" style="border:1px solid var(--border-color); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.6rem;">
          <div class="form-group">
            <label>Institución</label>
            <input class="form-control" data-edu-field="institution" data-idx="${idx}" value="${escapeHtml(item.institution || '')}" required />
          </div>
          <div class="form-group">
            <label>Título obtenido</label>
            <input class="form-control" data-edu-field="title" data-idx="${idx}" value="${escapeHtml(item.title || '')}" required />
          </div>
          <div class="form-group">
            <label>Fecha inicio</label>
            <input class="form-control" type="date" data-edu-field="startDate" data-idx="${idx}" value="${escapeHtml(item.startDate || '')}" required />
          </div>
          <div class="form-group">
            <label>Fecha fin</label>
            <input class="form-control" type="date" data-edu-field="endDate" data-idx="${idx}" value="${escapeHtml(item.endDate || '')}" />
          </div>
          <div style="display:flex; align-items:flex-end;">
            <button type="button" class="btn btn-danger btn-sm" data-rem-edu="${idx}">Quitar</button>
          </div>
        </div>`
          : `
        <div class="form-grid" style="border:1px solid var(--border-color); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.6rem;">
          <div class="form-group">
            <label>Empresa</label>
            <input class="form-control" data-exp-field="company" data-idx="${idx}" value="${escapeHtml(item.company || '')}" required />
          </div>
          <div class="form-group">
            <label>Cargo</label>
            <input class="form-control" data-exp-field="role" data-idx="${idx}" value="${escapeHtml(item.role || '')}" required />
          </div>
          <div class="form-group">
            <label>Fecha inicio</label>
            <input class="form-control" type="date" data-exp-field="startDate" data-idx="${idx}" value="${escapeHtml(item.startDate || '')}" required />
          </div>
          <div class="form-group">
            <label>Fecha fin</label>
            <input class="form-control" type="date" data-exp-field="endDate" data-idx="${idx}" value="${escapeHtml(item.endDate || '')}" />
          </div>
          <div class="form-group">
            <label>Funciones</label>
            <input class="form-control" data-exp-field="description" data-idx="${idx}" value="${escapeHtml(item.description || '')}" />
          </div>
          <div style="display:flex; align-items:flex-end;">
            <button type="button" class="btn btn-danger btn-sm" data-rem-exp="${idx}">Quitar</button>
          </div>
        </div>`
      )
      .join('');
  }

  function bindSubItemListeners() {
    container.querySelectorAll('[data-edu-field]').forEach((el) => {
      el.oninput = () => {
        draftEducation[Number(el.dataset.idx)][el.dataset.eduField] = el.value;
      };
    });
    container.querySelectorAll('[data-exp-field]').forEach((el) => {
      el.oninput = () => {
        draftExperience[Number(el.dataset.idx)][el.dataset.expField] = el.value;
      };
    });
    container.querySelectorAll('[data-rem-edu]').forEach((btn) => {
      btn.onclick = () => {
        draftEducation.splice(Number(btn.dataset.remEdu), 1);
        render();
      };
    });
    container.querySelectorAll('[data-rem-exp]').forEach((btn) => {
      btn.onclick = () => {
        draftExperience.splice(Number(btn.dataset.remExp), 1);
        render();
      };
    });
    const addEdu = document.getElementById('add-edu-btn');
    if (addEdu) {
      addEdu.onclick = () => {
        draftEducation.push({ institution: '', title: '', startDate: '', endDate: '' });
        render();
      };
    }
    const addExp = document.getElementById('add-exp-btn');
    if (addExp) {
      addExp.onclick = () => {
        draftExperience.push({ company: '', role: '', startDate: '', endDate: '', description: '' });
        render();
      };
    }
  }

  function renderProfileView() {
    const profile = services.hrService.getWorkerProfile(selectedWorkerId);
    const { worker, resume, contracts, attendance, payments, linkedUser } = profile;
    const schedule = services.scheduleAttendanceService.getWorkerSchedule(worker.id);

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Ficha del trabajador: ${escapeHtml(resume?.fullName || worker.id)}</h2>
            <small>Documento: ${escapeHtml(resume?.document || '—')} | Cargo: ${escapeHtml(worker.position)} | ${statusBadge(worker.status)}</small>
          </div>
          <button type="button" class="btn btn-secondary" id="back-workers-btn">← Volver al listado</button>
        </div>

        <div class="tabs" role="tablist">
          <button type="button" class="tab-btn ${profileTab === 'datos' ? 'active' : ''}" data-ptab="datos">Datos</button>
          <button type="button" class="tab-btn ${profileTab === 'hv' ? 'active' : ''}" data-ptab="hv">Hoja de vida</button>
          <button type="button" class="tab-btn ${profileTab === 'contrato' ? 'active' : ''}" data-ptab="contrato">Contrato</button>
          <button type="button" class="tab-btn ${profileTab === 'horario' ? 'active' : ''}" data-ptab="horario">Horario</button>
          <button type="button" class="tab-btn ${profileTab === 'asistencia' ? 'active' : ''}" data-ptab="asistencia">Asistencia</button>
          <button type="button" class="tab-btn ${profileTab === 'pagos' ? 'active' : ''}" data-ptab="pagos">Pagos</button>
        </div>

        ${
          profileTab === 'datos'
            ? `
          <form id="worker-edit-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="we-pos">Cargo</label>
                <input id="we-pos" class="form-control" type="text" required value="${escapeHtml(worker.position)}" />
              </div>
              <div class="form-group">
                <label for="we-hire">Fecha de ingreso</label>
                <input id="we-hire" class="form-control" type="date" required value="${escapeHtml(worker.hireDate)}" />
              </div>
              <div class="form-group">
                <label for="we-status">Estado laboral</label>
                <select id="we-status" class="form-control">
                  <option value="ACTIVO" ${worker.status === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                  <option value="RETIRADO" ${worker.status === 'RETIRADO' ? 'selected' : ''}>RETIRADO</option>
                </select>
              </div>
              <div class="form-group">
                <label>Usuario del sistema vinculado</label>
                <input class="form-control" disabled value="${linkedUser ? `${linkedUser.username} (${linkedUser.role})` : 'Sin usuario vinculado'}" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Actualizar datos del trabajador</button>
          </form>
        `
            : profileTab === 'hv'
              ? `
          <form id="resume-edit-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="re-doc">Documento único</label>
                <input id="re-doc" class="form-control" required value="${escapeHtml(resume.document)}" />
              </div>
              <div class="form-group">
                <label for="re-name">Nombre completo</label>
                <input id="re-name" class="form-control" required value="${escapeHtml(resume.fullName)}" />
              </div>
              <div class="form-group">
                <label for="re-phone">Teléfono</label>
                <input id="re-phone" class="form-control" required value="${escapeHtml(resume.phone)}" />
              </div>
              <div class="form-group">
                <label for="re-email">Correo</label>
                <input id="re-email" class="form-control" type="email" required value="${escapeHtml(resume.email)}" />
              </div>
              <div class="form-group">
                <label for="re-address">Dirección</label>
                <input id="re-address" class="form-control" required value="${escapeHtml(resume.address)}" />
              </div>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input id="re-auth" type="checkbox" ${resume.dataAuthorization ? 'checked' : ''} required />
                <span>Autorizo el tratamiento de datos personales conforme a la Ley 1581 de 2012 (obligatorio).</span>
              </label>
            </div>

            <div style="margin:1rem 0;">
              <div class="card-header">
                <h3 style="font-size:1rem;">Estudios</h3>
                <button type="button" class="btn btn-secondary btn-sm" id="add-edu-btn">+ Agregar estudio</button>
              </div>
              ${renderSubItemsHtml(draftEducation, 'edu')}
            </div>

            <div style="margin:1rem 0;">
              <div class="card-header">
                <h3 style="font-size:1rem;">Experiencia laboral</h3>
                <button type="button" class="btn btn-secondary btn-sm" id="add-exp-btn">+ Agregar experiencia</button>
              </div>
              ${renderSubItemsHtml(draftExperience, 'exp')}
            </div>

            <button type="submit" class="btn btn-primary">Guardar hoja de vida</button>
          </form>
        `
              : profileTab === 'contrato'
                ? `
          <div style="margin-bottom:1.25rem; padding:1rem; background:var(--cream-50); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            <h3 style="font-size:1rem;">Registrar nuevo contrato</h3>
            <form id="contract-form">
              <div class="form-grid">
                <div class="form-group">
                  <label for="ct-type">Tipo de contrato</label>
                  <select id="ct-type" class="form-control">
                    ${CONTRACT_TYPES.map((t) => `<option value="${t.key}">${escapeHtml(t.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label for="ct-start">Fecha de inicio</label>
                  <input id="ct-start" class="form-control" type="date" required value="${getLocalDateString()}" />
                </div>
                <div class="form-group" id="ct-end-group">
                  <label for="ct-end">Fecha de fin</label>
                  <input id="ct-end" class="form-control" type="date" />
                </div>
                <div class="form-group">
                  <label for="ct-pos">Cargo</label>
                  <input id="ct-pos" class="form-control" type="text" required value="${escapeHtml(worker.position)}" />
                </div>
                <div class="form-group">
                  <label for="ct-sal">Salario (COP)</label>
                  <input id="ct-sal" class="form-control" type="number" min="1" step="1" required />
                </div>
              </div>
              <button type="submit" class="btn btn-primary">Crear contrato</button>
            </form>
          </div>

          <h3 style="font-size:1rem;">Historial de contratos</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cargo</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th class="text-right">Salario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${
                  contracts.length === 0
                    ? `<tr><td colspan="7" class="text-center">Sin contratos registrados.</td></tr>`
                    : contracts
                        .map((c) => {
                          const label = CONTRACT_TYPES.find((t) => t.key === c.type)?.label || c.type;
                          return `
                        <tr>
                          <td>${escapeHtml(label)}</td>
                          <td>${escapeHtml(c.position)}</td>
                          <td>${formatDate(c.startDate)}</td>
                          <td>${c.endDate ? formatDate(c.endDate) : 'Indefinido'}</td>
                          <td class="text-right"><strong>${formatCOP(c.salary)}</strong></td>
                          <td>
                            ${statusBadge(c.status)}
                            ${c.voided ? `<br /><small>${escapeHtml(c.voidReason || '')}</small>` : ''}
                          </td>
                          <td>
                            ${!c.voided ? `<button type="button" class="btn btn-danger btn-sm" data-void-ctr="${c.id}">Anular</button>` : '—'}
                          </td>
                        </tr>`;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        `
                : profileTab === 'horario'
                  ? `
          <form id="profile-schedule-form">
            <p style="font-size:0.88rem; color:var(--text-muted);">Deje las horas vacías para marcar el día como libre.</p>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Día</th><th>Hora entrada</th><th>Hora salida</th><th>Limpiar</th></tr></thead>
                <tbody>
                  ${DAY_NAMES.map((d) => {
                    const slot = schedule.days[d.key];
                    return `
                      <tr>
                        <td><strong>${d.label}</strong></td>
                        <td><input type="time" class="form-control" data-sch-start="${d.key}" value="${slot?.startTime || ''}" /></td>
                        <td><input type="time" class="form-control" data-sch-end="${d.key}" value="${slot?.endTime || ''}" /></td>
                        <td><button type="button" class="btn btn-secondary btn-sm" data-sch-clear="${d.key}">Día libre</button></td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:0.75rem;">Guardar horario semanal</button>
          </form>
        `
                  : profileTab === 'asistencia'
                    ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Ingreso</th><th>Salida</th><th>Observación</th></tr></thead>
              <tbody>
                ${
                  attendance.length === 0
                    ? `<tr><td colspan="4" class="text-center">Sin registros de asistencia.</td></tr>`
                    : attendance
                        .map(
                          (a) => `
                        <tr>
                          <td>${formatDate(a.date)}</td>
                          <td>${escapeHtml(a.clockIn)}</td>
                          <td>${a.clockOut ? escapeHtml(a.clockOut) : 'En turno'}</td>
                          <td>${statusBadge(a.observation)}</td>
                        </tr>`
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        `
                    : `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th class="text-right">Valor</th><th>Estado</th></tr></thead>
              <tbody>
                ${
                  payments.length === 0
                    ? `<tr><td colspan="4" class="text-center">Sin pagos registrados.</td></tr>`
                    : payments
                        .map(
                          (p) => `
                        <tr>
                          <td>${formatDate(p.date)}</td>
                          <td>${escapeHtml(p.concept)}</td>
                          <td class="text-right"><strong>${formatCOP(p.amount)}</strong></td>
                          <td>${statusBadge(p.status)}</td>
                        </tr>`
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    document.getElementById('back-workers-btn').onclick = () => {
      selectedWorkerId = null;
      draftEducation = [];
      draftExperience = [];
      render();
    };

    container.querySelectorAll('[data-ptab]').forEach((btn) => {
      btn.onclick = () => {
        profileTab = btn.dataset.ptab;
        render();
      };
    });

    if (profileTab === 'datos') {
      document.getElementById('worker-edit-form').onsubmit = (e) => {
        e.preventDefault();
        try {
          services.hrService.updateWorker(worker.id, {
            position: document.getElementById('we-pos').value,
            hireDate: document.getElementById('we-hire').value,
            status: document.getElementById('we-status').value
          });
          showToast('Datos del trabajador actualizados.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } else if (profileTab === 'hv') {
      bindSubItemListeners();
      document.getElementById('resume-edit-form').onsubmit = (e) => {
        e.preventDefault();
        try {
          services.hrService.saveResume({
            id: resume.id,
            document: document.getElementById('re-doc').value,
            fullName: document.getElementById('re-name').value,
            phone: document.getElementById('re-phone').value,
            email: document.getElementById('re-email').value,
            address: document.getElementById('re-address').value,
            dataAuthorization: document.getElementById('re-auth').checked,
            education: draftEducation,
            experience: draftExperience
          });
          showToast('Hoja de vida actualizada.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } else if (profileTab === 'contrato') {
      document.getElementById('contract-form').onsubmit = (e) => {
        e.preventDefault();
        try {
          services.hrService.createContract({
            workerId: worker.id,
            type: document.getElementById('ct-type').value,
            startDate: document.getElementById('ct-start').value,
            endDate: document.getElementById('ct-end').value,
            position: document.getElementById('ct-pos').value,
            salary: Number(document.getElementById('ct-sal').value)
          });
          showToast('Contrato creado correctamente.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      container.querySelectorAll('[data-void-ctr]').forEach((btn) => {
        btn.onclick = async () => {
          const reason = await showConfirmDialog({
            title: 'Anular contrato',
            message: 'Indique el motivo de anulación del contrato:',
            confirmLabel: 'Anular contrato',
            confirmVariant: 'danger',
            requireReason: true
          });
          if (!reason) return;
          try {
            services.hrService.voidContract(btn.dataset.voidCtr, reason);
            showToast('Contrato anulado.', 'success');
            render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        };
      });
    } else if (profileTab === 'horario') {
      container.querySelectorAll('[data-sch-clear]').forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.schClear;
          container.querySelector(`[data-sch-start="${key}"]`).value = '';
          container.querySelector(`[data-sch-end="${key}"]`).value = '';
        };
      });
      document.getElementById('profile-schedule-form').onsubmit = (e) => {
        e.preventDefault();
        const weekDays = {};
        for (const d of DAY_NAMES) {
          const st = container.querySelector(`[data-sch-start="${d.key}"]`).value;
          const en = container.querySelector(`[data-sch-end="${d.key}"]`).value;
          weekDays[d.key] = !st && !en ? null : { startTime: st, endTime: en };
        }
        try {
          services.scheduleAttendanceService.saveWorkerSchedule(worker.id, weekDays);
          showToast('Horario semanal guardado.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  }

  function renderWorkersList() {
    const workers = services.hrService.listWorkers(false);

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Registrar trabajador y hoja de vida (Ley 1581 de 2012)</h2>
        <form id="create-worker-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="cw-doc">Documento único</label>
              <input id="cw-doc" class="form-control" type="text" required />
            </div>
            <div class="form-group">
              <label for="cw-name">Nombre completo</label>
              <input id="cw-name" class="form-control" type="text" required />
            </div>
            <div class="form-group">
              <label for="cw-phone">Teléfono</label>
              <input id="cw-phone" class="form-control" type="text" required />
            </div>
            <div class="form-group">
              <label for="cw-email">Correo electrónico</label>
              <input id="cw-email" class="form-control" type="email" required />
            </div>
            <div class="form-group">
              <label for="cw-address">Dirección</label>
              <input id="cw-address" class="form-control" type="text" required />
            </div>
            <div class="form-group">
              <label for="cw-position">Cargo</label>
              <input id="cw-position" class="form-control" type="text" required placeholder="Ej: Panadero / Barista" />
            </div>
            <div class="form-group">
              <label for="cw-hire">Fecha de ingreso</label>
              <input id="cw-hire" class="form-control" type="date" required value="${getLocalDateString()}" />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input id="cw-auth" type="checkbox" required />
              <span>Autorización obligatoria de tratamiento de datos personales según la Ley 1581 de 2012.</span>
            </label>
          </div>

          <div style="margin:0.75rem 0;">
            <div class="card-header">
              <strong style="font-size:0.95rem;">Estudios (opcional)</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="add-edu-btn">+ Agregar estudio</button>
            </div>
            ${renderSubItemsHtml(draftEducation, 'edu')}
          </div>

          <div style="margin:0.75rem 0;">
            <div class="card-header">
              <strong style="font-size:0.95rem;">Experiencia laboral (opcional)</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="add-exp-btn">+ Agregar experiencia</button>
            </div>
            ${renderSubItemsHtml(draftExperience, 'exp')}
          </div>

          <button type="submit" class="btn btn-primary">Guardar trabajador</button>
        </form>
      </div>

      <div class="card">
        <h2 class="card-title">Planta de personal</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre completo</th>
                <th>Cargo</th>
                <th>Ingreso</th>
                <th>Estado laboral</th>
                <th>Contrato actual</th>
                <th>Ficha</th>
              </tr>
            </thead>
            <tbody>
              ${workers
                .map(
                  (w) => `
                <tr>
                  <td>${escapeHtml(w.document)}</td>
                  <td><strong>${escapeHtml(w.fullName)}</strong></td>
                  <td>${escapeHtml(w.position)}</td>
                  <td>${formatDate(w.hireDate)}</td>
                  <td>${statusBadge(w.status)}</td>
                  <td>${statusBadge(w.activeContractStatus)}</td>
                  <td>
                    <button type="button" class="btn btn-primary btn-sm" data-open-profile="${w.id}">Abrir ficha</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindSubItemListeners();

    document.getElementById('create-worker-form').onsubmit = (e) => {
      e.preventDefault();
      try {
        services.hrService.createWorker({
          resumeData: {
            document: document.getElementById('cw-doc').value,
            fullName: document.getElementById('cw-name').value,
            phone: document.getElementById('cw-phone').value,
            email: document.getElementById('cw-email').value,
            address: document.getElementById('cw-address').value,
            dataAuthorization: document.getElementById('cw-auth').checked,
            education: draftEducation,
            experience: draftExperience
          },
          position: document.getElementById('cw-position').value,
          hireDate: document.getElementById('cw-hire').value,
          status: 'ACTIVO'
        });
        draftEducation = [];
        draftExperience = [];
        showToast('Trabajador registrado correctamente.', 'success');
        render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    container.querySelectorAll('[data-open-profile]').forEach((btn) => {
      btn.onclick = () => openProfile(btn.dataset.openProfile);
    });
  }

  function render() {
    if (selectedWorkerId) {
      renderProfileView();
    } else {
      renderWorkersList();
    }
  }

  render();
}