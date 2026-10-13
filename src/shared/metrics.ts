import type { Snapshot } from './types'

export interface MetricDef {
  key: string
  label: string
  unit: string
  min?: number
  max?: number
  needsTarget?: boolean
  targetLabel?: string
}

/** Catalogue des métriques exploitables par les widgets et le moteur de règles. */
export const METRIC_DEFS: MetricDef[] = [
  { key: 'cpu.load', label: 'Charge CPU', unit: '%', min: 0, max: 100 },
  { key: 'cpu.temp', label: 'Température CPU', unit: '°C', min: 0, max: 120 },
  { key: 'mem.usedPct', label: 'Mémoire utilisée', unit: '%', min: 0, max: 100 },
  { key: 'swap.usedPct', label: 'Swap utilisé', unit: '%', min: 0, max: 100 },
  { key: 'net.rxRate', label: 'Débit réseau entrant', unit: 'Ko/s', min: 0 },
  { key: 'net.txRate', label: 'Débit réseau sortant', unit: 'Ko/s', min: 0 },
  {
    key: 'fs.usedPct',
    label: 'Espace disque utilisé',
    unit: '%',
    min: 0,
    max: 100,
    needsTarget: true,
    targetLabel: 'Point de montage (p. ex. /)'
  },
  { key: 'procs.count', label: 'Processus en cours', unit: '', min: 0 },
  { key: 'uptime', label: 'Temps de fonctionnement', unit: 's', min: 0 }
]

export function getMetricDef(key: string): MetricDef | undefined {
  return METRIC_DEFS.find((m) => m.key === key)
}

/** Lit une métrique dans un instantané ; renvoie null si absente/inconnue. */
export function getMetric(s: Snapshot, key: string, target?: string): number | null {
  switch (key) {
    case 'cpu.load':
      return s.cpu.load
    case 'cpu.temp':
      return s.cpu.temp
    case 'mem.usedPct':
      return s.mem.usedPct
    case 'swap.usedPct':
      return s.mem.swapUsedPct
    case 'net.rxRate':
      return s.netRxTotal
    case 'net.txRate':
      return s.netTxTotal
    case 'fs.usedPct': {
      if (!target) return null
      const fs = s.fs.find((f) => f.mount === target)
      return fs ? fs.usePct : null
    }
    case 'procs.count':
      return s.procs.count
    case 'uptime':
      return s.uptime
    default:
      return null
  }
}
