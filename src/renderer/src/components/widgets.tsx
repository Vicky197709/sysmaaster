import type { DashboardWidget } from '@shared/types'
import { getMetric, getMetricDef } from '@shared/metrics'
import { getWidgetDef } from '@shared/widgets'
import { useApp } from '../store'
import { Bar, Empty, fmtUptime } from './ui'
import { Gauge, MetricLine } from './charts'

function formatValue(metric: string, v: number): string {
  if (metric === 'uptime') return fmtUptime(v)
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

export function WidgetView({ w }: { w: DashboardWidget }) {
  const def = getWidgetDef(w.defId)
  const snapshot = useApp((s) => s.snapshot)
  if (!def) return <Empty text="Widget inconnu" />

  if (def.kind === 'line' && def.metric) {
    return <MetricLine metricKey={def.metric} target={w.target} fill />
  }

  if (def.kind === 'gauge' && def.metric) {
    const mdef = getMetricDef(def.metric)
    const v = snapshot ? getMetric(snapshot, def.metric, w.target) : null
    return <Gauge value={v} max={mdef?.max ?? 100} unit={mdef?.unit ?? ''} caption={mdef?.label} />
  }

  if (def.kind === 'stat' && def.metric) {
    const mdef = getMetricDef(def.metric)
    const v = snapshot ? getMetric(snapshot, def.metric, w.target) : null
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div className="stat-big">{v !== null ? formatValue(def.metric, v) : '—'}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {mdef?.label}
          {mdef?.unit ? ` (${mdef.unit})` : ''}
        </div>
      </div>
    )
  }

  if (def.kind === 'top') {
    const list = (def.topSource === 'mem' ? snapshot?.procs.topMem : snapshot?.procs.topCpu) ?? []
    if (list.length === 0) return <Empty text="Collecte en cours…" />
    const valOf = (p: (typeof list)[number]): number => (def.topSource === 'mem' ? p.mem : p.cpu)
    const max = Math.max(1, ...list.map(valOf))
    return (
      <div className="top-list">
        {list.slice(0, 8).map((p) => (
          <div className="top-row" key={p.pid}>
            <span className="top-name" title={p.name}>
              {p.name}
            </span>
            <div className="top-bar">
              <Bar pct={(valOf(p) / max) * 100} />
            </div>
            <span className="top-val">{valOf(p)}%</span>
          </div>
        ))}
      </div>
    )
  }

  return <Empty text="Type de widget non pris en charge" />
}
