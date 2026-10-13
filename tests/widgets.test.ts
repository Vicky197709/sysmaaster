import { describe, expect, it } from 'vitest'
import { WIDGET_DEFS, createWidget, getWidgetDef, validateWidget } from '../src/shared/widgets'

describe('catalogue de widgets', () => {
  it('contient des identifiants uniques', () => {
    const ids = WIDGET_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(10)
  })

  it('chaque définition est cohérente', () => {
    for (const def of WIDGET_DEFS) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.defaultTitle.length).toBeGreaterThan(0)
      expect(def.defaultW).toBeGreaterThanOrEqual(1)
      expect(def.defaultW).toBeLessThanOrEqual(12)
      expect(def.defaultH).toBeGreaterThanOrEqual(1)
      if (def.kind === 'top') expect(['cpu', 'mem']).toContain(def.topSource)
      else expect(def.metric).toBeTruthy()
    }
  })

  it('getWidgetDef', () => {
    expect(getWidgetDef('cpu-load')?.kind).toBe('line')
    expect(getWidgetDef('inconnu')).toBeUndefined()
  })
})

describe('createWidget', () => {
  it('crée un widget avec le titre par défaut', () => {
    const w = createWidget('cpu-gauge', [])
    expect(w.defId).toBe('cpu-gauge')
    expect(w.title).toBe('CPU')
    expect(w.x).toBe(0)
    expect(w.y).toBe(0)
    expect(w.w).toBe(3)
    expect(w.h).toBe(4)
    expect(w.id.startsWith('cpu-gauge-')).toBe(true)
  })

  it('place le widget sous le bloc existant le plus bas', () => {
    const w = createWidget('cpu-load', [
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 2, w: 6, h: 6 }
    ])
    expect(w.y).toBe(8)
    expect(w.w).toBe(6)
  })

  it('honore un titre personnalisé et une cible', () => {
    const w = createWidget('fs-usage', [], { title: 'Racine', target: '/' })
    expect(w.title).toBe('Racine')
    expect(w.target).toBe('/')
  })

  it('refuse un widget inconnu', () => {
    expect(() => createWidget('autre', [])).toThrow(/inconnu/i)
  })

  it('n’attache pas de cible si non fournie (widget non concerné)', () => {
    const w = createWidget('cpu-load', [], { target: '/' })
    expect('target' in w).toBe(false)
  })
})

describe('validateWidget', () => {
  it('accepte un widget valide', () => {
    expect(validateWidget({ defId: 'cpu-load', title: 'Charge', w: 6, h: 4 })).toHaveLength(0)
  })

  it('refuse un widget inconnu', () => {
    expect(validateWidget({ defId: 'zzz', title: 'X', w: 6, h: 4 })).toHaveLength(1)
  })

  it('refuse un titre vide', () => {
    expect(validateWidget({ defId: 'cpu-load', title: '   ', w: 6, h: 4 })).toHaveLength(1)
  })

  it('exige une cible pour fs-usage', () => {
    const errs = validateWidget({ defId: 'fs-usage', title: 'Disque', w: 3, h: 4 })
    expect(errs.length).toBe(1)
    expect(errs[0]).toMatch(/cible/i)
    expect(validateWidget({ defId: 'fs-usage', title: 'Disque', target: '/', w: 3, h: 4 })).toHaveLength(0)
  })

  it('refuse une cible contenant ..', () => {
    expect(
      validateWidget({ defId: 'fs-usage', title: 'Disque', target: '/../../etc', w: 3, h: 4 }).length
    ).toBeGreaterThan(0)
  })

  it('refuse les dimensions hors limites', () => {
    expect(validateWidget({ defId: 'cpu-load', title: 'X', w: 13, h: 4 })).toHaveLength(1)
    expect(validateWidget({ defId: 'cpu-load', title: 'X', w: 0, h: 4 })).toHaveLength(1)
    expect(validateWidget({ defId: 'cpu-load', title: 'X', w: 6, h: 25 })).toHaveLength(1)
  })
})
