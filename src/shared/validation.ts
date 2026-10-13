import type { Dashboard, DashboardWidget, Macro, Rule, Settings } from './types'
import { COMPARE_OPS } from './rules'
import { METRIC_DEFS } from './metrics'
import { getWidgetDef, validateWidget } from './widgets'

/** Canaux IPC autorisés — la liste fait foi côté preload ET côté main. */
export const ALLOWED_IPC = [
  'store:get',
  'store:update',
  'audit:list',
  'metrics:now',
  'system:processes',
  'system:services',
  'system:apps',
  'system:packages',
  'system:connections',
  'system:docker',
  'system:journal',
  'system:sensors',
  'system:ufw',
  'system:users',
  'net:ping',
  'net:dig',
  'control:kill',
  'control:renice',
  'control:service',
  'control:mount',
  'control:docker',
  'control:launch',
  'control:macro',
  'dash:update'
] as const

export function isAllowedChannel(ch: string): boolean {
  return (ALLOWED_IPC as readonly string[]).includes(ch)
}

const SERVICE_OPS = ['start', 'stop', 'restart', 'enable', 'disable']
const DOCKER_OPS = ['start', 'stop', 'restart']
const UNIT_RE = /^[\w@:.-]{1,128}$/
const DOCKER_ID_RE = /^[0-9a-f]{6,64}$/

export function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

export function validateKill(p: unknown): string[] {
  const a = p as { pid?: unknown; signal?: unknown }
  const errors: string[] = []
  if (!a || !isInt(a.pid) || a.pid <= 0) errors.push('PID invalide')
  if (a?.signal !== 'SIGTERM' && a?.signal !== 'SIGKILL') errors.push('Signal invalide (SIGTERM ou SIGKILL)')
  return errors
}

export function validateRenice(p: unknown): string[] {
  const a = p as { pid?: unknown; nice?: unknown }
  const errors: string[] = []
  if (!a || !isInt(a.pid) || a.pid <= 0) errors.push('PID invalide')
  if (!a || !isInt(a.nice) || a.nice < -20 || a.nice > 19) errors.push('Priorité invalide (-20 à 19)')
  return errors
}

export function validateServiceOp(p: unknown): string[] {
  const a = p as { op?: unknown; unit?: unknown }
  const errors: string[] = []
  if (!a || typeof a.op !== 'string' || !SERVICE_OPS.includes(a.op)) errors.push('Opération de service invalide')
  if (!a || typeof a.unit !== 'string' || !UNIT_RE.test(a.unit)) errors.push('Nom d\'unité invalide')
  return errors
}

export function validateMountOp(p: unknown): string[] {
  const a = p as { op?: unknown; device?: unknown }
  const errors: string[] = []
  if (!a || (a.op !== 'mount' && a.op !== 'unmount')) errors.push('Opération de montage invalide')
  if (!a || typeof a.device !== 'string' || !/^\/dev\/[\w/.\-]+$/.test(a.device)) errors.push('Périphérique invalide (chemin /dev/ attendu)')
  return errors
}

export function validateDockerOp(p: unknown): string[] {
  const a = p as { op?: unknown; id?: unknown }
  const errors: string[] = []
  if (!a || typeof a.op !== 'string' || !DOCKER_OPS.includes(a.op)) errors.push('Opération Docker invalide')
  if (!a || typeof a.id !== 'string' || !DOCKER_ID_RE.test(a.id)) errors.push('Identifiant de conteneur invalide')
  return errors
}

export function validateDesktopPath(file: unknown): string[] {
  if (typeof file !== 'string' || !file.endsWith('.desktop') || file.includes('..')) {
    return ['Fichier .desktop invalide']
  }
  const allowed = [
    '/usr/share/applications/',
    '/usr/local/share/applications/',
    '/var/lib/snapd/desktop/applications/',
    '/opt/'
  ]
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  const home = g.process?.env?.HOME
  const ok = allowed.some((p) => file.startsWith(p)) || (home !== undefined && file.startsWith(`${home}/.local/share/applications/`))
  return ok ? [] : ['Emplacement .desktop non autorisé']
}

export function validateRule(r: unknown): string[] {
  const a = r as Partial<Rule>
  const errors: string[] = []
  if (!a || typeof a !== 'object') return ['Règle invalide']
  if (typeof a.id !== 'string' || !a.id.trim()) errors.push('Identifiant de règle invalide')
  if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80) errors.push('Nom de règle invalide (1 à 80 caractères)')
  if (typeof a.metric !== 'string' || !METRIC_DEFS.some((m) => m.key === a.metric)) errors.push('Métrique inconnue')
  const def = METRIC_DEFS.find((m) => m.key === a.metric)
  if (def?.needsTarget && (typeof a.target !== 'string' || !a.target.trim())) errors.push('Cette métrique exige une cible')
  if (typeof a.op !== 'string' || !COMPARE_OPS.includes(a.op as never)) errors.push('Opérateur invalide')
  if (typeof a.threshold !== 'number' || !Number.isFinite(a.threshold)) errors.push('Seuil invalide')
  if (typeof a.durationSec !== 'number' || !Number.isInteger(a.durationSec) || a.durationSec < 0 || a.durationSec > 86400) errors.push('Durée invalide (0 à 86400 s)')
  if (typeof a.cooldownSec !== 'number' || !Number.isInteger(a.cooldownSec) || a.cooldownSec < 0 || a.cooldownSec > 86400) errors.push('Repos invalide (0 à 86400 s)')
  if (!a.action || (a.action.type !== 'notify' && a.action.type !== 'macro')) errors.push('Action invalide')
  else if (a.action.type === 'notify' && (!a.action.title || !a.action.title.trim())) errors.push('Titre de notification invalide')
  else if (a.action.type === 'macro' && (typeof a.action.macroId !== 'string' || !a.action.macroId.trim())) errors.push('Macro cible invalide')
  return errors
}

export function validateMacro(m: unknown, expertMode: boolean): string[] {
  const a = m as Partial<Macro>
  const errors: string[] = []
  if (!a || typeof a !== 'object') return ['Macro invalide']
  if (typeof a.id !== 'string' || !a.id.trim()) errors.push('Identifiant de macro invalide')
  if (typeof a.label !== 'string' || !a.label.trim() || a.label.length > 40) errors.push('Libellé invalide (1 à 40 caractères)')
  const action = a.action as Macro['action'] | undefined
  if (!action || typeof action !== 'object') {
    errors.push('Action de macro invalide')
    return errors
  }
  switch (action.type) {
    case 'shell': {
      if (typeof action.cmd !== 'string' || !action.cmd.trim()) errors.push('Commande vide')
      else if (action.cmd.length > 2000 || action.cmd.includes('\0')) errors.push('Commande invalide')
      if (typeof action.needsRoot !== 'boolean') errors.push('Drapeau root invalide')
      if (!expertMode) errors.push('Mode expert requis pour les commandes shell')
      break
    }
    case 'service': {
      if (typeof action.op !== 'string' || !SERVICE_OPS.includes(action.op)) errors.push('Opération de service invalide')
      if (typeof action.unit !== 'string' || !UNIT_RE.test(action.unit)) errors.push('Unité invalide')
      break
    }
    case 'desktop': {
      const errs = validateDesktopPath(action.file)
      errors.push(...errs)
      break
    }
    case 'kill': {
      if (!isInt(action.pid) || action.pid <= 0) errors.push('PID invalide')
      break
    }
    default:
      errors.push('Type d\'action de macro inconnu')
  }
  return errors
}

export function validateSettings(s: unknown): string[] {
  const a = s as Partial<Settings>
  const errors: string[] = []
  if (!a || typeof a !== 'object') return ['Paramètres invalides']
  if (!isInt(a.refreshMs) || a.refreshMs < 500 || a.refreshMs > 60000) errors.push('Fréquence invalide (500 à 60000 ms)')
  if (typeof a.expertMode !== 'boolean') errors.push('Mode expert invalide')
  return errors
}

export function validateDashboardName(name: unknown): string[] {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) return ['Nom de tableau de bord invalide (1 à 40 caractères)']
  return []
}

export function validateDashUpdate(p: unknown): string[] {
  const a = p as { op?: unknown; dashboardId?: unknown; name?: unknown; defId?: unknown; title?: unknown; target?: unknown; widgetId?: unknown; items?: unknown }
  if (!a || typeof a !== 'object') return ['Mise à jour invalide']
  const errors: string[] = []
  const ops = ['create', 'rename', 'delete', 'addWidget', 'removeWidget', 'setLayout']
  if (typeof a.op !== 'string' || !ops.includes(a.op)) return ['Opération de tableau de bord invalide']
  if (a.op !== 'create' && (typeof a.dashboardId !== 'string' || !a.dashboardId.trim())) errors.push('Tableau de bord cible invalide')
  if (a.op === 'create' || a.op === 'rename') errors.push(...validateDashboardName(a.name))
  if (a.op === 'addWidget') {
    const def = typeof a.defId === 'string' ? getWidgetDef(a.defId) : undefined
    if (!def) errors.push('Widget inconnu')
    if (typeof a.title !== 'string' || !a.title.trim()) errors.push('Titre obligatoire')
    if (def?.needsTarget && (typeof a.target !== 'string' || !a.target.trim())) errors.push('Cible obligatoire')
  }
  if (a.op === 'removeWidget' && (typeof a.widgetId !== 'string' || !a.widgetId.trim())) errors.push('Widget à supprimer invalide')
  if (a.op === 'setLayout') {
    if (!Array.isArray(a.items)) errors.push('Disposition invalide')
    else {
      for (const it of a.items as { id?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown }[]) {
        if (typeof it.id !== 'string' || !isInt(it.x) || !isInt(it.y) || !isInt(it.w) || !isInt(it.h) || it.x < 0 || it.y < 0 || it.w < 1 || it.w > 12 || it.h < 1 || it.h > 24) {
          errors.push('Élément de disposition invalide')
          break
        }
      }
    }
  }
  return errors
}

export function errorsToMessage(errors: string[]): string {
  return errors.join(' — ')
}

// Réutilisé par les tests pour vérifier l'intégrité d'un tableau de bord complet.
export function validateDashboard(d: Dashboard): string[] {
  const errors: string[] = []
  errors.push(...validateDashboardName(d.name))
  for (const w of d.widgets as DashboardWidget[]) {
    errors.push(...validateWidget(w))
  }
  return errors
}
