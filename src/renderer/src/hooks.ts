import { useCallback, useEffect, useState } from 'react'
import { useApp } from './store'

/**
 * Charge une donnée via un canal IPC autorisé, avec rechargement manuel
 * et rafraîchissement optionnel périodique.
 */
export function useChannel<T>(
  channel: string,
  opts?: { payload?: unknown; intervalMs?: number }
): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const payload = opts?.payload
  const payloadKey = JSON.stringify(payload ?? null)
  const intervalMs = opts?.intervalMs

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const d = await useApp.getState().call<T>(channel, payload)
      if (!alive) return
      if (d !== null) setData(d)
      setLoading(false)
    }
    void load()
    const id = intervalMs ? window.setInterval(() => void load(), intervalMs) : undefined
    return () => {
      alive = false
      if (id !== undefined) window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, payloadKey, intervalMs, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, reload }
}
