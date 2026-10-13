import { describe, expect, it } from 'vitest'
import { handleRpc, MCP_TOOLS, type McpDispatch } from '../src/shared/mcpProtocol'

const okDispatch: McpDispatch = async (tool, args) => ({ text: `ok:${tool}:${JSON.stringify(args)}` })

describe('catalogue MCP', () => {
  it('noms uniques et schémas JSON valides', () => {
    const names = MCP_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of MCP_TOOLS) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(t.description.length).toBeGreaterThan(20)
      expect(t.inputSchema.type).toBe('object')
    }
  })

  it('expose les outils de lecture et de contrôle attendus', () => {
    expect(names()).toContain('get_system_snapshot')
    expect(names()).toContain('list_processes')
    expect(names()).toContain('control_service')
    expect(names()).toContain('run_macro')
    expect(names()).toContain('kill_process')
  })

  function names(): string[] {
    return MCP_TOOLS.map((t) => t.name)
  }
})

describe('handleRpc', () => {
  it('initialize : renvoie capabilities et écho du protocole', async () => {
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      okDispatch
    )
    expect(res).not.toBeNull()
    const result = res?.result as Record<string, unknown>
    expect(result.protocolVersion).toBe('2025-03-26')
    expect(result.serverInfo).toEqual({ name: 'sysmaster', version: '1.0.0' })
    expect((result.capabilities as { tools: unknown }).tools).toBeDefined()
  })

  it('initialize sans protocole : version par défaut', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, okDispatch)
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe('2024-11-05')
  })

  it('notifications initialized : aucune réponse', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, okDispatch)
    expect(res).toBeNull()
  })

  it('ping : résultat vide', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'ping' }, okDispatch)
    expect(res?.result).toEqual({})
  })

  it('tools/list : renvoie le catalogue complet', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, okDispatch)
    const tools = (res?.result as { tools: unknown[] }).tools
    expect(tools).toHaveLength(MCP_TOOLS.length)
  })

  it('tools/call : délègue au dispatch et encode en content texte', async () => {
    const calls: string[] = []
    const spy: McpDispatch = async (tool, args) => {
      calls.push(tool)
      return { text: `sortie pour ${tool} ${args.x ?? ''}` }
    }
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_system_snapshot', arguments: { x: 1 } } },
      spy
    )
    expect(calls).toEqual(['get_system_snapshot'])
    const result = res?.result as { content: { type: string; text: string }[]; isError?: boolean }
    expect(result.content[0]).toEqual({ type: 'text', text: 'sortie pour get_system_snapshot 1' })
    expect(result.isError).toBeUndefined()
  })

  it('tools/call : erreur métier → isError true (pas d’erreur protocole)', async () => {
    const failing: McpDispatch = async () => ({ text: 'unité introuvable', isError: true })
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'control_service', arguments: {} } },
      failing
    )
    const result = res?.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('unité introuvable')
  })

  it('tools/call : exception du dispatch → réponse isError, jamais de crash', async () => {
    const boom: McpDispatch = async () => {
      throw new Error('échec interne')
    }
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_disks', arguments: {} } },
      boom
    )
    const result = res?.result as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('échec interne')
  })

  it('outil inconnu → erreur -32602', async () => {
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'rm_rf', arguments: {} } },
      okDispatch
    )
    expect((res?.error as { code: number }).code).toBe(-32602)
  })

  it('méthode inconnue → erreur -32601', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 8, method: 'debug/eval' }, okDispatch)
    expect((res?.error as { code: number }).code).toBe(-32601)
  })

  it('message invalide → erreur -32600', async () => {
    expect((await handleRpc(null, okDispatch))?.error).toBeDefined()
    expect((await handleRpc({ jsonrpc: '2.0', id: 9 }, okDispatch))?.error).toBeDefined()
  })

  it('resources/list et prompts/list vides (compatibilité clients génériques)', async () => {
    expect(((await handleRpc({ jsonrpc: '2.0', id: 10, method: 'resources/list' }, okDispatch))?.result as { resources: unknown[] }).resources).toHaveLength(0)
    expect(((await handleRpc({ jsonrpc: '2.0', id: 11, method: 'prompts/list' }, okDispatch))?.result as { prompts: unknown[] }).prompts).toHaveLength(0)
  })
})
