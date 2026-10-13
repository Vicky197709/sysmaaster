import { spawn } from 'child_process'
import { audit } from './audit'
import { run, runAsRoot, type RunResult } from './exec'
import { listDesktopApps, splitExec } from './services'
import { getStore } from './store'
import type { ExecResult } from '../shared/types'
import {
  errorsToMessage,
  validateDesktopPath,
  validateDockerOp,
  validateKill,
  validateMacro,
  validateMountOp,
  validateRenice,
  validateServiceOp
} from '../shared/validation'

function toExec(r: RunResult): ExecResult {
  return {
    ok: r.ok,
    output: (r.stdout || '').trim(),
    error: r.ok ? undefined : (r.stderr || r.stdout || 'commande échouée').trim()
  }
}

function refused(action: string, target: string, errors: string[]): ExecResult {
  const msg = errorsToMessage(errors)
  audit(action, target, 'refusé', msg)
  return { ok: false, output: '', error: msg }
}

/** Tue un processus (SIGTERM ou SIGKILL), après validation du charge utile. */
export async function killPid(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { pid?: number; signal?: 'SIGTERM' | 'SIGKILL' }
  const errs = validateKill(payload)
  if (errs.length) return refused('Tuer un processus', `PID ${a.pid ?? '?'}`, errs)
  const pid = a.pid as number
  try {
    process.kill(pid, a.signal)
    audit('Tuer un processus', `PID ${pid}`, 'ok', a.signal)
    return { ok: true, output: `Signal ${a.signal} envoyé au PID ${pid}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    audit('Tuer un processus', `PID ${pid}`, 'erreur', msg)
    return { ok: false, output: '', error: msg }
  }
}

/** Change la priorité (nice) d'un processus ; repli via Polkit si privilège requis. */
export async function renice(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { pid?: number; nice?: number }
  const errs = validateRenice(payload)
  if (errs.length) return refused('Modifier la priorité', `PID ${a.pid ?? '?'}`, errs)
  const pid = a.pid as number
  const nice = a.nice as number
  let r = await run('renice', ['-n', String(nice), '-p', String(pid)])
  if (!r.ok && nice < 0) r = await runAsRoot('renice', ['-n', String(nice), '-p', String(pid)])
  audit('Modifier la priorité', `PID ${pid}`, r.ok ? 'ok' : 'erreur', r.ok ? `nice=${nice}` : r.stderr || r.stdout)
  if (r.ok) return { ok: true, output: `Priorité du PID ${pid} définie à ${nice}` }
  return toExec(r)
}

/** Démarrage/arrêt/redémarrage/activation d'un service systemd via l'agent Polkit. */
export async function serviceOp(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { op?: string; unit?: string }
  const errs = validateServiceOp(payload)
  if (errs.length) return refused('Service système', `${a.op ?? '?'} ${a.unit ?? '?'}`, errs)
  const r = await runAsRoot('systemctl', [a.op as string, a.unit as string], { timeoutMs: 60000 })
  audit('Service système', `${a.op} ${a.unit}`, r.ok ? 'ok' : 'erreur', r.ok ? undefined : r.stderr || r.stdout)
  return toExec(r)
}

/** Monte/démonte un périphérique via udisks2. */
export async function mountOp(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { op?: string; device?: string }
  const errs = validateMountOp(payload)
  if (errs.length) return refused('Montage', `${a.op ?? '?'} ${a.device ?? '?'}`, errs)
  const args = a.op === 'mount' ? ['mount', '-b', a.device as string] : ['unmount', '-b', a.device as string]
  const r = await run('udisksctl', args, { timeoutMs: 30000 })
  audit('Montage', `${a.op} ${a.device}`, r.ok ? 'ok' : 'erreur', r.ok ? undefined : r.stderr || r.stdout)
  return toExec(r)
}

/** Contrôle d'un conteneur Docker. */
export async function dockerOp(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { op?: string; id?: string }
  const errs = validateDockerOp(payload)
  if (errs.length) return refused('Docker', `${a.op ?? '?'} ${a.id ?? '?'}`, errs)
  const r = await run('docker', [a.op as string, a.id as string], { timeoutMs: 30000 })
  audit('Docker', `${a.op} ${a.id}`, r.ok ? 'ok' : 'erreur', r.ok ? undefined : r.stderr || r.stdout)
  return toExec(r)
}

/** Lance une application à partir de son fichier .desktop (emplacement autorisé uniquement). */
export async function launchDesktop(payload: unknown): Promise<ExecResult> {
  const a = (payload ?? {}) as { file?: string }
  const errs = validateDesktopPath(a.file)
  if (errs.length) return refused('Lancer une application', a.file ?? '?', errs)
  const file = a.file as string
  const app = listDesktopApps().find((x) => x.file === file)
  if (!app) {
    audit('Lancer une application', file, 'erreur', 'fichier .desktop introuvable')
    return { ok: false, output: '', error: 'Application introuvable' }
  }
  const tokens = splitExec(app.exec)
  if (tokens.length === 0) {
    audit('Lancer une application', app.name, 'erreur', 'ligne Exec vide')
    return { ok: false, output: '', error: 'Ligne Exec vide' }
  }
  const [bin, ...args] = tokens
  const launched = await new Promise<boolean>((resolve) => {
    let settled = false
    try {
      const child = spawn(bin, args, { detached: true, stdio: 'ignore' })
      child.on('error', () => {
        if (!settled) {
          settled = true
          resolve(false)
        }
      })
      child.unref()
      setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(true)
        }
      }, 300)
    } catch {
      if (!settled) {
        settled = true
        resolve(false)
      }
    }
  })
  audit('Lancer une application', app.name, launched ? 'ok' : 'erreur', launched ? undefined : `échec de ${bin}`)
  return launched
    ? { ok: true, output: `${app.name} lancée` }
    : { ok: false, output: '', error: `Impossible de lancer ${bin}` }
}

/** Exécute une macro enregistrée ; l'habilitation est revérifiée côté serveur. */
export async function runMacro(payload: unknown, origin = 'Macro'): Promise<ExecResult> {
  const a = (payload ?? {}) as { macroId?: string }
  const macroId = typeof a.macroId === 'string' ? a.macroId : String(a.macroId ?? '')
  const store = getStore()
  const macro = store.macros.find((m) => m.id === macroId)
  if (!macro) {
    audit('Macro', macroId || '?', 'refusé', 'macro introuvable')
    return { ok: false, output: '', error: 'Macro introuvable' }
  }
  const errs = validateMacro(macro, store.settings.expertMode)
  if (errs.length) return refused('Macro', macro.label, errs)
  const act = macro.action
  switch (act.type) {
    case 'shell': {
      const r = act.needsRoot
        ? await runAsRoot('sh', ['-c', act.cmd], { timeoutMs: 60000 })
        : await run('sh', ['-c', act.cmd], { timeoutMs: 60000 })
      audit(`${origin} « ${macro.label} »`, act.cmd.slice(0, 120), r.ok ? 'ok' : 'erreur', r.ok ? undefined : r.stderr || r.stdout)
      return toExec(r)
    }
    case 'service':
      return serviceOp({ op: act.op, unit: act.unit })
    case 'desktop':
      return launchDesktop({ file: act.file })
    case 'kill':
      return killPid({ pid: act.pid, signal: 'SIGTERM' })
    default:
      return refused('Macro', macro.label, ['Type d\'action inconnu'])
  }
}
