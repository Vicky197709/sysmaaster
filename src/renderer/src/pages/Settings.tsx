import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { Panel } from '../components/ui'

export default function Settings() {
  const data = useApp((s) => s.data)
  const act = useApp((s) => s.act)
  const exportData = useApp((s) => s.exportData)
  const importData = useApp((s) => s.importData)
  const [refreshMs, setRefreshMs] = useState(2000)
  const [expert, setExpert] = useState(false)

  const settings = data?.settings
  useEffect(() => {
    if (settings) {
      setRefreshMs(settings.refreshMs)
      setExpert(settings.expertMode)
    }
  }, [settings])

  const save = () =>
    void act({
      channel: 'store:update',
      payload: { kind: 'settings', op: 'save', data: { refreshMs, expertMode: expert } },
      success: 'Paramètres enregistrés — fréquence de relevé mise à jour'
    })

  const mcpSnippet = `{
  "mcpServers": {
    "sysmaster": {
      "command": "electron",
      "args": ["/chemin/vers/sysmaster/out/main/index.js", "--mcp"]
    }
  }
}`

  return (
    <div>
      <Panel title="Collecte">
        <div className="form-grid">
          <div className="field">
            Fréquence de relevé (ms) — 500 à 60000
            <input
              className="input"
              type="number"
              min={500}
              max={60000}
              step={250}
              value={refreshMs}
              onChange={(e) => setRefreshMs(Number(e.target.value))}
            />
          </div>
          <div className="field">
            Mode expert
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)', fontSize: 13 }}>
              <input type="checkbox" checked={expert} onChange={(e) => setExpert(e.target.checked)} />
              Autoriser les commandes shell dans les macros et le SIGKILL
            </label>
          </div>
        </div>
        <p className="hint">
          Le mode expert débloque des actions puissantes : les commandes shell et la force brute sont
          alors possibles, toujours journalisées dans le rapport d'audit.
        </p>
        <button className="btn primary" onClick={save}>
          Enregistrer les paramètres
        </button>
      </Panel>

      <Panel title="Données">
        <p className="hint" style={{ marginTop: 0 }}>
          Exportez vos tableaux de bord, règles et macros en JSON — puis réimportez-les sur une autre
          machine.
        </p>
        <div className="form-row">
          <button className="btn" onClick={exportData}>
            Exporter la configuration
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Importer un fichier
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importData(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </Panel>

      <Panel title="Interconnexion — serveur MCP">
        <p className="hint" style={{ marginTop: 0 }}>
          SysMaster peut s'exposer comme <strong>serveur MCP</strong> (Model Context Protocol) : vos
          autres applications — agents IA, scripts, outils compatibles MCP — se connectent alors aux
          mêmes métriques et actions, et communiquent ainsi entre elles via SysMaster. Ajoutez cette
          entrée à la configuration MCP de votre client :
        </p>
        <pre className="pre">{mcpSnippet}</pre>
        <p className="hint">
          Lancez d'abord <span className="mono">npm run build</span>, puis démarrez le serveur avec{" "}
          <span className="mono">npm run -s mcp</span> (le <span className="mono">-s</span> supprime la
          bannière npm qui corromprait le flux JSON-RPC), ou directement{" "}
          <span className="mono">electron out/main/index.js --mcp</span> comme ci-dessus. Le serveur parle
          JSON-RPC sur stdio : <span className="mono">tools/list</span> répertorie les outils
          disponibles (métriques, processus, services, macros, Docker…),{" "}
          <span className="mono">tools/call</span> les exécute via les mêmes canaux validés et
          journalisés que l'interface.
        </p>
      </Panel>

      <Panel title="À propos">
        <p className="hint" style={{ marginTop: 0 }}>
          SysMaster 1.0.0 — console de monitoring et de contrôle. Actions privilégiées via Polkit
          (jamais de sudo silent), canaux IPC restreints à une liste blanche, audit append-only.
        </p>
      </Panel>
    </div>
  )
}
