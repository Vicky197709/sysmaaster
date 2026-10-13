import { app, BrowserWindow, Notification, session } from 'electron'
import { join } from 'path'
import { audit } from './audit'
import { runMacro } from './control'
import { registerIpc } from './ipc'
import { startMcpServer } from './mcp'
import { collectSnapshot, setLastSnapshot } from './metrics'
import { getStore } from './store'
import { RuleEngine } from '../shared/rules'
import type { AppEvent, Settings, Snapshot } from '../shared/types'

let win: BrowserWindow | null = null
let timer: NodeJS.Timeout | null = null
/** Mode serveur MCP (--mcp) : stdio uniquement, aucune fenêtre. */
const MCP_MODE = process.argv.includes('--mcp')
let busy = false
const engine = new RuleEngine()

function sendEvent(ev: AppEvent): void {
  if (win && !win.isDestroyed()) win.webContents.send('app:event', ev)
}

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  try {
    const snap: Snapshot = await collectSnapshot()
    setLastSnapshot(snap)
    if (win && !win.isDestroyed()) win.webContents.send('metrics:snapshot', snap)
    const store = getStore()
    const fires = engine.update(store.rules, snap, Date.now())
    for (const { rule, value } of fires) {
      const detail = `${rule.metric} = ${value} (seuil ${rule.op} ${rule.threshold})`
      audit('Règle déclenchée', rule.name, 'ok', detail)
      if (rule.action.type === 'notify') {
        try {
          new Notification({ title: `SysMaster — ${rule.name}`, body: `${rule.action.title}\n${detail}` }).show()
        } catch {
          // notifications indisponibles : le toast reste visible dans l'app
        }
        sendEvent({ kind: 'règle', text: `${rule.name} : ${detail}`, level: 'warn' })
      } else {
        sendEvent({ kind: 'règle', text: `${rule.name} → exécution de la macro…`, level: 'warn' })
        void runMacro({ macroId: rule.action.macroId }, `Règle « ${rule.name} »`).then((r) => {
          if (!r.ok) sendEvent({ kind: 'toast', text: `Macro déclenchée par règle échouée : ${r.error ?? ''}`, level: 'error' })
        })
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    sendEvent({ kind: 'toast', text: `Erreur de collecte : ${msg}`, level: 'error' })
  } finally {
    busy = false
  }
}

export function restartPolling(refreshMs: number): void {
  if (timer) clearInterval(timer)
  timer = setInterval(() => void tick(), refreshMs)
  void tick()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0f17',
    title: 'SysMaster — Console de contrôle',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })
  win.on('ready-to-show', () => win?.show())
  win.on('closed', () => {
    console.log('[sysmaster] fenêtre fermée')
    win = null
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.log(`[sysmaster] webContents renderer gone : ${details.reason}`)
  })
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

const CSP = [
  "default-src 'self'",
  // En dev, Vite injecte un script inline (react-refresh) que la CSP stricte bloquerait.
  process.env.ELECTRON_RENDERER_URL
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:"
].join('; ')

app.whenReady().then(() => {
  if (MCP_MODE) {
    // Serveur MCP : JSON-RPC sur stdio, pas de fenêtre ni de polling.
    void startMcpServer()
    return
  }
  // Diagnostics : toute fermeture anormale est tracée dans le terminal de dev.
  app.on('render-process-gone', (_e, _win, details) => {
    console.log(`[sysmaster] renderer gone : ${details.reason} (code ${details.exitCode})`)
  })
  app.on('child-process-gone', (_e, details) => {
    console.log(`[sysmaster] child gone : ${details.type} — ${details.reason} (code ${details.exitCode})`)
  })
  app.on('quit', (_e, code) => console.log(`[sysmaster] quit (code ${code})`))
  process.on('exit', (code) => console.log(`[sysmaster] processus principal sorti (code ${code})`))
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } })
  })
  createWindow()
  registerIpc((settings: Settings) => restartPolling(settings.refreshMs))
  restartPolling(getStore().settings.refreshMs)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !MCP_MODE) app.quit()
})
