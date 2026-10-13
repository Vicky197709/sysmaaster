import { app } from 'electron'
import { listAudit } from './audit'
import * as ctrl from './control'
import { collectSnapshot, getLastSnapshot } from './metrics'
import * as svc from './services'
import { getStore } from './store'
import { handleRpc, MCP_TOOLS, type McpDispatch } from '../shared/mcpProtocol'
import type { ExecResult } from '../shared/types'

/**
 * Pont entre les outils MCP et les opérations réelles.
 * Chaque action passe par les mêmes validateurs/audits que l'interface graphique.
 */
export const dispatch: McpDispatch = async (tool, args) => {
  const str = (k: string): string => (typeof args[k] === 'string' ? (args[k] as string) : '')
  const int = (k: string): number => (typeof args[k] === 'number' ? (args[k] as number) : 0)
  const json = (v: unknown): { text: string } => ({ text: JSON.stringify(v, null, 2) })

  switch (tool) {
    // ----- Lecture -----
    case 'get_system_snapshot':
      return json((await getLastSnapshot()) ?? (await collectSnapshot()))
    case 'list_processes': {
      let list = await svc.listProcesses()
      const query = str('query').toLowerCase().trim()
      if (query) {
        list = list.filter(
          (p) => p.name.toLowerCase().includes(query) || p.user.toLowerCase().includes(query) || String(p.pid) === query
        )
      }
      const limit = Math.min(Math.max(int('limit') || 50, 1), 500)
      return json(list.slice(0, limit))
    }
    case 'list_services': {
      let list = await svc.listServices()
      const query = str('query').toLowerCase().trim()
      if (query) {
        list = list.filter(
          (s) => s.unit.toLowerCase().includes(query) || s.description.toLowerCase().includes(query)
        )
      }
      return json(list.slice(0, 300))
    }
    case 'list_disks':
      return json(await snapshotFs())
    case 'list_connections':
      return json((await svc.listConnections()).slice(0, 300))
    case 'list_containers':
      return json(await svc.listDocker())
    case 'search_packages': {
      const all = await svc.listPackages()
      const query = str('query').toLowerCase().trim()
      const filtered = query ? all.filter((p) => p.name.toLowerCase().includes(query)) : all
      const limit = Math.min(Math.max(int('limit') || 50, 1), 500)
      return json({ total: filtered.length, packages: filtered.slice(0, limit) })
    }
    case 'read_journal': {
      const lines = Math.min(Math.max(int('lines') || 200, 1), 1000)
      const text = await svc.listJournal(lines)
      const contains = str('contains')
      const out = contains
        ? text.split('\n').filter((l) => l.toLowerCase().includes(contains.toLowerCase())).join('\n')
        : text
      return { text: out || 'Aucune ligne correspondante' }
    }
    case 'read_audit':
      return json(await listAudit())
    case 'get_configuration': {
      const s = getStore()
      return json({ settings: s.settings, rules: s.rules, macros: s.macros })
    }
    case 'ping_host':
      return { text: await svc.ping(str('host')) }
    case 'resolve_dns':
      return { text: await svc.dnsLookup(str('name')) }

    // ----- Contrôle (validé + journalisé par control.ts) -----
    case 'kill_process': {
      const r = await ctrl.killPid({ pid: int('pid'), signal: str('signal') || 'SIGTERM' })
      return execOut(r)
    }
    case 'set_process_priority': {
      const r = await ctrl.renice({ pid: int('pid'), nice: int('nice') })
      return execOut(r)
    }
    case 'control_service': {
      const r = await ctrl.serviceOp({ op: str('op'), unit: str('unit') })
      return execOut(r)
    }
    case 'control_container': {
      const r = await ctrl.dockerOp({ op: str('op'), id: str('id') })
      return execOut(r)
    }
    case 'control_disk': {
      const r = await ctrl.mountOp({ op: str('op'), device: str('device') })
      return execOut(r)
    }
    case 'launch_application': {
      const r = await ctrl.launchDesktop({ file: str('file') })
      return execOut(r)
    }
    case 'run_macro': {
      const r = await ctrl.runMacro({ macroId: str('macroId') }, 'MCP')
      return execOut(r)
    }
    default:
      throw new Error(`Outil non implémenté : ${tool}`)
  }
}

async function snapshotFs(): Promise<unknown> {
  const snap = (await getLastSnapshot()) ?? (await collectSnapshot())
  return snap.fs
}

function execOut(r: ExecResult): { text: string; isError?: boolean } {
  if (r.ok) return { text: r.output || 'OK' }
  return { text: r.error || 'Commande échouée', isError: true }
}

/**
 * Serveur MCP sur stdio : une requête JSON-RPC par ligne, une réponse par ligne.
 * Sortie strictement protocole sur stdout (aucun log) ; EOF sur stdin → arrêt.
 */
export async function startMcpServer(): Promise<void> {
  // Récupère le magasin (userData) une fois l'application prête.
  getStore()
  console.error(`[sysmaster] serveur MCP actif — ${MCP_TOOLS.length} outils exposés sur stdio`)

  let buffer = ''
  // File sérialisée : traitement dans l'ordre d'arrivée, une requête à la fois.
  let chain: Promise<void> = Promise.resolve()

  const handleLine = async (line: string): Promise<void> => {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })}\n`
      )
      return
    }
    const response = await handleRpc(parsed, dispatch)
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
  }

  const onData = (chunk: Buffer): void => {
    buffer += chunk.toString('utf8')
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line) continue
      chain = chain.then(() => handleLine(line)).catch(onChainError)
    }
  }

  const onChainError = (e: unknown): void => {
    console.error(`[sysmaster] MCP : erreur de traitement — ${e instanceof Error ? e.message : String(e)}`)
  }

  // Fin de flux : on traite d'abord les requêtes reçues (y compris la dernière
  // ligne non terminée), puis on quitte après vidage de stdout.
  const drainAndQuit = (): void => {
    const rest = buffer.trim()
    if (rest) {
      buffer = ''
      chain = chain.then(() => handleLine(rest)).catch(onChainError)
    }
    void chain.then(() => setTimeout(() => app.quit(), 50))
  }

  process.stdin.on('data', onData)
  process.stdin.on('end', drainAndQuit)
  process.stdin.on('close', drainAndQuit)
}
