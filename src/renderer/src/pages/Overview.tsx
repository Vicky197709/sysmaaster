import { useRef, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout'
import type { AppStoreData, Dashboard, DashboardWidget } from '@shared/types'
import { useApp } from '../store'
import { Modal } from '../components/overlays'
import { Empty, Panel } from '../components/ui'
import { WidgetView } from '../components/widgets'

const Grid = WidthProvider(GridLayout)

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export default function Overview() {
  const data = useApp((s) => s.data)
  const setPage = useApp((s) => s.setPage)
  const call = useApp((s) => s.call)
  const act = useApp((s) => s.act)
  const askConfirm = useApp((s) => s.askConfirm)
  const toast = useApp((s) => s.toast)
  const exportData = useApp((s) => s.exportData)
  const importData = useApp((s) => s.importData)

  const dashboards = data?.dashboards ?? []
  const [activeId, setActiveId] = useState<string | null>(null)
  const active: Dashboard | null =
    dashboards.find((d) => d.id === activeId) ?? dashboards[0] ?? null

  const [showCreate, setShowCreate] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const layoutSaving = useRef(false)

  const createDash = async () => {
    const name = nameDraft.trim()
    if (!name) return toast('Nom de tableau de bord obligatoire', 'error')
    const res = await call<AppStoreData>('dash:update', { op: 'create', name })
    setShowCreate(false)
    setNameDraft('')
    if (res) {
      toast(`Tableau « ${name} » créé`, 'ok')
      const created = res.dashboards.find((d) => d.name === name)
      if (created) setActiveId(created.id)
      void useApp.getState().loadStore()
    }
  }

  const renameDash = async () => {
    if (!active) return
    const name = nameDraft.trim()
    if (!name) return toast('Nom obligatoire', 'error')
    const res = await call<AppStoreData>('dash:update', {
      op: 'rename',
      dashboardId: active.id,
      name
    })
    setShowRename(false)
    if (res) toast('Tableau de bord renommé', 'ok')
  }

  const deleteDash = async () => {
    if (!active) return
    const ok = await askConfirm(
      'Supprimer le tableau',
      `Supprimer « ${active.name} » et ses ${active.widgets.length} widget(s) ?`,
      true
    )
    if (!ok) return
    const res = await call<AppStoreData>('dash:update', { op: 'delete', dashboardId: active.id })
    if (res) {
      toast('Tableau de bord supprimé', 'ok')
      setActiveId(null)
    }
  }

  const removeWidget = async (w: DashboardWidget) => {
    if (!active) return
    const ok = await askConfirm('Retirer le widget', `Retirer « ${w.title} » du tableau ?`, true)
    if (!ok) return
    const res = await call<AppStoreData>('dash:update', {
      op: 'removeWidget',
      dashboardId: active.id,
      widgetId: w.id
    })
    if (res) toast('Widget retiré', 'ok')
  }

  const onLayout = (items: { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!active || layoutSaving.current) return
    const changed = active.widgets.some((w) => {
      const it = items.find((i) => i.i === w.id)
      return !it || it.x !== w.x || it.y !== w.y || it.w !== w.w || it.h !== w.h
    })
    if (!changed || items.length !== active.widgets.length) return
    layoutSaving.current = true
    void call('dash:update', {
      op: 'setLayout',
      dashboardId: active.id,
      items: items.map((i) => ({ id: i.i, x: i.x, y: i.y, w: i.w, h: i.h }))
    }).finally(() => {
      layoutSaving.current = false
    })
  }

  const addWidgetBtn = (
    <button className="btn primary sm" onClick={() => setPage('gallery')}>
      + Ajouter un widget
    </button>
  )

  return (
    <div>
      <div className="tabs">
        {dashboards.map((d) => (
          <div
            key={d.id}
            className={`tab${active && active.id === d.id ? ' active' : ''}`}
            onClick={() => setActiveId(d.id)}
          >
            {d.name}
          </div>
        ))}
        <button className="btn sm" onClick={() => setShowCreate(true)}>
          + Nouveau
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn sm"
          disabled={!active}
          onClick={() => {
            if (!active) return
            setNameDraft(active.name)
            setShowRename(true)
          }}
        >
          Renommer
        </button>
        <button className="btn sm danger" disabled={!active} onClick={() => void deleteDash()}>
          Supprimer
        </button>
        <button className="btn sm" onClick={exportData}>
          Exporter
        </button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          Importer
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importData(f)
            e.target.value = ''
          }}
        />
      </div>

      {!active ? (
        <Panel title="Tableau de bord">
          <Empty text="Aucun tableau de bord. Créez-en un avec « + Nouveau »." />
        </Panel>
      ) : active.widgets.length === 0 ? (
        <Panel title={active.name} actions={addWidgetBtn}>
          <Empty text="Tableau vide — ouvrez la galerie pour ajouter des widgets." />
        </Panel>
      ) : (
        <div style={{ marginRight: -6 }}>
          <div className="panel-actions" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
            {addWidgetBtn}
          </div>
          <Grid
            className="layout"
            layout={active.widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))}
            cols={12}
            rowHeight={46}
            margin={[12, 12]}
            useCSSTransforms
            draggableHandle=".widget-head"
            onLayoutChange={(items) => onLayout(items as { i: string; x: number; y: number; w: number; h: number }[])}
          >
            {active.widgets.map((w) => (
              <div key={w.id}>
                <div className="widget">
                  <div className="widget-head">
                    <span title={w.title}>{w.title}</span>
                    <button className="widget-x" title="Retirer" onClick={() => void removeWidget(w)}>
                      ✕
                    </button>
                  </div>
                  <div className="widget-body">
                    <WidgetView w={w} />
                  </div>
                </div>
              </div>
            ))}
          </Grid>
        </div>
      )}

      {showCreate && (
        <Modal title="Nouveau tableau de bord" onClose={() => setShowCreate(false)}>
          <div className="field" style={{ marginBottom: 14 }}>
            Nom
            <input
              className="input"
              autoFocus
              value={nameDraft}
              maxLength={40}
              placeholder="p. ex. Serveur web"
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createDash()}
            />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowCreate(false)}>
              Annuler
            </button>
            <button className="btn primary" onClick={() => void createDash()}>
              Créer
            </button>
          </div>
        </Modal>
      )}

      {showRename && active && (
        <Modal title="Renommer le tableau" onClose={() => setShowRename(false)}>
          <div className="field" style={{ marginBottom: 14 }}>
            Nom
            <input
              className="input"
              autoFocus
              value={nameDraft}
              maxLength={40}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void renameDash()}
            />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowRename(false)}>
              Annuler
            </button>
            <button className="btn primary" onClick={() => void renameDash()}>
              Renommer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
