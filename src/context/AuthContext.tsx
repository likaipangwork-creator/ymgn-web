import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchAdminUsernames } from '../lib/admins'
import {
  SUPER_ADMIN_USERNAME,
  emailCandidatesForUsername,
  usernameFromAuthUser,
} from '../lib/auth'
import { isSupabaseConfigured, supabase, supabaseEnvIssue } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  username: string
  isLoading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  error: string | null
  signIn: (username: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  refreshAdmins: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [username, setUsername] = useState('')
  const [adminUsernames, setAdminUsernames] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshAdmins = useCallback(async () => {
    const names = await fetchAdminUsernames()
    setAdminUsernames(names)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const current = data.session
      setSession(current)
      if (current?.user) {
        setUsername(usernameFromAuthUser(current.user))
      }
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUsername(next?.user ? usernameFromAuthUser(next.user) : '')
    })

    refreshAdmins()

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [refreshAdmins])

  const signIn = useCallback(async (inputUsername: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const candidates = emailCandidatesForUsername(inputUsername)
      const passwordVariants = [password]
      const trimmedPassword = password.trim()
      if (trimmedPassword && trimmedPassword !== password) {
        passwordVariants.push(trimmedPassword)
      }
      let lastError: string | null = null

      const tryLogin = async (pwd: string) => {
        for (const email of candidates) {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: pwd,
          })
          if (!signInError && data.session) {
            setSession(data.session)
            setUsername(usernameFromAuthUser(data.user))
            await refreshAdmins()
            return true
          }
          lastError = signInError?.message ?? null
          const err = (lastError ?? '').toLowerCase()
          // 仅「凭证错误」时尝试下一种邮箱格式；其它错误直接退出
          if (
            lastError &&
            !err.includes('invalid login credentials') &&
            !err.includes('invalid_credentials')
          ) {
            return false
          }
        }
        return false
      }

      for (const pwd of passwordVariants) {
        if (await tryLogin(pwd)) return true
        const err = (lastError ?? '').toLowerCase()
        if (
          lastError &&
          !err.includes('invalid login credentials') &&
          !err.includes('invalid_credentials')
        ) {
          break
        }
      }

      const err = (lastError ?? '').toLowerCase()
      if (err.includes('failed to fetch') || err.includes('network')) {
        setError('无法连接服务器，请检查网络或 Supabase 配置')
      } else if (err.includes('invalid api key') || err.includes('api key')) {
        setError('Supabase 密钥配置错误。请在 Vercel 环境变量中检查 VITE_SUPABASE_ANON_KEY，保存后重新部署')
      } else if (!isSupabaseConfigured && supabaseEnvIssue) {
        setError(supabaseEnvIssue)
      } else if (!isSupabaseConfigured) {
      } else if (err.includes('email not confirmed')) {
        setError('邮箱尚未验证，请联系管理员在 Supabase 后台确认账号')
      } else if (
        err.includes('invalid login credentials') ||
        err.includes('invalid_credentials')
      ) {
        setError('用户名或密码错误')
      } else if (lastError) {
        setError(`登录失败：${lastError}`)
      } else {
        setError('用户名或密码错误')
      }
      return false
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      const lower = message.toLowerCase()
      if (lower.includes('iso-8859-1') || lower.includes('non iso')) {
        setError(
          'Supabase 密钥含有非法字符（常见于误粘中文）。请在 Vercel 删除 VITE_SUPABASE_ANON_KEY，重新只粘贴 eyJ 开头的英文密钥，然后 Redeploy'
        )
      } else if (supabaseEnvIssue) {
        setError(supabaseEnvIssue)
      } else if (lower.includes('fetch')) {
        setError('无法连接服务器，请检查网络和 Supabase 配置')
      } else {
        setError('登录失败，请稍后重试')
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [refreshAdmins])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUsername('')
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const isSuperAdmin = username === SUPER_ADMIN_USERNAME
    const isAdmin = isSuperAdmin || adminUsernames.includes(username)
    return {
      session,
      username,
      isLoading,
      isAdmin,
      isSuperAdmin,
      error,
      signIn,
      signOut,
      refreshAdmins,
    }
  }, [session, username, isLoading, adminUsernames, error, signIn, signOut, refreshAdmins])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
