/**
 * Servicio de Personal, Hojas de Vida (Ley 1581 de 2012) y Contratos Laborales.
 * Solo Administrador.
 */

import { getLocalDateString, diffDays } from '../utils/formatters.js';
import {
  requireNonEmpty,
  requirePositiveInt,
  requireValidEmail,
  validateDateRange
} from '../utils/validators.js';

export const CONTRACT_TYPES = [
  { key: 'TERMINO_FIJO', label: 'Término fijo' },
  { key: 'INDEFINIDO', label: 'Término indefinido' },
  { key: 'OBRA_LABOR', label: 'Obra o labor' },
  { key: 'PRESTACION_SERVICIOS', label: 'Prestación de servicios' }
];

export function createHrService(repo, authService) {
  function getContractStatus(contract, referenceDate = getLocalDateString()) {
    if (contract.voided) return 'ANULADO';
    if (contract.endDate) {
      if (referenceDate > contract.endDate) return 'VENCIDO';
      const remaining = diffDays(referenceDate, contract.endDate);
      if (remaining <= 30) return 'POR_VENCER';
    }
    return 'VIGENTE';
  }

  function _validateSubEntries(entries, label) {
    if (!Array.isArray(entries)) return [];
    return entries.map((item, index) => {
      if (!item.startDate) {
        throw new Error(`En ${label} #${index + 1}, la fecha de inicio es obligatoria.`);
      }
      if (item.endDate) {
        validateDateRange(
          item.startDate,
          item.endDate,
          `Inicio (${label} #${index + 1})`,
          `Fin (${label} #${index + 1})`
        );
      }
      return item;
    });
  }

  function listResumes() {
    authService.requirePermission('hr.manage');
    return repo.getCollection('resumes');
  }

  function getResumeById(id) {
    return repo.getCollection('resumes').find((r) => r.id === id) || null;
  }

  function saveResume(data) {
    authService.requirePermission('hr.manage');
    const document = requireNonEmpty(data.document, 'Número de documento');
    const fullName = requireNonEmpty(data.fullName, 'Nombre completo');
    const phone = requireNonEmpty(data.phone, 'Teléfono');
    const email = requireValidEmail(data.email, 'Correo electrónico');
    const address = requireNonEmpty(data.address, 'Dirección');

    if (!data.dataAuthorization) {
      throw new Error(
        'Debe marcar la autorización de tratamiento de datos personales (Ley 1581 de 2012).'
      );
    }

    const education = _validateSubEntries(data.education || [], 'Estudio');
    const experience = _validateSubEntries(data.experience || [], 'Experiencia laboral');

    const resumes = repo.getCollection('resumes');
    const duplicate = resumes.find(
      (r) => r.document.trim() === document && r.id !== data.id
    );
    if (duplicate) {
      throw new Error(`Ya existe una hoja de vida registrada con el documento "${document}".`);
    }

    if (data.id) {
      const idx = resumes.findIndex((r) => r.id === data.id);
      if (idx === -1) throw new Error('Hoja de vida no encontrada.');
      resumes[idx] = {
        ...resumes[idx],
        document,
        fullName,
        phone,
        email,
        address,
        dataAuthorization: true,
        education,
        experience
      };
      repo.saveCollection('resumes', resumes);
      return resumes[idx];
    }

    const created = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      document,
      fullName,
      phone,
      email,
      address,
      dataAuthorization: true,
      education,
      experience
    };
    resumes.push(created);
    repo.saveCollection('resumes', resumes);
    return created;
  }

  function listWorkers(onlyActive = false) {
    const resumes = repo.getCollection('resumes');
    const contracts = repo.getCollection('contracts');
    const workers = repo.getCollection('workers');

    return workers
      .filter((w) => !onlyActive || w.status === 'ACTIVO')
      .map((w) => {
        const resume = resumes.find((r) => r.id === w.resumeId) || {};
        const activeContract = contracts
          .map((c) => ({ ...c, status: getContractStatus(c) }))
          .find((c) => c.workerId === w.id && (c.status === 'VIGENTE' || c.status === 'POR_VENCER'));
        return {
          ...w,
          fullName: resume.fullName || 'Sin nombre',
          document: resume.document || '—',
          phone: resume.phone || '—',
          email: resume.email || '—',
          activeContractStatus: activeContract ? activeContract.status : 'SIN CONTRATO'
        };
      });
  }

  function createWorker({ resumeData, existingResumeId = null, position, hireDate, status = 'ACTIVO' }) {
    authService.requirePermission('hr.manage');
    const cleanPosition = requireNonEmpty(position, 'Cargo');
    const cleanHireDate = requireNonEmpty(hireDate, 'Fecha de ingreso');
    if (!['ACTIVO', 'RETIRADO'].includes(status)) {
      throw new Error('Estado de trabajador inválido.');
    }

    return repo.runTransaction(() => {
      let resumeId = existingResumeId;
      if (!resumeId) {
        const savedResume = saveResume(resumeData);
        resumeId = savedResume.id;
      } else {
        const res = getResumeById(resumeId);
        if (!res) throw new Error('La hoja de vida seleccionada no existe.');
      }

      const workers = repo.getCollection('workers');
      if (workers.some((w) => w.resumeId === resumeId)) {
        throw new Error('Esta persona ya se encuentra vinculada como trabajador.');
      }

      const worker = {
        id: `wrk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        resumeId,
        position: cleanPosition,
        hireDate: cleanHireDate,
        status
      };
      workers.push(worker);
      repo.saveCollection('workers', workers);
      return worker;
    });
  }

  function updateWorker(id, data) {
    authService.requirePermission('hr.manage');
    const workers = repo.getCollection('workers');
    const idx = workers.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('Trabajador no encontrado.');

    const position = requireNonEmpty(data.position ?? workers[idx].position, 'Cargo');
    const hireDate = requireNonEmpty(data.hireDate ?? workers[idx].hireDate, 'Fecha de ingreso');
    const status = data.status ?? workers[idx].status;
    if (!['ACTIVO', 'RETIRADO'].includes(status)) {
      throw new Error('Estado de trabajador inválido.');
    }

    workers[idx] = { ...workers[idx], position, hireDate, status };
    repo.saveCollection('workers', workers);
    return workers[idx];
  }

  function listContracts(workerId = null) {
    const contracts = repo.getCollection('contracts');
    const filtered = workerId ? contracts.filter((c) => c.workerId === workerId) : contracts;
    return filtered.map((c) => ({ ...c, status: getContractStatus(c) }));
  }

  function createContract(data) {
    authService.requirePermission('hr.manage');
    const workerId = requireNonEmpty(data.workerId, 'Trabajador');
    const type = requireNonEmpty(data.type, 'Tipo de contrato');
    if (!CONTRACT_TYPES.some((t) => t.key === type)) {
      throw new Error('Tipo de contrato inválido.');
    }
    const startDate = requireNonEmpty(data.startDate, 'Fecha de inicio');
    const endDate = data.endDate ? String(data.endDate).trim() : '';
    const position = requireNonEmpty(data.position, 'Cargo');
    const salary = requirePositiveInt(data.salary, 'Salario');

    if (type !== 'INDEFINIDO' && !endDate) {
      throw new Error('Los contratos diferentes a término indefinido requieren fecha de finalización.');
    }
    if (endDate) {
      validateDateRange(startDate, endDate, 'Fecha de inicio', 'Fecha de fin');
    }

    const workers = repo.getCollection('workers');
    if (!workers.some((w) => w.id === workerId)) {
      throw new Error('Trabajador no encontrado.');
    }

    // Regla crítica: solo un contrato vigente (VIGENTE o POR_VENCER) por trabajador
    const existingContracts = listContracts(workerId);
    const hasCurrent = existingContracts.some(
      (c) => c.status === 'VIGENTE' || c.status === 'POR_VENCER'
    );
    if (hasCurrent) {
      throw new Error(
        'El trabajador ya tiene un contrato vigente. Debe esperar su vencimiento o anularlo antes de crear uno nuevo.'
      );
    }

    const contract = {
      id: `ctr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workerId,
      type,
      startDate,
      endDate: endDate || null,
      position,
      salary,
      voided: false,
      voidReason: null
    };

    const all = repo.getCollection('contracts');
    all.unshift(contract);
    repo.saveCollection('contracts', all);
    return { ...contract, status: getContractStatus(contract) };
  }

  function voidContract(id, reason) {
    const user = authService.requirePermission('hr.manage');
    const cleanReason = requireNonEmpty(reason, 'Motivo de anulación');
    const contracts = repo.getCollection('contracts');
    const idx = contracts.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Contrato no encontrado.');
    if (contracts[idx].voided) {
      throw new Error('Este contrato ya se encuentra anulado.');
    }

    contracts[idx] = {
      ...contracts[idx],
      voided: true,
      voidReason: cleanReason
    };
    repo.saveCollection('contracts', contracts);
    authService.logAudit(
      'ANULACION_CONTRATO',
      `Contrato ${id} del trabajador ${contracts[idx].workerId} anulado: ${cleanReason}`,
      user
    );
    return { ...contracts[idx], status: 'ANULADO' };
  }

  function getWorkerProfile(workerId) {
    authService.requirePermission('hr.manage');
    const worker = repo.getCollection('workers').find((w) => w.id === workerId);
    if (!worker) throw new Error('Trabajador no encontrado.');
    const resume = getResumeById(worker.resumeId);
    const contracts = listContracts(workerId);
    const schedule = repo.getCollection('schedules').find((s) => s.workerId === workerId) || null;
    const attendance = repo.getCollection('attendance').filter((a) => a.workerId === workerId);
    const payments = repo.getCollection('staffPayments').filter((p) => p.workerId === workerId);
    const linkedUser = repo.getCollection('users').find((u) => u.workerId === workerId) || null;

    return {
      worker,
      resume,
      contracts,
      schedule,
      attendance,
      payments,
      linkedUser
    };
  }

  return {
    getContractStatus,
    listResumes,
    getResumeById,
    saveResume,
    listWorkers,
    createWorker,
    updateWorker,
    listContracts,
    createContract,
    voidContract,
    getWorkerProfile
  };
}