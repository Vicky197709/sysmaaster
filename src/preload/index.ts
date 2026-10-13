import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent, Snapshot } from '../shared/types'
import { isAllowedChannel } from '../shared/validation'

const api = {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!isAllowedChannel(channel)) return Promise.reject(new Error(`Canal IPC refusé : ${channel}`))
    return ipcRenderer.invoke(channel, payload)
  },
  onSnapshot(cb: (s: Snapshot) => void): () => void {
    const handler = (_event: unknown, s: Snapshot): void => cb(s)
    ipcRenderer.on('metrics:snapshot', handler)
    return () => ipcRenderer.removeListener('metrics:snapshot', handler)
  },
  onEvent(cb: (e: AppEvent) => void): () => void {
    const handler = (_event: unknown, e: AppEvent): void => cb(e)
    ipcRenderer.on('app:event', handler)
    return () => ipcRenderer.removeListener('app:event', handler)
  }
}

contextBridge.exposeInMainWorld('sysmaster', api)
