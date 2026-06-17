import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

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
          <p className="muted">Web 版 · 与 App 共用同一账号与数据</p>
        </div>

        {!isSupabaseConfigured ? (
          <p className="error-text">
            未检测到 Supabase 配置。
            {import.meta.env.PROD
              ? ' 请在 Vercel → Settings → Environment Variables 添加 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，然后 Redeploy。'
              : ' 请在 web-app 目录创建 .env 文件，填入与 App 相同的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，然后重新运行 npm run dev。'}
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label>
            用户名
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="与 App 相同"
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
              placeholder="至少 6 位"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="login-note">使用与 iOS App 完全相同的账号密码</p>
        {import.meta.env.PROD && isSupabaseConfigured ? (
          <p className="login-note muted">服务器连接已配置</p>
        ) : null}
      </div>
    </div>
  )
}
