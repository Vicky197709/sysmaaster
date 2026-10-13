import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { AuditEntry } from '../shared/types'

const MAX_ENTRIES = 500

function auditPath(): string {
  return path.join(app.getPath('userData'), 'sysmaster-audit.json')
}

function load(): AuditEntry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(auditPath(), 'utf8'))
    if (Array.isArray(raw)) return raw as AuditEntry[]
  } catch {
    // premier démarrage
  }
  return []
}

/** Journal append-only : chaque action de contrôle y est horodatée. */
export function audit(action: string, target: string, status: AuditEntry['status'], detail?: string): void {
  try {
    const entries = load()
    entries.unshift({ ts: Date.now(), action, target, status, detail })
    entries.length = Math.min(entries.length, MAX_ENTRIES)
    fs.writeFileSync(auditPath(), JSON.stringify(entries), 'utf8')
  } catch {
    // journalisation best-effort
  }
}

export function listAudit(): AuditEntry[] {
  return load()
}
