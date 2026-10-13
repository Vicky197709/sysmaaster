import type { ReactNode } from 'react'

export function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b < 0) return '—'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : 1)} ${units[i]}`
}

export function fmtRate(koPerSec: number): string {
  if (!Number.isFinite(koPerSec) || koPerSec < 0) return '—'
  if (koPerSec >= 1024) return `${(koPerSec / 1024).toFixed(1)} Mo/s`
  return `${Math.round(koPerSec)} Ko/s`
}

export function fmtUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d} j ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min ${Math.floor(sec % 60)} s`
}

export function loadClass(pct: number): string {
  if (pct >= 85) return 'crit'
  if (pct >= 70) return 'warn'
  return ''
}

export function barColor(pct: number): string {
  if (pct >= 85) return 'var(--red)'
  if (pct >= 70) return 'var(--orange)'
  return 'var(--accent)'
}

export function Panel({
  title,
  actions,
  children
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Bar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className="bar">
      <i style={{ width: `${p}%`, background: barColor(p) }} />
    </div>
  )
}

export function Badge({ kind, children }: { kind: 'ok' | 'warn' | 'err' | 'muted'; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function ErrorNote({ msg }: { msg: string }) {
  return <div className="error-note">{msg}</div>
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}
