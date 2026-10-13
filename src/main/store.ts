import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { AppStoreData, Dashboard } from '../shared/types'

const DEFAULT_DASHBOARD: Dashboard = {
  id: 'principal',
  name: 'Principal',
  widgets: [
    { id: 'w-cpu', defId: 'cpu-load', title: 'Charge CPU', x: 0, y: 0, w: 6, h: 4 },
    { id: 'w-mem', defId: 'mem-gauge', title: 'Mémoire', x: 6, y: 0, w: 3, h: 4 },
    { id: 'w-temp', defId: 'cpu-temp', title: 'Température CPU', x: 9, y: 0, w: 3, h: 4 },
    { id: 'w-rx', defId: 'net-rx', title: 'Réseau entrant', x: 0, y: 4, w: 6, h: 4 },
    { id: 'w-fs', defId: 'fs-usage', title: 'Disque /', target: '/', x: 6, y: 4, w: 3, h: 4 },
    { id: 'w-top', defId: 'top-cpu', title: 'Top processus CPU', x: 9, y: 4, w: 3, h: 5 }
  ]
}

function defaultStore(): AppStoreData {
  return {
    settings: { refreshMs: 2000, expertMode: false },
    dashboards: [JSON.parse(JSON.stringify(DEFAULT_DASHBOARD))],
    rules: [],
    macros: []
  }
}

function storePath(): string {
  return path.join(app.getPath('userData'), 'sysmaster-store.json')
}

function writeStore(s: AppStoreData): void {
  const file = storePath()
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

let cache: AppStoreData | null = null

export function getStore(): AppStoreData {
  if (cache) return cache
  const base = defaultStore()
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), 'utf8')) as Partial<AppStoreData>
    cache = {
      settings: { ...base.settings, ...(raw.settings ?? {}) },
      dashboards:
        Array.isArray(raw.dashboards) && raw.dashboards.length > 0 ? (raw.dashboards as Dashboard[]) : base.dashboards,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
      macros: Array.isArray(raw.macros) ? raw.macros : []
    }
  } catch {
    cache = base
    try {
      writeStore(cache)
    } catch {
      // dossier userData indisponible : on garde les défauts en mémoire
    }
  }
  return cache
}

export function mutateStore(fn: (s: AppStoreData) => void): AppStoreData {
  const s = getStore()
  fn(s)
  try {
    writeStore(s)
  } catch {
    // persistance best-effort
  }
  return s
}
