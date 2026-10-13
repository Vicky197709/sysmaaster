import { useChannel } from '../hooks'
import type { GpuInfo } from '@shared/types'
import { useApp } from '../store'
import { Gauge } from '../components/charts'
import { Empty, fmtBytes, Panel } from '../components/ui'

export default function Sensors() {
  const snapshot = useApp((s) => s.snapshot)
  const { data: sensors, loading, reload } = useChannel<string>('system:sensors')
  const gpus: GpuInfo[] = snapshot?.gpus ?? []

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-label">Température CPU</div>
          <div style={{ height: 116 }}>
            <Gauge
              value={snapshot?.cpu.temp ?? null}
              max={100}
              unit="°C"
              caption={snapshot?.cpu.brand ?? ''}
            />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Charge processeur</div>
          <div style={{ height: 116 }}>
            <Gauge value={snapshot?.cpu.load ?? null} max={100} unit="%" caption="Charge instantanée" />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Mémoire vive</div>
          <div style={{ height: 116 }}>
            <Gauge
              value={snapshot?.mem.usedPct ?? null}
              max={100}
              unit="%"
              caption={snapshot ? `${fmtBytes(snapshot.mem.used)} utilisés` : ''}
            />
          </div>
        </div>
      </div>

      <Panel
        title="Cartes graphiques"
        actions={null}
      >
        {gpus.length === 0 ? (
          <Empty text="Aucun GPU détecté (l'outil nvidia-smi n'est pas disponible sur cette machine)" />
        ) : (
          <div className="cards">
            {gpus.map((g, i) => (
              <div className="card" key={`${g.model}-${i}`} style={{ cursor: 'default' }}>
                <div className="card-kind">{g.vendor || 'GPU'}</div>
                <div className="card-title">{g.model}</div>
                <div className="card-desc">{g.vram !== null ? `${g.vram} Mo de VRAM` : 'VRAM inconnue'}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Capteurs (lm-sensors)"
        actions={
          <button className="btn sm" onClick={reload}>
            Rafraîchir
          </button>
        }
      >
        {loading && !sensors ? (
          <Empty text="Lecture de sensors…" />
        ) : sensors ? (
          <pre className="pre">{sensors}</pre>
        ) : (
          <Empty text="Aucune sortie de sensors (paquet lm-sensors absent ou non configuré)" />
        )}
      </Panel>
    </div>
  )
}
