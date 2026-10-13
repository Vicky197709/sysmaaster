import type { ReactNode } from 'react'
import { useApp } from '../store'

export function Modal({
  title,
  onClose,
  children,
  wide
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={wide ? 'modal wide' : 'modal'}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn sm" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmHost() {
  const confirm = useApp((s) => s.confirm)
  const resolve = useApp((s) => s.resolveConfirm)
  if (!confirm) return null
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <h3>{confirm.title}</h3>
        </div>
        <p className="confirm-msg">{confirm.message}</p>
        <div className="modal-actions">
          <button className="btn" onClick={() => resolve(false)}>
            Annuler
          </button>
          <button className={`btn ${confirm.danger ? 'danger' : 'primary'}`} onClick={() => resolve(true)}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const drop = useApp((s) => s.dropToast)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.level}`} onClick={() => drop(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
