import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** HTTP 请求头只能含 ISO-8859-1；密钥里若有中文会导致 fetch 直接崩溃 */
function hasNonAscii(value: string): boolean {
  return /[^\x20-\x7E]/.test(value)
}

/** 诊断环境变量问题，供登录页展示 */
export function getSupabaseEnvIssue(): string | null {
  if (!rawSupabaseUrl || !rawSupabaseAnonKey) {
    return '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 环境变量'
  }
  if (rawSupabaseUrl.includes('placeholder') || rawSupabaseAnonKey === 'placeholder') {
    return 'Supabase 仍为占位符配置，请填入真实 URL 和 anon key'
  }
  if (rawSupabaseAnonKey.includes('你的_')) {
    return 'VITE_SUPABASE_ANON_KEY 仍是示例文字「你的_supabase_anon_key」，请改成真实密钥'
  }
  if (hasNonAscii(rawSupabaseAnonKey)) {
    return 'VITE_SUPABASE_ANON_KEY 含有中文或特殊字符。请删除后重新粘贴，只粘 eyJ 开头的一整串英文密钥'
  }
  if (hasNonAscii(rawSupabaseUrl)) {
    return 'VITE_SUPABASE_URL 含有非法字符，请检查 Vercel 环境变量'
  }
  if (!rawSupabaseAnonKey.startsWith('eyJ')) {
    return 'VITE_SUPABASE_ANON_KEY 格式不对，应以 eyJ 开头（从 Supabase → Settings → API 复制 anon public key）'
  }
  if (!rawSupabaseUrl.startsWith('https://') || !rawSupabaseUrl.includes('supabase.co')) {
    return 'VITE_SUPABASE_URL 格式不对，应为 https://xxx.supabase.co'
  }
  return null
}

export const supabaseEnvIssue = getSupabaseEnvIssue()

export const isSupabaseConfigured = supabaseEnvIssue === null

const supabaseUrl = rawSupabaseUrl
const supabaseAnonKey = rawSupabaseAnonKey

if (!isSupabaseConfigured) {
  console.error('Supabase 配置异常：', supabaseEnvIssue)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
