import { create } from 'zustand'
import type { AppEvent, AppStoreData, AuditEntry, Dashboard, ExecResult, Macro, Rule, Snapshot } from '@shared/types'

export interface ToastItem {
  id: number
  text: string
  level: 'info' | 'ok' | 'error' | 'warn'
}

interface ConfirmState {
  title: string
  message: string
  danger: boolean
  resolve: (ok: boolean) => void
}

const HISTORY_MAX = 60
let seq = 0

function cleanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

interface AppState {
  snapshot: Snapshot | null
  history: Snapshot[]
  data: AppStoreData | null
  audit: AuditEntry[]
  page: string
  confirm: ConfirmState | null
  toasts: ToastItem[]
  setPage: (p: string) => void
  onSnapshot: (s: Snapshot) => void
  setData: (d: AppStoreData) => void
  loadStore: () => Promise<void>
  loadAudit: () => Promise<void>
  onEvent: (e: AppEvent) => void
  toast: (text: string, level?: ToastItem['level']) => void
  dropToast: (id: number) => void
  askConfirm: (title: string, message: string, danger?: boolean) => Promise<boolean>
  resolveConfirm: (ok: boolean) => void
  call: <T>(channel: string, payload?: unknown) => Promise<T | null>
  act: (opts: {
    channel: string
    payload?: unknown
    confirm?: { title: string; message: string; danger?: boolean }
    success?: string
  }) => Promise<boolean>
  exportData: () => void
  importData: (file: File) => Promise<void>
}

export const useApp = create<AppState>()((set, get) => ({
  snapshot: null,
  history: [],
  data: null,
  audit: [],
  page: 'overview',
  confirm: null,
  toasts: [],

  setPage: (p) => set({ page: p }),

  onSnapshot: (s) =>
    set((st) => {
      const history = [...st.history, s]
      if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX)
      return { snapshot: s, history }
    }),

  setData: (d) => set({ data: d }),

  loadStore: async () => {
    const d = await get().call<AppStoreData>('store:get')
    if (d) set({ data: d })
  },

  loadAudit: async () => {
    const a = await get().call<AuditEntry[]>('audit:list')
    if (a) set({ audit: a })
  },

  onEvent: (e) => get().toast(e.text, e.level),

  toast: (text, level = 'info') => {
    const id = ++seq
    set((st) => ({ toasts: [...st.toasts, { id, text, level }] }))
    setTimeout(() => get().dropToast(id), 5000)
  },

  dropToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  askConfirm: (title, message, danger = false) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { title, message, danger, resolve } })
    }),

  resolveConfirm: (ok) => {
    const c = get().confirm
    set({ confirm: null })
    c?.resolve(ok)
  },

  call: async <T,>(channel: string, payload?: unknown): Promise<T | null> => {
    if (!window.sysmaster) return null // mode aperçu (hors Electron) : pas de pont IPC
    try {
      return (await window.sysmaster.invoke(channel, payload)) as T
    } catch (e) {
      get().toast(cleanError(e), 'error')
      return null
    }
  },

  act: async ({ channel, payload, confirm, success }) => {
    if (confirm) {
      const ok = await get().askConfirm(confirm.title, confirm.message, confirm.danger ?? false)
      if (!ok) return false
    }
    const res = await get().call<unknown>(channel, payload)
    if (res === null) return false
    if (res && typeof res === 'object' && 'ok' in res) {
      const er = res as ExecResult
      if (!er.ok) {
        get().toast(er.error ?? 'Commande échouée', 'error')
        return false
      }
    }
    if (success) get().toast(success, 'ok')
    void get().loadStore()
    void get().loadAudit()
    return true
  },

  exportData: () => {
    const d = get().data
    if (!d) return
    const payload = { dashboards: d.dashboards, rules: d.rules, macros: d.macros }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sysmaster-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    get().toast('Configuration exportée', 'ok')
  },

  importData: async (file) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { dashboards?: Dashboard[]; rules?: Rule[]; macros?: Macro[] }
      let count = 0
      for (const dash of Array.isArray(parsed.dashboards) ? parsed.dashboards : []) {
        const created = await get().call<AppStoreData>('dash:update', { op: 'create', name: dash.name })
        if (!created) continue
        const newId = [...created.dashboards].reverse().find((d) => d.name === dash.name.trim() && d.widgets.length === 0)?.id
        if (!newId) continue
        count++
        for (const w of dash.widgets) {
          const after = await get().call<AppStoreData>('dash:update', {
            op: 'addWidget',
            dashboardId: newId,
            defId: w.defId,
            title: w.title,
            target: w.target
          })
          if (!after) continue
        }
        const target = get().data?.dashboards.find((d) => d.id === newId)
        if (target && target.widgets.length > 0) {
          await get().call('dash:update', {
            op: 'setLayout',
            dashboardId: newId,
            items: dash.widgets.map((w) => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))
          })
          // les widgets importés ont été recréés avec de nouveaux ids :
          // on mappe l'ordre pour appliquer la disposition d'origine
        }
      }
      for (const rule of Array.isArray(parsed.rules) ? parsed.rules : []) {
        const r = await get().call('store:update', { kind: 'rules', op: 'save', data: rule })
        if (r) count++
      }
      for (const macro of Array.isArray(parsed.macros) ? parsed.macros : []) {
        const m = await get().call('store:update', { kind: 'macros', op: 'save', data: macro })
        if (m) count++
      }
      await get().loadStore()
      get().toast(`${count} élément(s) importé(s)`, 'ok')
    } catch (e) {
      get().toast(`Import impossible : ${cleanError(e)}`, 'error')
    }
  }
}))

export function initApp(): () => void {
  if (!window.sysmaster) return () => undefined // mode aperçu sans preload
  const offSnap = window.sysmaster.onSnapshot((s) => useApp.getState().onSnapshot(s))
  const offEvt = window.sysmaster.onEvent((e) => useApp.getState().onEvent(e))
  void useApp.getState().loadStore()
  void useApp.getState().loadAudit()
  return () => {
    offSnap()
    offEvt()
  }
}
