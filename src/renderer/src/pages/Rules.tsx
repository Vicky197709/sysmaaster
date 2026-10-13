import { useState } from 'react'
import { COMPARE_OPS } from '@shared/rules'
import { METRIC_DEFS, getMetricDef } from '@shared/metrics'
import type { Rule } from '@shared/types'
import { useApp } from '../store'
import { Modal } from '../components/overlays'
import { Badge, Empty, Panel } from '../components/ui'

function newId(): string {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyRule(): Rule {
  return {
    id: newId(),
    name: '',
    enabled: true,
    metric: 'cpu.load',
    op: '>',
    threshold: 90,
    durationSec: 30,
    cooldownSec: 300,
    action: { type: 'notify', title: 'Seuil dépassé' }
  }
}

export default function Rules() {
  const data = useApp((s) => s.data)
  const snapshot = useApp((s) => s.snapshot)
  const act = useApp((s) => s.act)
  const askConfirm = useApp((s) => s.askConfirm)
  const toast = useApp((s) => s.toast)

  const rules = data?.rules ?? []
  const macros = data?.macros ?? []
  const [draft, setDraft] = useState<Rule | null>(null)

  const def = draft ? getMetricDef(draft.metric) : undefined

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return toast('Nom de règle obligatoire', 'error')
    if (!Number.isFinite(draft.threshold)) return toast('Seuil invalide', 'error')
    if (def?.needsTarget && !draft.target?.trim()) return toast('Cible obligatoire', 'error')
    if (draft.action.type === 'macro' && !draft.action.macroId)
      return toast('Sélectionnez une macro', 'error')
    const ok = await act({
      channel: 'store:update',
      payload: { kind: 'rules', op: 'save', data: draft },
      success: 'Règle enregistrée'
    })
    if (ok) setDraft(null)
  }

  const toggle = (r: Rule) =>
    void act({
      channel: 'store:update',
      payload: { kind: 'rules', op: 'save', data: { ...r, enabled: !r.enabled } },
      success: r.enabled ? `Règle « ${r.name} » désactivée` : `Règle « ${r.name} » activée`
    })

  const del = async (r: Rule) => {
    const ok = await askConfirm('Supprimer la règle', `Supprimer « ${r.name} » ?`, true)
    if (!ok) return
    await act({
      channel: 'store:update',
      payload: { kind: 'rules', op: 'delete', id: r.id },
      success: 'Règle supprimée'
    })
  }

  const describe = (r: Rule): string => {
    const m = getMetricDef(r.metric)
    return `${m?.label ?? r.metric}${r.target ? ` (${r.target})` : ''} ${r.op} ${r.threshold}${
      m?.unit && m.unit !== '%' ? ` ${m.unit}` : '%'
    } pendant ${r.durationSec}s · repos ${r.cooldownSec}s`
  }

  return (
    <div>
      <Panel
        title={`Règles automatiques — ${rules.length}`}
        actions={
          <button className="btn primary sm" onClick={() => setDraft(emptyRule())}>
            + Nouvelle règle
          </button>
        }
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Le moteur évalue ces règles à chaque relevé : si la condition reste vraie pendant la durée
          demandée, l'action est déclenchée, puis un temps de repos s'applique avant le prochain
          déclenchement.
        </p>
        {rules.length === 0 ? (
          <Empty text="Aucune règle. Créez-en une pour réagir automatiquement aux seuils." />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>État</th>
                  <th>Nom</th>
                  <th>Condition</th>
                  <th>Action</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  let actionLabel: string
                  if (r.action.type === 'notify') {
                    actionLabel = `Notification — ${r.action.title}`
                  } else {
                    const macroId = r.action.macroId
                    actionLabel = `Macro — ${macros.find((m) => m.id === macroId)?.label ?? macroId}`
                  }
                  return (
                  <tr key={r.id}>
                    <td>
                      <Badge kind={r.enabled ? 'ok' : 'muted'}>{r.enabled ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td>{r.name}</td>
                    <td className="muted">{describe(r)}</td>
                    <td>{actionLabel}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => void toggle(r)}>
                        {r.enabled ? 'Désactiver' : 'Activer'}
                      </button>{' '}
                      <button
                        className="btn sm"
                        onClick={() => {
                          setDraft(JSON.parse(JSON.stringify(r)) as Rule)
                        }}
                      >
                        Modifier
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => void del(r)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {draft && (
        <Modal title={rules.some((r) => r.id === draft.id) ? 'Modifier la règle' : 'Nouvelle règle'} onClose={() => setDraft(null)} wide>
          <div className="form-grid">
            <div className="field">
              Nom
              <input
                className="input"
                value={draft.name}
                maxLength={80}
                placeholder="p. ex. CPU saturé"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="field">
              Métrique
              <select
                className="select"
                value={draft.metric}
                onChange={(e) => setDraft({ ...draft, metric: e.target.value, target: undefined })}
              >
                {METRIC_DEFS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                    {m.unit ? ` (${m.unit})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {def?.needsTarget && (
              <div className="field">
                Point de montage
                <input
                  className="input"
                  list="rule-mounts"
                  value={draft.target ?? ''}
                  placeholder="/"
                  onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                />
                <datalist id="rule-mounts">
                  {(snapshot?.fs ?? []).map((f) => (
                    <option key={f.mount} value={f.mount} />
                  ))}
                </datalist>
              </div>
            )}
            <div className="field">
              Opérateur
              <select
                className="select"
                value={draft.op}
                onChange={(e) => setDraft({ ...draft, op: e.target.value as Rule['op'] })}
              >
                {COMPARE_OPS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              Seuil
              <input
                className="input"
                type="number"
                value={draft.threshold}
                onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              Durée avant déclenchement (s)
              <input
                className="input"
                type="number"
                min={0}
                max={86400}
                value={draft.durationSec}
                onChange={(e) => setDraft({ ...draft, durationSec: Math.round(Number(e.target.value)) })}
              />
            </div>
            <div className="field">
              Repos après déclenchement (s)
              <input
                className="input"
                type="number"
                min={0}
                max={86400}
                value={draft.cooldownSec}
                onChange={(e) => setDraft({ ...draft, cooldownSec: Math.round(Number(e.target.value)) })}
              />
            </div>
            <div className="field">
              Type d'action
              <select
                className="select"
                value={draft.action.type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    action:
                      e.target.value === 'notify'
                        ? { type: 'notify', title: draft.name || 'Seuil dépassé' }
                        : { type: 'macro', macroId: macros[0]?.id ?? '' }
                  })
                }
              >
                <option value="notify">Notification</option>
                <option value="macro">Exécuter une macro</option>
              </select>
            </div>
            {draft.action.type === 'notify' ? (
              <div className="field">
                Titre de notification
                <input
                  className="input"
                  value={draft.action.title}
                  maxLength={80}
                  onChange={(e) => setDraft({ ...draft, action: { type: 'notify', title: e.target.value } })}
                />
              </div>
            ) : (
              <div className="field">
                Macro à exécuter
                <select
                  className="select"
                  value={(draft.action as { macroId: string }).macroId}
                  onChange={(e) => setDraft({ ...draft, action: { type: 'macro', macroId: e.target.value } })}
                >
                  <option value="">— Choisir —</option>
                  {macros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {draft.action.type === 'macro' && macros.length === 0 && (
            <p className="hint" style={{ color: 'var(--orange)' }}>
              Aucune macro définie — créez-en une dans la page Macros.
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setDraft(null)}>
              Annuler
            </button>
            <button className="btn primary" onClick={() => void save()}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
