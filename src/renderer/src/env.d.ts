import type { AppEvent, Snapshot } from '@shared/types'

export interface SysmasterApi {
  invoke(channel: string, payload?: unknown): Promise<unknown>
  onSnapshot(cb: (s: Snapshot) => void): () => void
  onEvent(cb: (e: AppEvent) => void): () => void
}

declare global {
  interface Window {
    sysmaster: SysmasterApi
  }
}

export {}
