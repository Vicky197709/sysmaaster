export type WidgetKind = 'stat' | 'gauge' | 'line' | 'top'

export interface WidgetDef {
  id: string
  kind: WidgetKind
  label: string
  description: string
  metric?: string
  topSource?: 'cpu' | 'mem'
  needsTarget?: boolean
  targetLabel?: string
  defaultTitle: string
  defaultW: number
  defaultH: number
}

/** Catalogue déclaratif : ajouter un widget à la galerie = ajouter une entrée ici. */
export const WIDGET_DEFS: WidgetDef[] = [
  { id: 'cpu-load', kind: 'line', label: 'Charge CPU', description: 'Courbe de charge processeur', metric: 'cpu.load', defaultTitle: 'Charge CPU', defaultW: 6, defaultH: 4 },
  { id: 'cpu-gauge', kind: 'gauge', label: 'CPU jauge', description: 'Jauge de charge processeur', metric: 'cpu.load', defaultTitle: 'CPU', defaultW: 3, defaultH: 4 },
  { id: 'cpu-temp', kind: 'stat', label: 'Température CPU', description: 'Température actuelle du processeur', metric: 'cpu.temp', defaultTitle: 'Température', defaultW: 3, defaultH: 4 },
  { id: 'mem-gauge', kind: 'gauge', label: 'Mémoire jauge', description: 'Jauge de mémoire vive', metric: 'mem.usedPct', defaultTitle: 'Mémoire', defaultW: 3, defaultH: 4 },
  { id: 'mem-line', kind: 'line', label: 'Mémoire', description: 'Courbe d\'utilisation mémoire', metric: 'mem.usedPct', defaultTitle: 'Mémoire vive', defaultW: 6, defaultH: 4 },
  { id: 'swap-stat', kind: 'stat', label: 'Swap', description: 'Swap utilisé', metric: 'swap.usedPct', defaultTitle: 'Swap', defaultW: 3, defaultH: 4 },
  { id: 'net-rx', kind: 'line', label: 'Réseau entrant', description: 'Courbe de débit réception', metric: 'net.rxRate', defaultTitle: 'Réseau ↑ entrant', defaultW: 6, defaultH: 4 },
  { id: 'net-tx', kind: 'line', label: 'Réseau sortant', description: 'Courbe de débit émission', metric: 'net.txRate', defaultTitle: 'Réseau ↓ sortant', defaultW: 6, defaultH: 4 },
  { id: 'net-rx-stat', kind: 'stat', label: 'Débit entrant', description: 'Débit réseau actuel', metric: 'net.rxRate', defaultTitle: 'Débit entrant', defaultW: 3, defaultH: 4 },
  { id: 'fs-usage', kind: 'gauge', label: 'Disque', description: 'Espace utilisé d\'un point de montage', metric: 'fs.usedPct', needsTarget: true, targetLabel: 'Point de montage (p. ex. /)', defaultTitle: 'Disque', defaultW: 3, defaultH: 4 },
  { id: 'uptime', kind: 'stat', label: 'Uptime', description: 'Temps de fonctionnement', metric: 'uptime', defaultTitle: 'Uptime', defaultW: 3, defaultH: 4 },
  { id: 'procs-count', kind: 'stat', label: 'Processus', description: 'Nombre de processus actifs', metric: 'procs.count', defaultTitle: 'Processus', defaultW: 3, defaultH: 4 },
  { id: 'top-cpu', kind: 'top', label: 'Top CPU', description: 'Processus les plus gourmands en CPU', topSource: 'cpu', defaultTitle: 'Top processus CPU', defaultW: 4, defaultH: 5 },
  { id: 'top-mem', kind: 'top', label: 'Top mémoire', description: 'Processus les plus gourmands en mémoire', topSource: 'mem', defaultTitle: 'Top processus mémoire', defaultW: 4, defaultH: 5 }
]

export function getWidgetDef(defId: string): WidgetDef | undefined {
  return WIDGET_DEFS.find((d) => d.id === defId)
}

const GRID_COLS = 12

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Crée un widget placé au-dessus du bloc existant le plus bas (grille 12 colonnes). */
export function createWidget(
  defId: string,
  existing: { x: number; y: number; w: number; h: number }[],
  opts?: { title?: string; target?: string }
): { id: string; defId: string; title: string; target?: string; x: number; y: number; w: number; h: number } {
  const def = getWidgetDef(defId)
  if (!def) throw new Error(`Widget inconnu : ${defId}`)
  const w = Math.min(def.defaultW, GRID_COLS)
  const bottom = existing.reduce((m, it) => Math.max(m, it.y + it.h), 0)
  const widget: ReturnType<typeof createWidget> = {
    id: `${defId}-${randSuffix()}`,
    defId,
    title: opts?.title?.trim() || def.defaultTitle,
    x: 0,
    y: bottom,
    w,
    h: def.defaultH
  }
  if (def.needsTarget && opts?.target) widget.target = opts.target
  return widget
}

export function validateWidget(w: { defId: string; title: string; target?: string; w: number; h: number }): string[] {
  const errors: string[] = []
  const def = getWidgetDef(w.defId)
  if (!def) errors.push(`Widget inconnu : ${w.defId}`)
  if (!w.title || !w.title.trim()) errors.push('Le titre du widget est obligatoire')
  if (def?.needsTarget && !w.target?.trim()) errors.push('Ce widget exige une cible (point de montage)')
  if (w.target && w.target.includes('..')) errors.push('Cible invalide')
  if (!Number.isFinite(w.w) || w.w < 1 || w.w > GRID_COLS) errors.push('Largeur de widget invalide')
  if (!Number.isFinite(w.h) || w.h < 1 || w.h > 24) errors.push('Hauteur de widget invalide')
  return errors
}
