import { useState } from 'react'
import { useChannel } from '../hooks'
import type { ProcessInfo } from '@shared/types'
import { useApp } from '../store'
import { Modal } from '../components/overlays'
import { Badge, Empty, Panel } from '../components/ui'

export default function Processes() {
  const act = useApp((s) => s.act)
  const expertMode = useApp((s) => s.data?.settings.expertMode ?? false)
  const { data: procs, loading, reload } = useChannel<ProcessInfo[]>('system:processes', { intervalMs: 8000 })
  const [q, setQ] = useState('')
  const [reniceFor, setReniceFor] = useState<ProcessInfo | null>(null)
  const [nice, setNice] = useState(5)

  const list = procs ?? []
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.user.toLowerCase().includes(needle) ||
          String(p.pid).includes(needle)
      )
    : list

  const kill = (p: ProcessInfo, signal: 'SIGTERM' | 'SIGKILL') =>
    void act({
      channel: 'control:kill',
      payload: { pid: p.pid, signal },
      confirm: {
        title: 'Terminer le processus',
        message: `Envoyer ${signal} au PID ${p.pid} (${p.name}) ?\nLe processus sera arrêté immédiatement.`,
        danger: signal === 'SIGKILL'
      },
      success: `${signal} envoyé à ${p.name} (${p.pid})`
    }).then(() => reload())

  const doRenice = async () => {
    if (!reniceFor) return
    const ok = await act({
      channel: 'control:renice',
      payload: { pid: reniceFor.pid, nice },
      success: `Priorité de ${reniceFor.pid} définie à ${nice}`
    })
    if (ok) setReniceFor(null)
  }

  return (
    <div>
      <Panel
        title={`Processus — ${list.length}`}
        actions={
          <>
            <input
              className="input"
              style={{ width: 230 }}
              placeholder="Nom, utilisateur ou PID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn sm" onClick={reload}>
              Rafraîchir
            </button>
          </>
        }
      >
        {loading && !procs ? (
          <Empty text="Lecture de la table des processus…" />
        ) : filtered.length === 0 ? (
          <Empty text="Aucun processus correspondant" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">PID</th>
                  <th>Nom</th>
                  <th>Utilisateur</th>
                  <th>État</th>
                  <th className="num">CPU %</th>
                  <th className="num">RAM %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((p) => (
                  <tr key={p.pid}>
                    <td className="num mono">{p.pid}</td>
                    <td title={p.name}>{p.name}</td>
                    <td>{p.user}</td>
                    <td>
                      <Badge kind={p.state.includes('R') ? 'ok' : p.state.includes('Z') ? 'err' : 'muted'}>
                        {p.state}
                      </Badge>
                    </td>
                    <td className="num">{p.cpu}</td>
                    <td className="num">{p.mem}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn sm"
                        onClick={() => {
                          setNice(p.cpu >= 50 ? 10 : 5)
                          setReniceFor(p)
                        }}
                      >
                        Priorité
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => kill(p, 'SIGTERM')}>
                        Arrêter
                      </button>
                      {expertMode && (
                        <>
                          {' '}
                          <button className="btn sm danger" onClick={() => kill(p, 'SIGKILL')}>
                            Forcer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <div className="hint" style={{ padding: 10 }}>
                300 premiers processus affichés (triés par CPU côté système).
              </div>
            )}
          </div>
        )}
      </Panel>

      {reniceFor && (
        <Modal title={`Priorité — ${reniceFor.name} (PID ${reniceFor.pid})`} onClose={() => setReniceFor(null)}>
          <div className="field" style={{ marginBottom: 12 }}>
            Nice (-20 = priorité max, 19 = priorité min)
            <input
              className="input"
              type="number"
              min={-20}
              max={19}
              value={nice}
              onChange={(e) => setNice(Number(e.target.value))}
            />
          </div>
          {nice < 0 && (
            <p className="hint" style={{ color: 'var(--orange)' }}>
              Une priorité supérieure nécessite un privilège : Polkit vous en demandera la validation.
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setReniceFor(null)}>
              Annuler
            </button>
            <button className="btn primary" onClick={() => void doRenice()}>
              Appliquer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
