import si from 'systeminformation'
import os from 'os'
import type { FsInfo, NetIface, ProcessInfo, Snapshot } from '../shared/types'

let lastSnapshot: Snapshot | null = null

export function getLastSnapshot(): Snapshot | null {
  return lastSnapshot
}

export function setLastSnapshot(s: Snapshot): void {
  lastSnapshot = s
}

function round(n: number, d = 1): number {
  const p = 10 ** d
  return Math.round(n * p) / p
}

/** Instantané complet du système via systeminformation (appels parallèles). */
export async function collectSnapshot(): Promise<Snapshot> {
  const [cpu, load, temp, mem, fsSize, netStats, netIfaces, procs, gfx] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.cpuTemperature(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.networkInterfaces(),
    si.processes(),
    si.graphics()
  ])

  const swapTotal = Number(mem.swaptotal ?? 0)
  const swapUsed = Number(mem.swapused ?? 0)
  const used = Math.max(0, mem.total - (mem.available ?? mem.free))

  const fs: FsInfo[] = fsSize.map((f) => ({
    fs: f.fs,
    type: f.type,
    size: f.size,
    used: f.used,
    available: f.available,
    usePct: Math.round(f.use),
    mount: f.mount
  }))

  const ipByIface = new Map(netIfaces.map((i) => [i.iface, i.ip4 || '—']))
  let rxTotal = 0
  let txTotal = 0
  const net: NetIface[] = netStats
    .filter((s) => s.iface !== 'lo')
    .map((s) => {
      const rxRate = Math.max(0, Math.round((s.rx_sec ?? 0) / 1024))
      const txRate = Math.max(0, Math.round((s.tx_sec ?? 0) / 1024))
      rxTotal += rxRate
      txTotal += txRate
      return {
        iface: s.iface,
        ip: ipByIface.get(s.iface) ?? '—',
        rxRate,
        txRate,
        rxTotal: s.rx_bytes ?? 0,
        txTotal: s.tx_bytes ?? 0
      }
    })

  const toInfo = (p: (typeof procs.list)[number]): ProcessInfo => ({
    pid: p.pid,
    name: p.name || '—',
    cpu: round(p.cpu ?? 0),
    mem: round(p.mem ?? 0),
    user: p.user || '—',
    state: p.state || '—'
  })
  const byCpu = [...procs.list].sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0)).slice(0, 12).map(toInfo)
  const byMem = [...procs.list].sort((a, b) => (b.mem ?? 0) - (a.mem ?? 0)).slice(0, 12).map(toInfo)

  const snapshot: Snapshot = {
    ts: Date.now(),
    cpu: {
      load: round(load.currentLoad ?? 0),
      cores: (load.cpus ?? []).map((c) => round(c.load ?? 0)),
      temp: typeof temp.main === 'number' && temp.main > 0 ? round(temp.main) : null,
      brand: cpu.brand || cpu.manufacturer || 'CPU',
      freq: Number(cpu.speed ?? 0)
    },
    mem: {
      total: mem.total,
      used,
      available: mem.available ?? mem.free,
      usedPct: mem.total ? round((used / mem.total) * 100) : 0,
      swapTotal,
      swapUsed,
      swapUsedPct: swapTotal ? round((swapUsed / swapTotal) * 100) : 0
    },
    fs,
    net,
    netRxTotal: rxTotal,
    netTxTotal: txTotal,
    procs: { count: procs.all ?? procs.list.length, topCpu: byCpu, topMem: byMem },
    uptime: Math.round(os.uptime()),
    gpus: (gfx.controllers ?? []).map((c) => ({
      model: c.model || 'GPU inconnu',
      vendor: c.vendor || '—',
      vram: typeof c.vram === 'number' && c.vram > 0 ? c.vram : null
    })),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`
  }
  lastSnapshot = snapshot
  return snapshot
}
