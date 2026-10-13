import { useState } from 'react'
import { WIDGET_DEFS, getWidgetDef } from '@shared/widgets'
import type { WidgetDef } from '@shared/widgets'
import { useApp } from '../store'
import { Modal } from '../components/overlays'
import { Empty, Panel } from '../components/ui'

const KIND_LABEL: Record<string, string> = {
  stat: 'Valeur',
  gauge: 'Jauge',
  line: 'Courbe',
  top: 'Classement'
}

export default function Gallery() {
  const data = useApp((s) => s.data)
  const snapshot = useApp((s) => s.snapshot)
  const setPage = useApp((s) => s.setPage)
  const act = useApp((s) => s.act)
  const [picked, setPicked] = useState<WidgetDef | null>(null)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [dashId, setDashId] = useState('')

  const dashboards = data?.dashboards ?? []

  const open = (def: WidgetDef) => {
    setPicked(def)
    setTitle(def.defaultTitle)
    setTarget(def.needsTarget ? '/' : '')
    setDashId(dashboards[0]?.id ?? '')
  }

  const add = async () => {
    if (!picked) return
    const dashboardId = dashId || dashboards[0]?.id
    if (!dashboardId) return
    if (picked.needsTarget && !target.trim()) return
    const ok = await act({
      channel: 'dash:update',
      payload: { op: 'addWidget', dashboardId, defId: picked.id, title, target: target || undefined },
      success: `Widget « ${title} » ajouté`
    })
    if (ok) {
      setPicked(null)
      setPage('overview')
    }
  }

  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>
        Choisissez un widget puis ajoutez-le à un tableau de bord. Sur la vue d'ensemble, glissez les
        widgets par leur barre de titre pour les réorganiser — la disposition est sauvegardée
        automatiquement.
      </p>
      <Panel title={`Catalogue — ${WIDGET_DEFS.length} widgets`}>
        {WIDGET_DEFS.length === 0 ? (
          <Empty text="Aucun widget disponible" />
        ) : (
          <div className="cards">
            {WIDGET_DEFS.map((def) => (
              <div className="card" key={def.id} onClick={() => open(def)}>
                <div className="card-kind">{KIND_LABEL[def.kind] ?? def.kind}</div>
                <div className="card-title">{def.label}</div>
                <div className="card-desc">{def.description}</div>
                {def.needsTarget && (
                  <div className="card-desc" style={{ color: 'var(--orange)' }}>
                    Nécessite une cible (point de montage)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {picked && (
        <Modal title={`Ajouter — ${picked.label}`} onClose={() => setPicked(null)}>
          <div className="form-grid" style={{ marginBottom: 8 }}>
            <div className="field">
              Tableau de bord
              <select className="select" value={dashId} onChange={(e) => setDashId(e.target.value)}>
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              Titre affiché
              <input className="input" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {picked.needsTarget && (
              <div className="field">
                {picked.targetLabel ?? 'Cible'}
                <input
                  className="input"
                  list="mount-list"
                  value={target}
                  placeholder="/"
                  onChange={(e) => setTarget(e.target.value)}
                />
                <datalist id="mount-list">
                  {(snapshot?.fs ?? []).map((f) => (
                    <option key={f.mount} value={f.mount} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
          <p className="hint">
            Rendu : {getWidgetDef(picked.id)?.label} — taille par défaut {picked.defaultW}×
            {picked.defaultH}.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setPicked(null)}>
              Annuler
            </button>
            <button className="btn primary" disabled={!title.trim()} onClick={() => void add()}>
              Ajouter au tableau
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
