import { useState, type FormEvent } from 'react'
import { ADMIN_ACTION_PASSWORD } from '../lib/password'

interface PasswordModalProps {
  open: boolean
  title?: string
  message?: string
  onConfirm: () => void
  onCancel: () => void
}

export function PasswordModal({
  open,
  title = '需要验证',
  message = '请输入操作密码以继续',
  onConfirm,
  onCancel,
}: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== ADMIN_ACTION_PASSWORD) {
      setError('密码错误')
      return
    }
    setPassword('')
    setError(null)
    onConfirm()
  }

  const handleCancel = () => {
    setPassword('')
    setError(null)
    onCancel()
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="password-modal-title">{title}</h3>
        <p className="muted">{message}</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            操作密码
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              autoFocus
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              确认
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
