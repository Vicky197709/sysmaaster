import { useApp } from '../store'
import { CoreBars, MetricLine } from '../components/charts'
import { Bar, Empty, fmtBytes, fmtUptime, Panel } from '../components/ui'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function CpuMem() {
  const snapshot = useApp((s) => s.snapshot)
  if (!snapshot) return <Empty text="Collecte en cours…" />
  const { cpu, mem } = snapshot
  const swapPct = mem.swapTotal > 0 ? Math.round((mem.swapUsed / mem.swapTotal) * 100) : 0

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Charge CPU" value={`${cpu.load}%`} sub={`${cpu.cores.length} cœurs · ${cpu.freq.toFixed(0)} MHz`} />
        <Stat
          label="Mémoire utilisée"
          value={`${mem.usedPct}%`}
          sub={`${fmtBytes(mem.used)} / ${fmtBytes(mem.total)}`}
        />
        <Stat
          label="Mémoire disponible"
          value={fmtBytes(mem.available)}
          sub={`Cache ${fmtBytes(Math.max(0, mem.total - mem.used - mem.available))}`}
        />
        <Stat
          label="Température CPU"
          value={cpu.temp !== null ? `${cpu.temp.toFixed(1)} °C` : '—'}
          sub={cpu.brand}
        />
      </div>

      <div className="grid-2">
        <Panel title="Charge processeur">
          <div style={{ height: 150 }}>
            <MetricLine metricKey="cpu.load" label="Charge" unit="%" color="#3b82f6" height={150} />
          </div>
        </Panel>
        <Panel title="Mémoire vive">
          <div style={{ height: 150 }}>
            <MetricLine metricKey="mem.usedPct" label="Mémoire" unit="%" color="#22c55e" height={150} />
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Charge par cœur">
          <CoreBars cores={cpu.cores} />
        </Panel>
        <Panel title="Mémoire & swap">
          <div className="field" style={{ marginBottom: 12 }}>
            <span>
              RAM {mem.usedPct}% — {fmtBytes(mem.used)} / {fmtBytes(mem.total)}
            </span>
            <Bar pct={mem.usedPct} />
          </div>
          <div className="field">
            <span>
              Swap {swapPct}% — {fmtBytes(mem.swapUsed)} / {fmtBytes(mem.swapTotal)}
            </span>
            <Bar pct={swapPct} />
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            Uptime : {fmtUptime(snapshot.uptime)} · {snapshot.hostname}
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Top CPU">
          <div className="top-list">
            {snapshot.procs.topCpu.map((p) => (
              <div className="top-row" key={p.pid}>
                <span className="top-name" title={p.name}>
                  {p.pid} · {p.name}
                </span>
                <div className="top-bar">
                  <Bar pct={Math.min(100, p.cpu)} />
                </div>
                <span className="top-val">{p.cpu}%</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Top mémoire">
          <div className="top-list">
            {snapshot.procs.topMem.map((p) => (
              <div className="top-row" key={p.pid}>
                <span className="top-name" title={p.name}>
                  {p.pid} · {p.name}
                </span>
                <div className="top-bar">
                  <Bar pct={Math.min(100, p.mem)} />
                </div>
                <span className="top-val">{p.mem}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
