import { useState } from 'react'
import { useChannel } from '../hooks'
import type { ConnInfo } from '@shared/types'
import { useApp } from '../store'
import { Badge, Empty, fmtRate, Panel } from '../components/ui'

type ToolResult = { output: string }

export default function Network() {
  const snapshot = useApp((s) => s.snapshot)
  const call = useApp((s) => s.call)
  const [host, setHost] = useState('')
  const [domain, setDomain] = useState('')
  const [pingOut, setPingOut] = useState('')
  const [digOut, setDigOut] = useState('')
  const [busy, setBusy] = useState<'ping' | 'dig' | null>(null)

  const { data: conns, loading, reload } = useChannel<ConnInfo[]>('system:connections', { intervalMs: 10000 })
  const { data: ufw } = useChannel<string>('system:ufw')

  const doPing = async () => {
    if (!host.trim()) return
    setBusy('ping')
    setPingOut('…')
    const r = await call<ToolResult>('net:ping', { host: host.trim() })
    setPingOut(r?.output ?? '')
    setBusy(null)
  }

  const doDig = async () => {
    if (!domain.trim()) return
    setBusy('dig')
    setDigOut('…')
    const r = await call<ToolResult>('net:dig', { name: domain.trim() })
    setDigOut(r?.output ?? '')
    setBusy(null)
  }

  return (
    <div>
      <Panel title="Interfaces réseau">
        {!snapshot || snapshot.net.length === 0 ? (
          <Empty text="Aucune interface détectée" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Interface</th>
                  <th>Adresse IP</th>
                  <th className="num">Réception</th>
                  <th className="num">Émission</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.net.map((n) => (
                  <tr key={n.iface}>
                    <td className="mono">{n.iface}</td>
                    <td className="mono">{n.ip || '—'}</td>
                    <td className="num">{fmtRate(n.rxRate)}</td>
                    <td className="num">{fmtRate(n.txRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="Test de connectivité (ping)">
          <div className="form-row" style={{ marginBottom: 10 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="8.8.8.8 ou example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doPing()}
            />
            <button className="btn primary" disabled={busy !== null || !host.trim()} onClick={() => void doPing()}>
              {busy === 'ping' ? '…' : 'Ping'}
            </button>
          </div>
          {pingOut ? <pre className="pre">{pingOut}</pre> : <div className="hint">4 paquets ICMP, délai 2 s.</div>}
        </Panel>

        <Panel title="Résolution DNS">
          <div className="form-row" style={{ marginBottom: 10 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doDig()}
            />
            <button className="btn primary" disabled={busy !== null || !domain.trim()} onClick={() => void doDig()}>
              {busy === 'dig' ? '…' : 'Interroger'}
            </button>
          </div>
          {digOut ? <pre className="pre">{digOut}</pre> : <div className="hint">Requête A via dig +short.</div>}
        </Panel>
      </div>

      <Panel
        title={`Connexions actives — ${conns ? conns.length : '…'}`}
        actions={
          <button className="btn sm" onClick={reload}>
            Rafraîchir
          </button>
        }
      >
        {loading && !conns ? (
          <Empty text="Lecture de ss…" />
        ) : !conns || conns.length === 0 ? (
          <Empty text="Aucune connexion" />
        ) : (
          <div className="tbl-wrap" style={{ maxHeight: 320 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Protocole</th>
                  <th>État</th>
                  <th>Local</th>
                  <th>Distal</th>
                  <th>Processus</th>
                </tr>
              </thead>
              <tbody>
                {conns.map((c, i) => (
                  <tr key={`${c.local}-${c.peer}-${i}`}>
                    <td className="mono">{c.proto}</td>
                    <td>
                      <Badge kind={c.state === 'LISTEN' ? 'muted' : 'ok'}>{c.state}</Badge>
                    </td>
                    <td className="mono">{c.local}</td>
                    <td className="mono">{c.peer}</td>
                    <td className="mono">{c.process}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Pare-feu (ufw)">
        {ufw ? <pre className="pre">{ufw}</pre> : <div className="hint">ufw indisponible ou inactif.</div>}
      </Panel>
    </div>
  )
}
