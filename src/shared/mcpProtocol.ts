/**
 * Protocole MCP (Model Context Protocol) — JSON-RPC 2.0 sur stdio,
 * transport newline-delimited JSON (une requête par ligne, une réponse par ligne).
 *
 * Ce module est pur : il ne dépend pas d'Electron ni du système, ce qui permet
 * de le tester unitairement. Le pont vers les opérations réelles est injecté
 * via `dispatch(toolName, args)`.
 */

export interface McpToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type McpDispatch = (
  tool: string,
  args: Record<string, unknown>
) => Promise<{ text: string; isError?: boolean }>

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

export const MCP_PROTOCOL_VERSION = '2024-11-05'

const PAGE = { type: 'object', properties: {} } as const

/** Catalogue d'outils exposés aux clients MCP (vos applications interconnectées). */
export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'get_system_snapshot',
    description:
      "Instantané complet du système : charge CPU par cœur, température, mémoire vive et swap, disques, débits réseau, nombre de processus, uptime, GPU.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_processes',
    description: 'Liste des processus triés par utilisation CPU (nom, PID, utilisateur, CPU %, RAM %, état).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500, description: "Nombre maximum de processus (défaut 50)" },
        query: { type: 'string', description: 'Filtre sur le nom, le PID ou l’utilisateur' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'list_services',
    description: 'Liste des services systemd avec leur état (active/inactive/failed) et leur description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filtre sur le nom de unité ou la description' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'list_disks',
    description: "Points de montage : périphérique, type, taille, espace utilisé et taux d'occupation.",
    inputSchema: PAGE
  },
  {
    name: 'list_connections',
    description: 'Connexions réseau actives (TCP/UDP) avec état, adresses locales/distales et processus.',
    inputSchema: PAGE
  },
  {
    name: 'list_containers',
    description: 'Conteneurs Docker (nom, image, état). Renvoie une erreur si le démon Docker est absent.',
    inputSchema: PAGE
  },
  {
    name: 'search_packages',
    description: 'Recherche de paquets Debian/Ubuntu installés par nom.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Sous-chaîne du nom de paquet' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Résultats max (défaut 50)' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'read_journal',
    description: 'Dernières lignes du journal système (journalctl), filtrables côté client par mots-clés.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: { type: 'integer', minimum: 1, maximum: 1000, description: 'Nombre de lignes (défaut 200)' },
        contains: { type: 'string', description: 'Ne garder que les lignes contenant cette chaîne' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'read_audit',
    description: "Journal d'audit SysMaster : chaque action de contrôle effectuée, avec statut (ok/erreur/refusé).",
    inputSchema: PAGE
  },
  {
    name: 'get_configuration',
    description: 'Configuration SysMaster : réglages, règles automatiques et macros disponibles.',
    inputSchema: PAGE
  },
  {
    name: 'ping_host',
    description: 'Test de connectivité ICMP vers un hôte ou domaine (4 paquets).',
    inputSchema: {
      type: 'object',
      properties: { host: { type: 'string', description: 'Hôte ou domaine (ex. 8.8.8.8)' } },
      required: ['host'],
      additionalProperties: false
    }
  },
  {
    name: 'resolve_dns',
    description: "Résolution DNS A d'un nom de domaine.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Nom de domaine (ex. example.com)' } },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'kill_process',
    description: "Arrête un processus par PID (SIGTERM par défaut, SIGKILL en dernier recours). Action journalisée dans l'audit.",
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'integer', minimum: 1 },
        signal: { type: 'string', enum: ['SIGTERM', 'SIGKILL'], description: 'Défaut SIGTERM' }
      },
      required: ['pid'],
      additionalProperties: false
    }
  },
  {
    name: 'control_service',
    description: "Démarre, arrête, redémarre, active ou désactive un service systemd (via Polkit, action journalisée).",
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['start', 'stop', 'restart', 'enable', 'disable'] },
        unit: { type: 'string', description: "Nom d'unité (ex. nginx.service)" }
      },
      required: ['op', 'unit'],
      additionalProperties: false
    }
  },
  {
    name: 'control_container',
    description: "Démarre, arrête ou redémarre un conteneur Docker par identifiant.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['start', 'stop', 'restart'] },
        id: { type: 'string', description: 'Identifiant ou nom du conteneur (hexadécimal)' }
      },
      required: ['op', 'id'],
      additionalProperties: false
    }
  },
  {
    name: 'control_disk',
    description: 'Monte ou démonte un périphérique via udisks2 (chemin /dev/… requis).',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['mount', 'unmount'] },
        device: { type: 'string', description: 'Périphérique (ex. /dev/sdb1)' }
      },
      required: ['op', 'device'],
      additionalProperties: false
    }
  },
  {
    name: 'launch_application',
    description: "Lance une application à partir de son fichier .desktop (emplacements système/utilisateur autorisés uniquement).",
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Chemin complet vers le fichier .desktop' } },
      required: ['file'],
      additionalProperties: false
    }
  },
  {
    name: 'run_macro',
    description: 'Exécute une macro SysMaster par identifiant (voir get_configuration pour les macros disponibles).',
    inputSchema: {
      type: 'object',
      properties: { macroId: { type: 'string', description: 'Identifiant de la macro' } },
      required: ['macroId'],
      additionalProperties: false
    }
  },
  {
    name: 'set_process_priority',
    description: "Change la priorité (nice) d'un processus : -20 (max) à 19 (min). Un privilège peut être demandé.",
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'integer', minimum: 1 },
        nice: { type: 'integer', minimum: -20, maximum: 19 }
      },
      required: ['pid', 'nice'],
      additionalProperties: false
    }
  }
]

function errorResponse(id: string | number | null, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/**
 * Traite un message JSON-RPC entrant.
 * Renvoie null pour les notifications (pas de réponse).
 */
export async function handleRpc(
  raw: unknown,
  dispatch: McpDispatch
): Promise<Record<string, unknown> | null> {
  const msg = raw as JsonRpcRequest
  if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') {
    return errorResponse(null, -32600, 'Requête invalide')
  }
  const isNotification = msg.id === undefined || msg.id === null
  const id = isNotification ? null : (msg.id as string | number)

  switch (msg.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion:
            typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'sysmaster', version: '1.0.0' },
          instructions:
            "SysMaster contrôle la machine locale. Les outils en lecture renvoient du JSON ; les outils d'action sont journalisés dans le rapport d'audit et les privilèges passent par Polkit."
        }
      }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } }
    case 'tools/call': {
      const params = msg.params ?? {}
      const name = typeof params.name === 'string' ? params.name : ''
      if (!name) return errorResponse(id, -32602, "Nom d'outil manquant")
      if (!MCP_TOOLS.some((t) => t.name === name)) {
        return errorResponse(id, -32602, `Outil inconnu : ${name}`)
      }
      const args = (params.arguments && typeof params.arguments === 'object'
        ? params.arguments
        : {}) as Record<string, unknown>
      try {
        const out = await dispatch(name, args)
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: out.text }],
            ...(out.isError ? { isError: true } : {})
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: message }], isError: true }
        }
      }
    }
    // Non exposés mais renvoyés vides pour rester compatibles avec les clients génériques.
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } }
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } }
    default:
      return errorResponse(id, -32601, `Méthode non prise en charge : ${msg.method}`)
  }
}
