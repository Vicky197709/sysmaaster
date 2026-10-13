import { useState } from 'react'
import { useChannel } from '../hooks'
import type { ServiceInfo, ServiceOp } from '@shared/types'
import { useApp } from '../store'
import { Badge, Empty, Panel } from '../components/ui'

const OPS: ServiceOp[] = ['start', 'stop', 'restart', 'enable', 'disable']
const OP_LABEL: Record<ServiceOp, string> = {
  start: 'Démarrer',
  stop: 'Arrêter',
  restart: 'Redémarrer',
  enable: 'Activer',
  disable: 'Désactiver'
}

export default function Services() {
  const act = useApp((s) => s.act)
  const { data: services, loading, reload } = useChannel<ServiceInfo[]>('system:services', {
    intervalMs: 15000
  })
  const [q, setQ] = useState('')

  const list = services ?? []
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? list.filter((s) => s.unit.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle))
    : list

  const op = (s: ServiceInfo, o: ServiceOp) =>
    void act({
      channel: 'control:service',
      payload: { op: o, unit: s.unit },
      confirm: {
        title: `${OP_LABEL[o]} le service`,
        message: `${OP_LABEL[o]} ${s.unit} ?`,
        danger: o === 'stop' || o === 'disable'
      },
      success: `${s.unit} : ${OP_LABEL[o]} effectué`
    }).then(() => reload())

  return (
    <Panel
      title={`Services systemd — ${list.length}`}
      actions={
        <>
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Rechercher un service…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn sm" onClick={reload}>
            Rafraîchir
          </button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Les actions passent par Polkit : une fenêtre d'authentification peut apparaître.
      </p>
      {loading && !services ? (
        <Empty text="Lecture de systemctl…" />
      ) : filtered.length === 0 ? (
        <Empty text="Aucun service correspondant" />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Unité</th>
                <th>État</th>
                <th>Sous-état</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((s) => (
                <tr key={s.unit}>
                  <td className="mono">{s.unit}</td>
                  <td>
                    <Badge kind={s.active === 'active' ? 'ok' : s.active === 'failed' ? 'err' : 'muted'}>
                      {s.active}
                    </Badge>
                  </td>
                  <td className="muted">{s.sub}</td>
                  <td className="muted">{s.description}</td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {OPS.map((o, i) => (
                      <span key={o}>
                        {i > 0 && ' '}
                        <button
                          className={`btn sm${o === 'stop' ? ' danger' : ''}`}
                          disabled={(o === 'start' && s.active === 'active') || (o === 'stop' && s.active !== 'active')}
                          onClick={() => op(s, o)}
                        >
                          {OP_LABEL[o]}
                        </button>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
