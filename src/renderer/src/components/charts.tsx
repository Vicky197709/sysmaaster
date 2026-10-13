import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getMetric, getMetricDef } from '@shared/metrics'
import { useApp } from '../store'
import { barColor, Empty } from './ui'

interface MetricLineProps {
  metricKey: string
  target?: string
  label?: string
  unit?: string
  color?: string
  height?: number
  fill?: boolean
}

export function MetricLine({
  metricKey,
  target,
  label,
  unit,
  color = '#3b82f6',
  height = 160,
  fill = false
}: MetricLineProps) {
  const history = useApp((s) => s.history)
  const def = getMetricDef(metricKey)
  const data = history.map((s) => ({ t: s.ts, v: getMetric(s, metricKey, target) }))
  if (data.length < 2) return <Empty text="Collecte des données en cours…" />
  return (
    <div style={{ width: '100%', height: fill ? '100%' : height, minHeight: fill ? 80 : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="#1c2536" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={(t: number) =>
              new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
            tick={{ fill: '#5c6a84', fontSize: 10 }}
            minTickGap={45}
          />
          <YAxis tick={{ fill: '#5c6a84', fontSize: 10 }} width={50} />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString('fr-FR')}
            formatter={(value) => [`${value} ${unit ?? def?.unit ?? ''}`, label ?? def?.label ?? metricKey]}
            contentStyle={{ background: '#111827', border: '1px solid #26324a', borderRadius: 8, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Jauge demi-circulaire (SVG) pour les valeurs 0 → max. */
export function Gauge({
  value,
  max = 100,
  unit = '%',
  caption
}: {
  value: number | null
  max?: number
  unit?: string
  caption?: string
}) {
  if (value === null || !Number.isFinite(value)) return <Empty text="Donnée indisponible" />
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  const color = barColor(pct * 100)
  const arcLen = 270 // π × 86
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 2
      }}
    >
      <svg viewBox="0 0 200 116" style={{ width: '100%', maxWidth: 230 }}>
        <path d="M 14 100 A 86 86 0 0 1 186 100" fill="none" stroke="#1c2536" strokeWidth="13" strokeLinecap="round" />
        <path
          d="M 14 100 A 86 86 0 0 1 186 100"
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${(pct * arcLen).toFixed(1)} ${arcLen}`}
        />
        <text x="100" y="88" textAnchor="middle" fill="#e6edf7" fontSize="30" fontWeight="800">
          {Math.round(value * 10) / 10}
          <tspan fontSize="15" fontWeight="600">
            {unit}
          </tspan>
        </text>
      </svg>
      {caption && <div className="muted" style={{ fontSize: 12 }}>{caption}</div>}
    </div>
  )
}

export function CoreBars({ cores }: { cores: number[] }) {
  if (cores.length === 0) return <Empty text="Aucun cœur détecté" />
  return (
    <div className="core-grid">
      {cores.map((c, i) => (
        <div className="core" key={i}>
          <div className="core-val" style={{ color: barColor(c) }}>
            {Math.round(c)}%
          </div>
          <div className="core-lab">Cœur {i}</div>
        </div>
      ))}
    </div>
  )
}
