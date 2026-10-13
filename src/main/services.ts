import fs from 'fs'
import os from 'os'
import path from 'path'
import si from 'systeminformation'
import { run } from './exec'
import type {
  ConnInfo,
  ContainerInfo,
  DesktopApp,
  LocalUser,
  PkgInfo,
  ProcessInfo,
  ServiceInfo,
  SessionInfo
} from '../shared/types'

// ---------- Processus ----------

export async function listProcesses(): Promise<ProcessInfo[]> {
  const p = await si.processes()
  return p.list
    .map((x) => ({
      pid: x.pid,
      name: x.name || '—',
      cpu: Math.round((x.cpu ?? 0) * 10) / 10,
      mem: Math.round((x.mem ?? 0) * 10) / 10,
      user: x.user || '—',
      state: x.state || '—'
    }))
    .sort((a, b) => b.cpu - a.cpu)
}

// ---------- Services systemd ----------

export async function listServices(): Promise<ServiceInfo[]> {
  const r = await run('systemctl', ['list-units', '--type=service', '--all', '--no-legend', '--plain', '--no-pager'])
  if (!r.ok) throw new Error(r.stderr || 'systemctl indisponible')
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\s+/)
      return {
        unit: cols[0] ?? '',
        active: cols[2] ?? '',
        sub: cols[3] ?? '',
        description: cols.slice(4).join(' ')
      }
    })
    .filter((s) => s.unit.includes('.'))
}

// ---------- Applications (.desktop) ----------

function desktopDirs(): string[] {
  return [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/snapd/desktop/applications'
  ]
}

interface DesktopRaw {
  name: string
  exec: string
  icon: string
  categories: string
  terminal: boolean
}

function parseDesktop(content: string): DesktopRaw | null {
  const lines = content.split('\n')
  let inEntry = false
  const kv = new Map<string, string>()
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      if (line === '[Desktop Entry]') inEntry = true
      else if (inEntry) break
      continue
    }
    if (!inEntry) continue
    const eq = line.indexOf('=')
    if (eq > 0) kv.set(line.slice(0, eq), line.slice(eq + 1))
  }
  if (kv.get('Type') !== 'Application') return null
  const name = kv.get('Name')
  const exec = kv.get('Exec')
  if (!name || !exec) return null
  return {
    name,
    exec,
    icon: kv.get('Icon') ?? '',
    categories: kv.get('Categories') ?? '',
    terminal: kv.get('Terminal') === 'true'
  }
}

export function listDesktopApps(): DesktopApp[] {
  const out: DesktopApp[] = []
  for (const dir of desktopDirs()) {
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.desktop')) continue
      const full = path.join(dir, f)
      try {
        const parsed = parseDesktop(fs.readFileSync(full, 'utf8'))
        if (!parsed) continue
        out.push({ file: full, name: parsed.name, exec: parsed.exec, icon: parsed.icon, categories: parsed.categories })
      } catch {
        // fichier illisible : ignoré
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/** Découpe une ligne Exec de .desktop en tokens (codes de champ %u, %f… retirés). */
export function splitExec(exec: string): string[] {
  const cleaned = exec
    .replace(/%%/g, '\u0001')
    .replace(/%[uUfFdDnNickvm]/g, '')
    .replace(/\u0001/g, '%')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? '')
  }
  return tokens.filter(Boolean)
}

// ---------- Paquets (dpkg, cache 60 s) ----------

let pkgCache: { ts: number; data: PkgInfo[] } | null = null

export async function listPackages(): Promise<PkgInfo[]> {
  if (pkgCache && Date.now() - pkgCache.ts < 60_000) return pkgCache.data
  const r = await run('dpkg-query', ['-W', '-f=${Package} ${Version} ${db:Status-Status}\\n'], { maxBuffer: 16 * 1024 * 1024 })
  if (!r.ok) throw new Error(r.stderr || 'dpkg-query indisponible')
  const data: PkgInfo[] = []
  for (const line of r.stdout.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length >= 3 && cols[2] === 'installed') data.push({ name: cols[0], version: cols[1] })
  }
  pkgCache = { ts: Date.now(), data }
  return data
}

// ---------- Réseau ----------

export async function listConnections(): Promise<ConnInfo[]> {
  const r = await run('ss', ['-tupnH'])
  if (!r.ok) throw new Error(r.stderr || 'ss indisponible')
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\s+/)
      const procMatch = /users:\(\("([^"]+)"/.exec(line)
      return {
        proto: cols[0] ?? '',
        state: cols[1] ?? '',
        local: cols[4] ?? '',
        peer: cols[5] ?? '',
        process: procMatch?.[1] ?? '—'
      }
    })
    .filter((c) => c.local)
}

const HOST_RE = /^[\w.:\-]{1,253}$/

export async function ping(host: string): Promise<string> {
  if (!HOST_RE.test(host)) throw new Error('Hôte invalide')
  const r = await run('ping', ['-c', '4', '-W', '2', host], { timeoutMs: 12000 })
  return (r.stdout || r.stderr).trim()
}

export async function dnsLookup(name: string): Promise<string> {
  if (!/^[\w.-]{1,253}$/.test(name)) throw new Error('Nom de domaine invalide')
  const r = await run('dig', ['+short', '+time=3', '+tries=1', name, 'A'], { timeoutMs: 10000 })
  return (r.stdout || r.stderr).trim() || 'Aucune réponse'
}

export async function ufwStatus(): Promise<string> {
  const r = await run('ufw', ['status', 'verbose'], { timeoutMs: 8000 })
  return (r.stdout || r.stderr).trim()
}

// ---------- Docker ----------

export async function listDocker(): Promise<ContainerInfo[]> {
  const r = await run('docker', ['ps', '-a', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'])
  if (!r.ok) throw new Error(r.stderr || 'Docker indisponible')
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = '', name = '', image = '', status = ''] = line.split('\t')
      return { id, name, image, status }
    })
}

// ---------- Journal système ----------

export async function listJournal(lines = 200): Promise<string> {
  const n = Math.min(Math.max(Math.round(lines), 1), 1000)
  const r = await run('journalctl', ['-n', String(n), '-o', 'short-iso', '--no-pager'], { timeoutMs: 10000 })
  if (!r.ok) throw new Error(r.stderr || 'journalctl indisponible')
  return r.stdout.trim()
}

// ---------- Capteurs ----------

export async function readSensors(): Promise<string> {
  const r = await run('sensors', [], { timeoutMs: 8000 })
  if (!r.ok) throw new Error(r.stderr || 'sensors indisponible')
  return r.stdout.trim()
}

// ---------- Utilisateurs ----------

export async function listSessions(): Promise<SessionInfo[]> {
  const users = await si.users()
  return users.map((u) => ({
    user: u.user,
    tty: u.tty || '—',
    from: u.ip || 'local',
    since: [u.date, u.time].filter(Boolean).join(' ')
  }))
}

export function listLocalUsers(): LocalUser[] {
  try {
    return fs
      .readFileSync('/etc/passwd', 'utf8')
      .split('\n')
      .map((l) => l.split(':'))
      .filter((c) => c.length >= 7 && Number(c[2]) >= 1000 && Number.isFinite(Number(c[2])))
      .map((c) => ({ name: c[0], uid: Number(c[2]), shell: c[6], home: c[5] }))
  } catch {
    return []
  }
}
