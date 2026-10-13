// Types partagés entre le process main, le preload et le renderer.

export interface CpuInfo {
  load: number
  cores: number[]
  temp: number | null
  brand: string
  freq: number
}

export interface MemInfo {
  total: number
  used: number
  available: number
  usedPct: number
  swapTotal: number
  swapUsed: number
  swapUsedPct: number
}

export interface FsInfo {
  fs: string
  type: string
  size: number
  used: number
  available: number
  usePct: number
  mount: string
}

export interface NetIface {
  iface: string
  ip: string
  rxRate: number // Ko/s
  txRate: number // Ko/s
  rxTotal: number // octets cumulés
  txTotal: number
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  mem: number
  user: string
  state: string
}

export interface GpuInfo {
  model: string
  vendor: string
  vram: number | null // Mo
}

export interface Snapshot {
  ts: number
  cpu: CpuInfo
  mem: MemInfo
  fs: FsInfo[]
  net: NetIface[]
  netRxTotal: number // Ko/s
  netTxTotal: number // Ko/s
  procs: { count: number; topCpu: ProcessInfo[]; topMem: ProcessInfo[] }
  uptime: number
  gpus: GpuInfo[]
  hostname: string
  platform: string
}

export type CompareOp = '>' | '<' | '>=' | '<=' | '=='
export type ServiceOp = 'start' | 'stop' | 'restart' | 'enable' | 'disable'
export type MountOp = 'mount' | 'unmount'
export type DockerOp = 'start' | 'stop' | 'restart'
export type KillSignal = 'SIGTERM' | 'SIGKILL'

export interface Rule {
  id: string
  name: string
  enabled: boolean
  metric: string
  target?: string
  op: CompareOp
  threshold: number
  durationSec: number
  cooldownSec: number
  action: { type: 'notify'; title: string } | { type: 'macro'; macroId: string }
}

export type MacroAction =
  | { type: 'shell'; cmd: string; needsRoot: boolean }
  | { type: 'service'; op: ServiceOp; unit: string }
  | { type: 'desktop'; file: string }
  | { type: 'kill'; pid: number }

export interface Macro {
  id: string
  label: string
  action: MacroAction
}

export interface DashboardWidget {
  id: string
  defId: string
  title: string
  target?: string
  x: number
  y: number
  w: number
  h: number
}

export interface Dashboard {
  id: string
  name: string
  widgets: DashboardWidget[]
}

export interface Settings {
  refreshMs: number
  expertMode: boolean
}

export interface AppStoreData {
  settings: Settings
  dashboards: Dashboard[]
  rules: Rule[]
  macros: Macro[]
}

export interface AuditEntry {
  ts: number
  action: string
  target: string
  status: 'ok' | 'erreur' | 'refusé'
  detail?: string
}

export interface ExecResult {
  ok: boolean
  output: string
  error?: string
}

export interface ServiceInfo {
  unit: string
  active: string
  sub: string
  description: string
}

export interface DesktopApp {
  file: string
  name: string
  exec: string
  icon: string
  categories: string
}

export interface PkgInfo {
  name: string
  version: string
}

export interface ConnInfo {
  proto: string
  state: string
  local: string
  peer: string
  process: string
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
}

export interface SessionInfo {
  user: string
  tty: string
  from: string
  since: string
}

export interface LocalUser {
  name: string
  uid: number
  shell: string
  home: string
}

export interface AppEvent {
  kind: 'toast' | 'règle'
  text: string
  level: 'info' | 'ok' | 'error' | 'warn'
}
