import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { Badge, Empty, Panel } from '../components/ui'

type Status = 'tous' | 'ok' | 'erreur' | 'refusé'

export default function Audit() {
  const audit = useApp((s) => s.audit)
  const loadAudit = useApp((s) => s.loadAudit)
  const [status, setStatus] = useState<Status>('tous')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...audit]
      .reverse()
      .filter((e) => (status === 'tous' ? true : e.status === status))
      .filter(
        (e) =>
          !needle ||
          e.action.toLowerCase().includes(needle) ||
          e.target.toLowerCase().includes(needle) ||
          (e.detail ?? '').toLowerCase().includes(needle)
      )
  }, [audit, status, q])

  const counts = useMemo(
    () => ({
      ok: audit.filter((e) => e.status === 'ok').length,
      erreur: audit.filter((e) => e.status === 'erreur').length,
      refusé: audit.filter((e) => e.status === 'refusé').length
    }),
    [audit]
  )

  return (
    <Panel
      title={`Journal d'audit — ${audit.length} entrée(s)`}
      actions={
        <>
          <input
            className="input"
            style={{ width: 220 }}
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="tous">Tous</option>
            <option value="ok">Réussis ({counts.ok})</option>
            <option value="erreur">Erreurs ({counts.erreur})</option>
            <option value="refusé">Refusés ({counts.refusé})</option>
          </select>
          <button className="btn sm" onClick={() => void loadAudit()}>
            Rafraîchir
          </button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Journal append-only (500 entrées maximum) : chaque action de contrôle est tracée avec son
        horodatage et son issue.
      </p>
      {rows.length === 0 ? (
        <Empty text="Aucune entrée" />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Action</th>
                <th>Cible</th>
                <th>Statut</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={`${e.ts}-${i}`}>
                  <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(e.ts).toLocaleString('fr-FR')}
                  </td>
                  <td>{e.action}</td>
                  <td className="mono" title={e.target}>
                    {e.target.length > 60 ? `${e.target.slice(0, 60)}…` : e.target}
                  </td>
                  <td>
                    <Badge kind={e.status === 'ok' ? 'ok' : e.status === 'erreur' ? 'err' : 'warn'}>
                      {e.status}
                    </Badge>
                  </td>
                  <td className="muted" title={e.detail}>
                    {e.detail ? (e.detail.length > 70 ? `${e.detail.slice(0, 70)}…` : e.detail) : '—'}
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
