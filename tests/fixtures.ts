import type { Rule, Snapshot } from '../src/shared/types'

export function makeSnapshot(overrides?: Partial<Snapshot>): Snapshot {
  return {
    ts: 1_700_000_000_000,
    cpu: { load: 10, cores: [5, 8], temp: 45, brand: 'Test CPU', freq: 3200 },
    mem: {
      total: 16 * 1024 ** 3,
      used: 8 * 1024 ** 3,
      available: 8 * 1024 ** 3,
      usedPct: 50,
      swapTotal: 4 * 1024 ** 3,
      swapUsed: 1024 ** 3,
      swapUsedPct: 25
    },
    fs: [
      {
        fs: '/dev/sda1',
        type: 'ext4',
        size: 100 * 1024 ** 3,
        used: 60 * 1024 ** 3,
        available: 40 * 1024 ** 3,
        usePct: 60,
        mount: '/'
      }
    ],
    net: [],
    netRxTotal: 100,
    netTxTotal: 50,
    procs: { count: 200, topCpu: [], topMem: [] },
    uptime: 3600,
    gpus: [],
    hostname: 'test-host',
    platform: 'linux',
    ...overrides
  }
}

export function makeRule(overrides?: Partial<Rule>): Rule {
  return {
    id: 'rule-1',
    name: 'CPU saturé',
    enabled: true,
    metric: 'cpu.load',
    op: '>',
    threshold: 90,
    durationSec: 10,
    cooldownSec: 60,
    action: { type: 'notify', title: 'CPU trop élevé' },
    ...overrides
  }
}
