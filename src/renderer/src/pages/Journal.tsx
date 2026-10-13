import { useMemo, useState } from 'react'
import { useChannel } from '../hooks'
import { Empty, Panel } from '../components/ui'

export default function Journal() {
  const { data: journal, loading, reload } = useChannel<string>('system:journal')
  const [q, setQ] = useState('')

  const lines = useMemo(() => {
    if (!journal) return []
    const all = journal.split('\n')
    const needle = q.trim().toLowerCase()
    return needle ? all.filter((l) => l.toLowerCase().includes(needle)) : all
  }, [journal, q])

  return (
    <div>
      <Panel
        title={`Journal système (journalctl) — ${lines.length} ligne(s)`}
        actions={
          <>
            <input
              className="input"
              style={{ width: 240 }}
              placeholder="Filtrer… (erreur, ssh, kernel)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn sm" onClick={reload}>
              Rafraîchir
            </button>
          </>
        }
      >
        {loading && !journal ? (
          <Empty text="Lecture du journal…" />
        ) : lines.length === 0 ? (
          <Empty text={q ? 'Aucune ligne correspondante' : 'Journal vide'} />
        ) : (
          <pre className="pre" style={{ maxHeight: '70vh' }}>
            {lines.slice(-400).join('\n')}
          </pre>
        )}
      </Panel>
    </div>
  )
}
