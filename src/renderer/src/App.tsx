import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { fmtRate, fmtUptime, loadClass } from './components/ui'
import { ConfirmHost, Toasts } from './components/overlays'
import { initApp, useApp } from './store'
import Audit from './pages/Audit'
import Apps from './pages/Apps'
import CpuMem from './pages/CpuMem'
import Docker from './pages/Docker'
import Gallery from './pages/Gallery'
import Journal from './pages/Journal'
import Macros from './pages/Macros'
import Network from './pages/Network'
import Overview from './pages/Overview'
import Processes from './pages/Processes'
import Rules from './pages/Rules'
import Sensors from './pages/Sensors'
import Services from './pages/Services'
import Settings from './pages/Settings'
import Storage from './pages/Storage'
import Users from './pages/Users'

interface NavItem {
  id: string
  label: string
  icon: string
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Pilotage',
    items: [
      { id: 'overview', label: "Vue d'ensemble", icon: '◱' },
      { id: 'gallery', label: 'Galerie de widgets', icon: '▦' },
      { id: 'rules', label: 'Règles automatiques', icon: '⚡' },
      { id: 'macros', label: 'Macros', icon: '▶' }
    ]
  },
  {
    section: 'Surveillance',
    items: [
      { id: 'cpumem', label: 'Processeur & Mémoire', icon: '▤' },
      { id: 'storage', label: 'Stockage', icon: '▣' },
      { id: 'network', label: 'Réseau', icon: '⇅' },
      { id: 'sensors', label: 'Températures & GPU', icon: '◌' },
      { id: 'journal', label: 'Journal système', icon: '¶' }
    ]
  },
  {
    section: 'Contrôle',
    items: [
      { id: 'processes', label: 'Processus', icon: '⋔' },
      { id: 'services', label: 'Services', icon: '⚙' },
      { id: 'apps', label: 'Applications', icon: '◈' },
      { id: 'docker', label: 'Docker', icon: '⬙' },
      { id: 'users', label: 'Utilisateurs', icon: '☺' }
    ]
  },
  {
    section: 'Système',
    items: [
      { id: 'audit', label: "Journal d'audit", icon: '✓' },
      { id: 'settings', label: 'Paramètres', icon: '⚒' }
    ]
  }
]

const PAGES: Record<string, ComponentType> = {
  overview: Overview,
  gallery: Gallery,
  rules: Rules,
  macros: Macros,
  cpumem: CpuMem,
  storage: Storage,
  network: Network,
  sensors: Sensors,
  journal: Journal,
  processes: Processes,
  services: Services,
  apps: Apps,
  docker: Docker,
  users: Users,
  audit: Audit,
  settings: Settings
}

export default function App() {
  const page = useApp((s) => s.page)
  const setPage = useApp((s) => s.setPage)
  const snapshot = useApp((s) => s.snapshot)
  const data = useApp((s) => s.data)

  useEffect(initApp, [])

  const label = NAV.flatMap((s) => s.items).find((i) => i.id === page)?.label ?? 'SysMaster'
  const Page = PAGES[page] ?? Overview

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">SM</div>
          <div>
            <div className="brand-name">SysMaster</div>
            <div className="brand-sub">Console de contrôle</div>
          </div>
        </div>
        <nav>
          {NAV.map((sec) => (
            <div key={sec.section}>
              <div className="nav-section">{sec.section}</div>
              {sec.items.map((it) => (
                <div
                  key={it.id}
                  className={`nav-item${page === it.id ? ' active' : ''}`}
                  onClick={() => setPage(it.id)}
                >
                  <span className="nav-icon">{it.icon}</span>
                  {it.label}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          {snapshot ? `${snapshot.hostname} · ${snapshot.platform}` : 'Connexion au système…'}
          {data?.settings.expertMode && <div className="expert-badge">MODE EXPERT ACTIF</div>}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{label}</div>
          <div className="chips">
            {snapshot && (
              <>
                <span className={`chip ${loadClass(snapshot.cpu.load)}`}>CPU {snapshot.cpu.load}%</span>
                <span className={`chip ${loadClass(snapshot.mem.usedPct)}`}>RAM {snapshot.mem.usedPct}%</span>
                <span className="chip">↑ {fmtRate(snapshot.netRxTotal)}</span>
                <span className="chip">↓ {fmtRate(snapshot.netTxTotal)}</span>
                <span className="chip">⏱ {fmtUptime(snapshot.uptime)}</span>
              </>
            )}
          </div>
          <div className="topbar-host">{snapshot ? `${snapshot.cpu.brand} · ${snapshot.cpu.cores.length} cœurs` : ''}</div>
        </header>
        <main className="content">
          <Page />
        </main>
      </div>
      <ConfirmHost />
      <Toasts />
    </div>
  )
}
