import { useChannel } from '../hooks'
import type { LocalUser, SessionInfo } from '@shared/types'
import { Empty, Panel } from '../components/ui'

interface UsersData {
  sessions: SessionInfo[]
  localUsers: LocalUser[]
}

export default function Users() {
  const { data, loading, reload } = useChannel<UsersData>('system:users')

  return (
    <div>
      <Panel
        title="Sessions actives"
        actions={
          <button className="btn sm" onClick={reload}>
            Rafraîchir
          </button>
        }
      >
        {loading && !data ? (
          <Empty text="Lecture des sessions…" />
        ) : !data || data.sessions.length === 0 ? (
          <Empty text="Aucune session détectée" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Tty</th>
                  <th>Origine</th>
                  <th>Depuis</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s, i) => (
                  <tr key={`${s.user}-${s.tty}-${i}`}>
                    <td>
                      <strong>{s.user}</strong>
                    </td>
                    <td className="mono">{s.tty}</td>
                    <td className="mono">{s.from}</td>
                    <td className="muted">{s.since || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Comptes locaux — ${data ? data.localUsers.length : '…'}`}>
        {!data || data.localUsers.length === 0 ? (
          <Empty text="Aucun compte local (uid ≥ 1000)" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th className="num">UID</th>
                  <th>Shell</th>
                  <th>Dossier</th>
                </tr>
              </thead>
              <tbody>
                {data.localUsers.map((u) => (
                  <tr key={u.name}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td className="num mono">{u.uid}</td>
                    <td className="mono muted">{u.shell}</td>
                    <td className="mono muted">{u.home}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          Liste en lecture seule — toute gestion de compte passe par les outils système.
        </p>
      </Panel>
    </div>
  )
}
