import { useState } from 'react'
import { useChannel } from '../hooks'
import type { PkgInfo } from '@shared/types'
import { useApp } from '../store'
import { Bar, Badge, Empty, fmtBytes, Panel } from '../components/ui'

export default function Storage() {
  const snapshot = useApp((s) => s.snapshot)
  const act = useApp((s) => s.act)
  const [q, setQ] = useState('')
  const { data: pkgs, loading } = useChannel<PkgInfo[]>('system:packages')

  const fsList = snapshot?.fs ?? []
  const filtered = (pkgs ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))

  const mountOp = (op: 'mount' | 'unmount', device: string, mount: string) =>
    void act({
      channel: 'control:mount',
      payload: { op, device },
      confirm: {
        title: op === 'mount' ? 'Monter le périphérique' : 'Démonter le point de montage',
        message:
          op === 'mount'
            ? `Monter ${device} ?`
            : `Démonter ${mount} ? Les données ouvertes sur ce point seront fermées.`,
        danger: op === 'unmount'
      },
      success: op === 'mount' ? `${device} monté` : `${mount} démonté`
    })

  return (
    <div>
      <Panel title="Systèmes de fichiers">
        {fsList.length === 0 ? (
          <Empty text="Aucune information de disque" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Périphérique</th>
                  <th>Montage</th>
                  <th>Type</th>
                  <th className="num">Taille</th>
                  <th className="num">Utilisé</th>
                  <th className="num">Libre</th>
                  <th>Occupation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fsList.map((f) => (
                  <tr key={f.mount}>
                    <td className="mono">{f.fs}</td>
                    <td className="mono">{f.mount}</td>
                    <td>
                      <Badge kind="muted">{f.type}</Badge>
                    </td>
                    <td className="num">{fmtBytes(f.size)}</td>
                    <td className="num">{fmtBytes(f.used)}</td>
                    <td className="num">{fmtBytes(f.available)}</td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Bar pct={f.usePct} />
                        <span className="num" style={{ width: 38 }}>
                          {f.usePct}%
                        </span>
                      </div>
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      {f.fs.startsWith('/dev/') && (
                        <>
                          <button className="btn sm" disabled={f.usePct > 0 && f.mount === '/'} onClick={() => mountOp('mount', f.fs, f.mount)}>
                            Monter
                          </button>{' '}
                          <button
                            className="btn sm danger"
                            disabled={f.mount === '/'}
                            onClick={() => mountOp('unmount', f.fs, f.mount)}
                          >
                            Démonter
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Paquets installés — ${pkgs ? `${filtered.length} / ${pkgs.length}` : '…'}`}
        actions={
          <input
            className="input"
            style={{ width: 220 }}
            placeholder="Rechercher un paquet…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        {loading && !pkgs ? (
          <Empty text="Lecture de dpkg…" />
        ) : filtered.length === 0 ? (
          <Empty text="Aucun paquet correspondant" />
        ) : (
          <div className="tbl-wrap" style={{ maxHeight: 340 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Paquet</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((p) => (
                  <tr key={p.name}>
                    <td className="mono">{p.name}</td>
                    <td className="mono muted">{p.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <div className="hint" style={{ padding: 10 }}>
                300 premiers résultats affichés.
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
