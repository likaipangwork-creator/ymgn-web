import { swiftUsernameToEmail } from './auth'
import { SUPER_ADMIN_USERNAME } from './auth'
import { supabase } from './supabase'

/** Super admin creates account without switching session (matches iOS). */
export async function createAccountAsSuperAdmin(
  username: string,
  password: string
): Promise<string | null> {
  const trimmed = username.trim()
  if (!trimmed) return '用户名不能为空'
  if (password.length < 6) return '密码至少 6 位'
  if (trimmed === SUPER_ADMIN_USERNAME) return '该用户名已保留给超级管理员'

  const email = swiftUsernameToEmail(trimmed)
  const { data: sessionData } = await supabase.auth.getSession()
  const previousSession = sessionData.session
  if (!previousSession) return '请先登录'

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: trimmed, full_name: trimmed },
    },
  })

  if (signUpError) {
    const msg = signUpError.message
    if (
      msg.toLowerCase().includes('already registered') ||
      msg.toLowerCase().includes('already exists') ||
      msg.includes('已注册')
    ) {
      return '用户名已存在'
    }
    return msg
  }

  await supabase.auth.signOut()
  const { error: restoreError } = await supabase.auth.setSession({
    access_token: previousSession.access_token,
    refresh_token: previousSession.refresh_token,
  })
  if (restoreError) return `账号已创建，但恢复登录失败：${restoreError.message}`

  return null
}
