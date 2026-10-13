import { useState } from 'react'
import { useChannel } from '../hooks'
import type { DesktopApp } from '@shared/types'
import { useApp } from '../store'
import { Empty, Panel } from '../components/ui'

export default function Apps() {
  const act = useApp((s) => s.act)
  const { data: apps, loading } = useChannel<DesktopApp[]>('system:apps')
  const [q, setQ] = useState('')

  const list = apps ?? []
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? list.filter((a) => a.name.toLowerCase().includes(needle) || a.categories.toLowerCase().includes(needle))
    : list

  const launch = (a: DesktopApp) =>
    void act({
      channel: 'control:launch',
      payload: { file: a.file },
      confirm: { title: 'Lancer une application', message: `Lancer « ${a.name} » ?` },
      success: `${a.name} lancée`
    })

  return (
    <Panel
      title={`Applications installées — ${list.length}`}
      actions={
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Rechercher une application…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Seuls les fichiers .desktop des emplacements système et utilisateur autorisés sont lançables.
      </p>
      {loading && !apps ? (
        <Empty text="Lecture des fichiers .desktop…" />
      ) : filtered.length === 0 ? (
        <Empty text="Aucune application correspondante" />
      ) : (
        <div className="cards">
          {filtered.slice(0, 200).map((a) => (
            <div className="card" key={a.file} onClick={() => launch(a)}>
              <div className="card-title">{a.name}</div>
              <div className="card-desc mono" style={{ fontSize: 11.5 }}>
                {a.categories || 'Sans catégorie'}
              </div>
              <div className="card-desc" style={{ color: 'var(--accent)' }}>
                Cliquer pour lancer ▶
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
