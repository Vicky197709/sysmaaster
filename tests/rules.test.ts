import { describe, expect, it } from 'vitest'
import { RuleEngine, compare } from '../src/shared/rules'
import { getMetric, getMetricDef, METRIC_DEFS } from '../src/shared/metrics'
import { makeRule, makeSnapshot } from './fixtures'

describe('compare', () => {
  it('évalue les cinq opérateurs', () => {
    expect(compare(10, '>', 5)).toBe(true)
    expect(compare(10, '<', 5)).toBe(false)
    expect(compare(5, '>=', 5)).toBe(true)
    expect(compare(5, '<=', 5)).toBe(true)
    expect(compare(5, '==', 5)).toBe(true)
    expect(compare(5, '==', 4)).toBe(false)
  })
})

describe('getMetric', () => {
  it('lit les métriques simples', () => {
    const s = makeSnapshot()
    expect(getMetric(s, 'cpu.load')).toBe(10)
    expect(getMetric(s, 'mem.usedPct')).toBe(50)
    expect(getMetric(s, 'swap.usedPct')).toBe(25)
    expect(getMetric(s, 'procs.count')).toBe(200)
    expect(getMetric(s, 'uptime')).toBe(3600)
    expect(getMetric(s, 'net.rxRate')).toBe(100)
  })

  it('exige une cible pour fs.usedPct', () => {
    const s = makeSnapshot()
    expect(getMetric(s, 'fs.usedPct')).toBeNull()
    expect(getMetric(s, 'fs.usedPct', '/')).toBe(60)
    expect(getMetric(s, 'fs.usedPct', '/inconnu')).toBeNull()
  })

  it('renvoie null pour une métrique inconnue', () => {
    expect(getMetric(makeSnapshot(), 'autre.truc')).toBeNull()
  })

  it('chaque métrique du catalogue a un getter', () => {
    const s = makeSnapshot()
    for (const def of METRIC_DEFS) {
      if (def.needsTarget) {
        expect(getMetric(s, def.key, '/')).not.toBeNull()
      } else {
        expect(getMetric(s, def.key)).not.toBeNull()
      }
    }
  })
})

describe('RuleEngine', () => {
  const T0 = 1_000_000

  it('ne déclenche pas avant la durée de maintien', () => {
    const engine = new RuleEngine()
    const hot = makeSnapshot({ cpu: { ...makeSnapshot().cpu, load: 99 } })
    const rule = makeRule({ durationSec: 10 })
    expect(engine.update([rule], hot, T0)).toHaveLength(0)
    expect(engine.update([rule], hot, T0 + 5_000)).toHaveLength(0)
    expect(engine.update([rule], hot, T0 + 10_000)).toHaveLength(1)
  })

  it('déclenche une fois la durée écoulée, puis respecte le repos', () => {
    const engine = new RuleEngine()
    const hot = makeSnapshot({ cpu: { ...makeSnapshot().cpu, load: 99 } })
    const rule = makeRule({ durationSec: 0, cooldownSec: 60 })
    const first = engine.update([rule], hot, T0)
    expect(first).toHaveLength(1)
    expect(first[0].value).toBe(99)
    // immédiatement après : repos
    expect(engine.update([rule], hot, T0 + 1_000)).toHaveLength(0)
    // après le repos : à nouveau
    expect(engine.update([rule], hot, T0 + 61_000)).toHaveLength(1)
  })

  it('réinitialise la durée si la valeur revient sous le seuil', () => {
    const engine = new RuleEngine()
    const hot = makeSnapshot({ cpu: { ...makeSnapshot().cpu, load: 99 } })
    const cool = makeSnapshot({ cpu: { ...makeSnapshot().cpu, load: 10 } })
    const rule = makeRule({ durationSec: 10, cooldownSec: 0 })
    engine.update([rule], hot, T0)
    // retour à la normale : le compteur repart
    engine.update([rule], cool, T0 + 8_000)
    expect(engine.update([rule], hot, T0 + 12_000)).toHaveLength(0)
    // reprise de la violation à T0+12000 : 10 s de maintien requis
    expect(engine.update([rule], hot, T0 + 18_000)).toHaveLength(0)
    expect(engine.update([rule], hot, T0 + 22_000)).toHaveLength(1)
  })

  it('ignore les règles désactivées', () => {
    const engine = new RuleEngine()
    const hot = makeSnapshot({ cpu: { ...makeSnapshot().cpu, load: 99 } })
    const rule = makeRule({ enabled: false, durationSec: 0 })
    expect(engine.update([rule], hot, T0)).toHaveLength(0)
  })

  it('ignore les métriques absentes (null)', () => {
    const engine = new RuleEngine()
    const rule = makeRule({ metric: 'cpu.temp', durationSec: 0 })
    const noTemp = makeSnapshot({ cpu: { ...makeSnapshot().cpu, temp: null } })
    expect(engine.update([rule], noTemp, T0)).toHaveLength(0)
  })

  it('évalue plusieurs règles indépendamment', () => {
    const engine = new RuleEngine()
    const snap = makeSnapshot({
      cpu: { ...makeSnapshot().cpu, load: 95 },
      mem: { ...makeSnapshot().mem, usedPct: 92 }
    })
    const r1 = makeRule({ id: 'r1', durationSec: 0 })
    const r2 = makeRule({ id: 'r2', metric: 'mem.usedPct', threshold: 90, durationSec: 0 })
    const r3 = makeRule({ id: 'r3', metric: 'mem.usedPct', threshold: 99, durationSec: 0 })
    const fires = engine.update([r1, r2, r3], snap, T0)
    expect(fires.map((f) => f.rule.id)).toEqual(['r1', 'r2'])
  })

  it('getMetricDef retrouve les métadonnées', () => {
    expect(getMetricDef('cpu.load')?.unit).toBe('%')
    expect(getMetricDef('fs.usedPct')?.needsTarget).toBe(true)
    expect(getMetricDef('inconnu')).toBeUndefined()
  })
})
