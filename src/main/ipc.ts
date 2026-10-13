import { ipcMain } from 'electron'
import { listAudit } from './audit'
import * as ctrl from './control'
import { collectSnapshot, getLastSnapshot } from './metrics'
import * as svc from './services'
import { getStore, mutateStore } from './store'
import type { AppStoreData, Macro, Rule, Settings } from '../shared/types'
import { createWidget } from '../shared/widgets'
import {
  errorsToMessage,
  isAllowedChannel,
  validateDashUpdate,
  validateMacro,
  validateRule,
  validateSettings
} from '../shared/validation'

type DashPayload = {
  op: string
  dashboardId?: string
  name?: string
  defId?: string
  title?: string
  target?: string
  widgetId?: string
  items?: { id: string; x: number; y: number; w: number; h: number }[]
}

export function registerIpc(onSettingsChange: (s: Settings) => void): void {
  function handle<T>(channel: string, fn: (payload: unknown) => Promise<T> | T): void {
    ipcMain.handle(channel, async (_event, payload: unknown) => {
      if (!isAllowedChannel(channel)) throw new Error('Canal IPC refusé')
      try {
        return await fn(payload)
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err))
      }
    })
  }

  const asObj = (p: unknown): Record<string, unknown> =>
    p && typeof p === 'object' ? (p as Record<string, unknown>) : {}

  // ----- Magasin (paramètres, règles, macros) -----

  handle<AppStoreData>('store:get', () => getStore())

  handle<AppStoreData>('store:update', (payload) => {
    const p = asObj(payload)
    const kind = typeof p.kind === 'string' ? p.kind : ''
    const op = typeof p.op === 'string' ? p.op : ''
    const id = typeof p.id === 'string' ? p.id : ''
    if (kind === 'settings') {
      const errs = validateSettings(p.data)
      if (errs.length) throw new Error(errorsToMessage(errs))
      const settings = p.data as Settings
      mutateStore((s) => {
        s.settings = settings
      })
      onSettingsChange(settings)
    } else if (kind === 'rules') {
      if (op === 'save') {
        const errs = validateRule(p.data)
        if (errs.length) throw new Error(errorsToMessage(errs))
        const rule = p.data as Rule
        mutateStore((s) => {
          const i = s.rules.findIndex((r) => r.id === rule.id)
          if (i >= 0) s.rules[i] = rule
          else s.rules.push(rule)
        })
      } else if (op === 'delete') {
        if (!id) throw new Error('Identifiant de règle invalide')
        mutateStore((s) => {
          s.rules = s.rules.filter((r) => r.id !== id)
        })
      } else {
        throw new Error('Opération inconnue')
      }
    } else if (kind === 'macros') {
      if (op === 'save') {
        const errs = validateMacro(p.data, getStore().settings.expertMode)
        if (errs.length) throw new Error(errorsToMessage(errs))
        const macro = p.data as Macro
        mutateStore((s) => {
          const i = s.macros.findIndex((m) => m.id === macro.id)
          if (i >= 0) s.macros[i] = macro
          else s.macros.push(macro)
        })
      } else if (op === 'delete') {
        if (!id) throw new Error('Identifiant de macro invalide')
        mutateStore((s) => {
          s.macros = s.macros.filter((m) => m.id !== id)
        })
      } else {
        throw new Error('Opération inconnue')
      }
    } else {
      throw new Error('Catégorie de mise à jour inconnue')
    }
    return getStore()
  })

  // ----- Tableaux de bord / widgets -----

  handle<AppStoreData>('dash:update', (payload) => {
    const errs = validateDashUpdate(payload)
    if (errs.length) throw new Error(errorsToMessage(errs))
    const p = payload as DashPayload
    mutateStore((s) => {
      const findDash = (): NonNullable<AppStoreData['dashboards'][number]> => {
        const d = s.dashboards.find((x) => x.id === p.dashboardId)
        if (!d) throw new Error('Tableau de bord introuvable')
        return d
      }
      switch (p.op) {
        case 'create':
          s.dashboards.push({ id: `db-${Date.now().toString(36)}`, name: (p.name ?? '').trim(), widgets: [] })
          break
        case 'rename':
          findDash().name = (p.name ?? '').trim()
          break
        case 'delete': {
          if (s.dashboards.length <= 1) throw new Error('Impossible de supprimer le dernier tableau de bord')
          s.dashboards = s.dashboards.filter((d) => d.id !== p.dashboardId)
          break
        }
        case 'addWidget': {
          const d = findDash()
          d.widgets.push(createWidget(p.defId as string, d.widgets, { title: p.title, target: p.target }))
          break
        }
        case 'removeWidget': {
          const d = findDash()
          d.widgets = d.widgets.filter((w) => w.id !== p.widgetId)
          break
        }
        case 'setLayout': {
          const d = findDash()
          for (const it of p.items ?? []) {
            const w = d.widgets.find((x) => x.id === it.id)
            if (w) {
              w.x = it.x
              w.y = it.y
              w.w = it.w
              w.h = it.h
            }
          }
          break
        }
        default:
          throw new Error('Opération inconnue')
      }
    })
    return getStore()
  })

  // ----- Lecture -----

  handle('audit:list', () => listAudit())
  handle('metrics:now', async () => getLastSnapshot() ?? (await collectSnapshot()))
  handle('system:processes', () => svc.listProcesses())
  handle('system:services', () => svc.listServices())
  handle('system:apps', () => svc.listDesktopApps())
  handle('system:packages', () => svc.listPackages())
  handle('system:connections', () => svc.listConnections())
  handle('system:docker', () => svc.listDocker())
  handle('system:journal', () => svc.listJournal())
  handle('system:sensors', () => svc.readSensors())
  handle('system:ufw', () => svc.ufwStatus())
  handle('system:users', async () => ({ sessions: await svc.listSessions(), localUsers: svc.listLocalUsers() }))
  handle('net:ping', (p) => svc.ping(String(asObj(p).host ?? '')))
  handle('net:dig', (p) => svc.dnsLookup(String(asObj(p).name ?? '')))

  // ----- Contrôle (chaque action est validée puis journalisée) -----

  handle('control:kill', (p) => ctrl.killPid(p))
  handle('control:renice', (p) => ctrl.renice(p))
  handle('control:service', (p) => ctrl.serviceOp(p))
  handle('control:mount', (p) => ctrl.mountOp(p))
  handle('control:docker', (p) => ctrl.dockerOp(p))
  handle('control:launch', (p) => ctrl.launchDesktop(p))
  handle('control:macro', (p) => ctrl.runMacro(p))
}
