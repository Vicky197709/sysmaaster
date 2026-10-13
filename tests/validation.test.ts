import { describe, expect, it } from 'vitest'
import {
  ALLOWED_IPC,
  isAllowedChannel,
  validateDashUpdate,
  validateDockerOp,
  validateKill,
  validateMacro,
  validateMountOp,
  validateRenice,
  validateRule,
  validateServiceOp,
  validateSettings
} from '../src/shared/validation'
import { makeRule } from './fixtures'

describe('liste blanche IPC', () => {
  it('24 canaux exactement, sans doublon', () => {
    expect(ALLOWED_IPC).toHaveLength(24)
    expect(new Set(ALLOWED_IPC).size).toBe(ALLOWED_IPC.length)
  })

  it('accepte chaque canal de la liste', () => {
    for (const ch of ALLOWED_IPC) expect(isAllowedChannel(ch)).toBe(true)
  })

  it('refuse tout canal inconnu ou mal formé', () => {
    expect(isAllowedChannel('evil:channel')).toBe(false)
    expect(isAllowedChannel('')).toBe(false)
    expect(isAllowedChannel('store:update ')).toBe(false)
    expect(isAllowedChannel('__proto__')).toBe(false)
  })
})

describe('validateKill', () => {
  it('valide SIGTERM et SIGKILL', () => {
    expect(validateKill({ pid: 123, signal: 'SIGTERM' })).toHaveLength(0)
    expect(validateKill({ pid: 123, signal: 'SIGKILL' })).toHaveLength(0)
  })
  it('refuse PID ou signal invalides', () => {
    expect(validateKill({ pid: 0, signal: 'SIGTERM' })).not.toHaveLength(0)
    expect(validateKill({ pid: -1, signal: 'SIGTERM' })).not.toHaveLength(0)
    expect(validateKill({ pid: 1.5, signal: 'SIGTERM' })).not.toHaveLength(0)
    expect(validateKill({ pid: 1, signal: 'SIGINT' })).not.toHaveLength(0)
    expect(validateKill(null)).not.toHaveLength(0)
  })
})

describe('validateRenice', () => {
  it('accepte -20 à 19', () => {
    expect(validateRenice({ pid: 1, nice: -20 })).toHaveLength(0)
    expect(validateRenice({ pid: 1, nice: 19 })).toHaveLength(0)
  })
  it('refuse hors bornes ou non entier', () => {
    expect(validateRenice({ pid: 1, nice: -21 })).not.toHaveLength(0)
    expect(validateRenice({ pid: 1, nice: 20 })).not.toHaveLength(0)
    expect(validateRenice({ pid: 1, nice: 5.5 })).not.toHaveLength(0)
  })
})

describe('validateServiceOp', () => {
  it('accepte les opérations et unités valides', () => {
    expect(validateServiceOp({ op: 'restart', unit: 'nginx.service' })).toHaveLength(0)
    expect(validateServiceOp({ op: 'enable', unit: 'user@1000.service' })).toHaveLength(0)
  })
  it('refuse opérations ou unités invalides', () => {
    expect(validateServiceOp({ op: 'kill', unit: 'nginx.service' })).not.toHaveLength(0)
    expect(validateServiceOp({ op: 'start', unit: '../../etc/passwd' })).not.toHaveLength(0)
    expect(validateServiceOp({ op: 'start', unit: 'a b;c' })).not.toHaveLength(0)
  })
})

describe('validateMountOp', () => {
  it('exige un chemin /dev/…', () => {
    expect(validateMountOp({ op: 'unmount', device: '/dev/sdb1' })).toHaveLength(0)
    expect(validateMountOp({ op: 'mount', device: '/dev/mapper/vg-root' })).toHaveLength(0)
    expect(validateMountOp({ op: 'mount', device: '/etc/passwd' })).not.toHaveLength(0)
    expect(validateMountOp({ op: 'wipe', device: '/dev/sdb1' })).not.toHaveLength(0)
  })
})

describe('validateDockerOp', () => {
  it('valide op + id hexadécimal', () => {
    expect(validateDockerOp({ op: 'start', id: 'abc123def456' })).toHaveLength(0)
    expect(validateDockerOp({ op: 'rm', id: 'abc123' })).not.toHaveLength(0)
    expect(validateDockerOp({ op: 'start', id: 'zzzz' })).not.toHaveLength(0)
    expect(validateDockerOp({ op: 'start', id: '$(rm -rf /)' })).not.toHaveLength(0)
  })
})

describe('validateRule', () => {
  it('accepte une règle valide', () => {
    expect(validateRule(makeRule())).toHaveLength(0)
  })

  it('refuse une métrique inconnue', () => {
    expect(validateRule(makeRule({ metric: 'autre' }))).not.toHaveLength(0)
  })

  it('exige une cible pour fs.usedPct', () => {
    const r = makeRule({ metric: 'fs.usedPct' })
    r.target = undefined
    expect(validateRule(r)).not.toHaveLength(0)
    expect(validateRule({ ...r, target: '/' })).toHaveLength(0)
  })

  it('refuse opérateur, seuil ou durées invalides', () => {
    expect(validateRule(makeRule({ op: '!=' as never }))).not.toHaveLength(0)
    expect(validateRule(makeRule({ threshold: NaN }))).not.toHaveLength(0)
    expect(validateRule(makeRule({ durationSec: -1 }))).not.toHaveLength(0)
    expect(validateRule(makeRule({ cooldownSec: 1.5 }))).not.toHaveLength(0)
    expect(validateRule(makeRule({ durationSec: 90000 }))).not.toHaveLength(0)
  })

  it('valide le payload d’action', () => {
    expect(validateRule(makeRule({ action: { type: 'notify', title: '' } }))).not.toHaveLength(0)
    expect(
      validateRule(makeRule({ action: { type: 'macro', macroId: '' } }))
    ).not.toHaveLength(0)
    expect(validateRule(makeRule({ name: '' }))).not.toHaveLength(0)
    expect(validateRule(null)).not.toHaveLength(0)
  })
})

describe('validateMacro', () => {
  it('les commandes shell exigent le mode expert', () => {
    const m = { id: 'm1', label: 'Test', action: { type: 'shell' as const, cmd: 'df -h', needsRoot: false } }
    expect(validateMacro(m, false)).not.toHaveLength(0)
    expect(validateMacro(m, true)).toHaveLength(0)
  })

  it('valide les macros service / desktop / kill', () => {
    expect(
      validateMacro({ id: 'm', label: 'R', action: { type: 'service', op: 'restart', unit: 'ssh.service' } }, false)
    ).toHaveLength(0)
    expect(
      validateMacro({ id: 'm', label: 'R', action: { type: 'kill', pid: 42 } }, false)
    ).toHaveLength(0)
    expect(
      validateMacro({ id: 'm', label: 'R', action: { type: 'kill', pid: 0 } }, false)
    ).not.toHaveLength(0)
    expect(
      validateMacro({ id: 'm', label: 'R', action: { type: 'service', op: 'start', unit: 'bad unit' } }, false)
    ).not.toHaveLength(0)
  })

  it('refuse un libellé trop long ou vide', () => {
    expect(validateMacro({ id: 'm', label: '', action: { type: 'kill', pid: 1 } }, false)).not.toHaveLength(0)
    expect(
      validateMacro({ id: 'm', label: 'x'.repeat(41), action: { type: 'kill', pid: 1 } }, false)
    ).not.toHaveLength(0)
  })
})

describe('validateSettings', () => {
  it('accepte des valeurs dans les bornes', () => {
    expect(validateSettings({ refreshMs: 2000, expertMode: false })).toHaveLength(0)
    expect(validateSettings({ refreshMs: 500, expertMode: true })).toHaveLength(0)
    expect(validateSettings({ refreshMs: 60000, expertMode: true })).toHaveLength(0)
  })
  it('refuse hors bornes', () => {
    expect(validateSettings({ refreshMs: 100, expertMode: false })).not.toHaveLength(0)
    expect(validateSettings({ refreshMs: 60001, expertMode: false })).not.toHaveLength(0)
    expect(validateSettings({ refreshMs: 2000.5, expertMode: false })).not.toHaveLength(0)
    expect(validateSettings({ refreshMs: 2000, expertMode: 'oui' })).not.toHaveLength(0)
  })
})

describe('validateDashUpdate', () => {
  const dashId = 'db-1'

  it('valide la création avec un nom valide', () => {
    expect(validateDashUpdate({ op: 'create', name: 'Principal' })).toHaveLength(0)
    expect(validateDashUpdate({ op: 'create', name: '' })).not.toHaveLength(0)
    expect(validateDashUpdate({ op: 'create', name: 'x'.repeat(41) })).not.toHaveLength(0)
  })

  it('exige un tableau cible sauf pour create', () => {
    expect(validateDashUpdate({ op: 'rename', name: 'A' })).not.toHaveLength(0)
    expect(validateDashUpdate({ op: 'rename', dashboardId: dashId, name: 'A' })).toHaveLength(0)
    expect(validateDashUpdate({ op: 'delete', dashboardId: dashId })).toHaveLength(0)
  })

  it('valide addWidget avec titre et cible obligatoire', () => {
    expect(validateDashUpdate({ op: 'addWidget', dashboardId: dashId, defId: 'cpu-load', title: 'CPU' })).toHaveLength(0)
    expect(validateDashUpdate({ op: 'addWidget', dashboardId: dashId, defId: 'cpu-load', title: '' })).not.toHaveLength(0)
    expect(validateDashUpdate({ op: 'addWidget', dashboardId: dashId, defId: 'inconnu', title: 'X' })).not.toHaveLength(0)
    expect(validateDashUpdate({ op: 'addWidget', dashboardId: dashId, defId: 'fs-usage', title: 'D' })).not.toHaveLength(0)
    expect(
      validateDashUpdate({ op: 'addWidget', dashboardId: dashId, defId: 'fs-usage', title: 'D', target: '/' })
    ).toHaveLength(0)
  })

  it('valide removeWidget et setLayout', () => {
    expect(validateDashUpdate({ op: 'removeWidget', dashboardId: dashId })).not.toHaveLength(0)
    expect(
      validateDashUpdate({ op: 'removeWidget', dashboardId: dashId, widgetId: 'w1' })
    ).toHaveLength(0)
    expect(
      validateDashUpdate({
        op: 'setLayout',
        dashboardId: dashId,
        items: [{ id: 'w1', x: 0, y: 0, w: 6, h: 4 }]
      })
    ).toHaveLength(0)
    expect(
      validateDashUpdate({
        op: 'setLayout',
        dashboardId: dashId,
        items: [{ id: 'w1', x: -1, y: 0, w: 6, h: 4 }]
      })
    ).not.toHaveLength(0)
    expect(
      validateDashUpdate({
        op: 'setLayout',
        dashboardId: dashId,
        items: [{ id: 'w1', x: 0, y: 0, w: 13, h: 4 }]
      })
    ).not.toHaveLength(0)
  })

  it('refuse opérations inconnues', () => {
    expect(validateDashUpdate({ op: 'vider', dashboardId: dashId })).not.toHaveLength(0)
    expect(validateDashUpdate(null)).not.toHaveLength(0)
  })
})
