import type { CompareOp, Rule, Snapshot } from './types'
import { getMetric } from './metrics'

export const COMPARE_OPS: CompareOp[] = ['>', '<', '>=', '<=', '==']

export function compare(value: number, op: CompareOp, threshold: number): boolean {
  switch (op) {
    case '>':
      return value > threshold
    case '<':
      return value < threshold
    case '>=':
      return value >= threshold
    case '<=':
      return value <= threshold
    case '==':
      return value === threshold
    default:
      return false
  }
}

export interface RuleFire {
  rule: Rule
  value: number
}

/**
 * Moteur de règles : évalue « si [métrique] [op] [seuil] pendant [durée] »
 * avec un temps de repos (cooldown) après chaque déclenchement.
 * État en mémoire : durée de la violation et dernier déclenchement par règle.
 */
export class RuleEngine {
  private breachSince = new Map<string, number>()
  private lastFired = new Map<string, number>()

  reset(): void {
    this.breachSince.clear()
    this.lastFired.clear()
  }

  update(rules: Rule[], snapshot: Snapshot, now: number): RuleFire[] {
    const fires: RuleFire[] = []
    for (const rule of rules) {
      if (!rule.enabled) {
        this.breachSince.delete(rule.id)
        continue
      }
      const value = getMetric(snapshot, rule.metric, rule.target)
      if (value === null) {
        this.breachSince.delete(rule.id)
        continue
      }
      const breaching = compare(value, rule.op, rule.threshold)
      if (!breaching) {
        this.breachSince.delete(rule.id)
        continue
      }
      let since = this.breachSince.get(rule.id)
      if (since === undefined) {
        since = now
        this.breachSince.set(rule.id, since)
      }
      const heldMs = now - since
      if (heldMs < rule.durationSec * 1000) continue
      const last = this.lastFired.get(rule.id)
      if (last !== undefined && now - last < rule.cooldownSec * 1000) continue
      this.lastFired.set(rule.id, now)
      fires.push({ rule, value })
    }
    return fires
  }
}
