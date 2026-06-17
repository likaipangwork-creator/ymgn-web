import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabaseEnvIssue } from '../lib/supabase'

export function LoginPage() {
  const { session, signIn, isLoading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await signIn(username, password)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__hero">
          <AppIcon size={56} className="login-card__icon" />
          <h1>驿马光年</h1>
          <p className="muted">专业器材租赁管理系统</p>
        </div>

        {!isSupabaseConfigured ? (
          <p className="error-text">
            {supabaseEnvIssue ?? '未检测到 Supabase 配置。'}
            {import.meta.env.PROD
              ? ' 请在 Vercel → Settings → Environment Variables 修正后 Redeploy。'
              : ' 请在 web-app/.env 填入正确配置后重新运行 npm run dev。'}
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label>
            用户名
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="login-note">仅限驿马光年内部使用</p>
      </div>
    </div>
  )
}
