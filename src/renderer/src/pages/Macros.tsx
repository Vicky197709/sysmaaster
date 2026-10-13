import { useState } from 'react'
import { useChannel } from '../hooks'
import type { DesktopApp, Macro, MacroAction, ServiceOp } from '@shared/types'
import { useApp } from '../store'
import { Modal } from '../components/overlays'
import { Badge, Empty, Panel } from '../components/ui'

function newId(): string {
  return `mac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultAction(): MacroAction {
  return { type: 'service', op: 'restart', unit: '' }
}

function describe(a: MacroAction): string {
  switch (a.type) {
    case 'shell':
      return `${a.needsRoot ? '[root] ' : ''}${a.cmd}`
    case 'service':
      return `systemctl ${a.op} ${a.unit}`
    case 'desktop':
      return a.file
    case 'kill':
      return `kill -TERM ${a.pid}`
    default:
      return '?'
  }
}

export default function Macros() {
  const data = useApp((s) => s.data)
  const act = useApp((s) => s.act)
  const askConfirm = useApp((s) => s.askConfirm)
  const toast = useApp((s) => s.toast)
  const expertMode = data?.settings.expertMode ?? false
  const macros = data?.macros ?? []

  const { data: apps } = useChannel<DesktopApp[]>('system:apps')
  const [draft, setDraft] = useState<Macro | null>(null)

  const save = async () => {
    if (!draft) return
    if (!draft.label.trim()) return toast('Libellé obligatoire', 'error')
    const a = draft.action
    if (a.type === 'shell' && !a.cmd.trim()) return toast('Commande vide', 'error')
    if (a.type === 'shell' && !expertMode)
      return toast('Le mode expert est requis pour les commandes shell', 'error')
    if (a.type === 'service' && !a.unit.trim()) return toast('Unité systemd obligatoire', 'error')
    if (a.type === 'desktop' && !a.file) return toast('Application obligatoire', 'error')
    if (a.type === 'kill' && (!Number.isInteger(a.pid) || a.pid <= 0)) return toast('PID invalide', 'error')
    const ok = await act({
      channel: 'store:update',
      payload: { kind: 'macros', op: 'save', data: draft },
      success: 'Macro enregistrée'
    })
    if (ok) setDraft(null)
  }

  const del = async (m: Macro) => {
    const ok = await askConfirm('Supprimer la macro', `Supprimer « ${m.label} » ?`, true)
    if (!ok) return
    await act({
      channel: 'store:update',
      payload: { kind: 'macros', op: 'delete', id: m.id },
      success: 'Macro supprimée'
    })
  }

  const run = (m: Macro) =>
    void act({
      channel: 'control:macro',
      payload: { macroId: m.id },
      confirm: {
        title: 'Exécuter la macro',
        message: `Lancer « ${m.label} » ?\n${describe(m.action)}`,
        danger: m.action.type === 'kill' || (m.action.type === 'shell' && m.action.needsRoot)
      },
      success: `Macro « ${m.label} » exécutée`
    })

  const setAction = (a: MacroAction) => draft && setDraft({ ...draft, action: a })

  return (
    <div>
      <Panel
        title={`Macros — ${macros.length}`}
        actions={
          <button
            className="btn primary sm"
            onClick={() => setDraft({ id: newId(), label: '', action: defaultAction() })}
          >
            + Nouvelle macro
          </button>
        }
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Une macro enchaîne une action (service, application, processus ou commande). Elle peut être
          lancée à la main ici ou déclenchée par une règle automatique.
        </p>
        {macros.length === 0 ? (
          <Empty text="Aucune macro. Créez-en une pour automatiser une action récurrente." />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Action</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {macros.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.label}</strong>
                      {m.action.type === 'shell' && m.action.needsRoot && (
                        <>
                          {' '}
                          <Badge kind="warn">root</Badge>
                        </>
                      )}
                    </td>
                    <td className="mono muted">{describe(m.action)}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm primary" onClick={() => run(m)}>
                        ▶ Exécuter
                      </button>{' '}
                      <button
                        className="btn sm"
                        onClick={() => {
                          setDraft(JSON.parse(JSON.stringify(m)) as Macro)
                        }}
                      >
                        Modifier
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => void del(m)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {draft && (
        <Modal
          title={macros.some((m) => m.id === draft.id) ? 'Modifier la macro' : 'Nouvelle macro'}
          onClose={() => setDraft(null)}
          wide
        >
          <div className="form-grid">
            <div className="field">
              Libellé
              <input
                className="input"
                value={draft.label}
                maxLength={40}
                placeholder="p. ex. Redémarrer Nginx"
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div className="field">
              Type d'action
              <select
                className="select"
                value={draft.action.type}
                onChange={(e) => {
                  const t = e.target.value
                  if (t === 'service') setAction({ type: 'service', op: 'restart', unit: '' })
                  else if (t === 'desktop') setAction({ type: 'desktop', file: apps?.[0]?.file ?? '' })
                  else if (t === 'kill') setAction({ type: 'kill', pid: 1 })
                  else setAction({ type: 'shell', cmd: '', needsRoot: false })
                }}
              >
                <option value="service">Service systemd</option>
                <option value="desktop">Lancer une application</option>
                <option value="kill">Tuer un processus</option>
                <option value="shell" disabled={!expertMode}>
                  Commande shell {!expertMode ? '(mode expert requis)' : ''}
                </option>
              </select>
            </div>

            {draft.action.type === 'service' && (
              <>
                <div className="field">
                  Opération
                  <select
                    className="select"
                    value={draft.action.op}
                    onChange={(e) =>
                      setAction({ ...draft.action, op: e.target.value as ServiceOp } as MacroAction)
                    }
                  >
                    {(['start', 'stop', 'restart', 'enable', 'disable'] as const).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  Unité
                  <input
                    className="input mono"
                    value={draft.action.unit}
                    placeholder="nginx.service"
                    onChange={(e) => setAction({ ...draft.action, unit: e.target.value } as MacroAction)}
                  />
                </div>
              </>
            )}

            {draft.action.type === 'desktop' && (
              <div className="field">
                Application
                <select
                  className="select"
                  value={draft.action.file}
                  onChange={(e) => setAction({ ...draft.action, file: e.target.value } as MacroAction)}
                >
                  <option value="">— Choisir —</option>
                  {(apps ?? []).map((a) => (
                    <option key={a.file} value={a.file}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {draft.action.type === 'kill' && (
              <div className="field">
                PID
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={draft.action.pid}
                  onChange={(e) =>
                    setAction({ ...draft.action, pid: Number(e.target.value) } as MacroAction)
                  }
                />
              </div>
            )}

            {draft.action.type === 'shell' && (
              <>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  Commande
                  <textarea
                    className="textarea"
                    rows={3}
                    value={draft.action.cmd}
                    placeholder="df -h / && echo OK"
                    onChange={(e) => setAction({ ...draft.action, cmd: e.target.value } as MacroAction)}
                  />
                </div>
                <div className="field">
                  Privilèges
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={draft.action.needsRoot}
                      onChange={(e) =>
                        setAction({ ...draft.action, needsRoot: e.target.checked } as MacroAction)
                      }
                    />
                    Exécuter via Polkit (root)
                  </label>
                </div>
              </>
            )}
          </div>
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
