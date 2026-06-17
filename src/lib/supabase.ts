import { createClient } from '@supabase/supabase-js'

// Vercel 粘贴环境变量时可能带入首尾空格或换行，trim 避免密钥失效
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey !== 'placeholder' &&
    !supabaseAnonKey.includes('你的_')
)

if (!isSupabaseConfigured) {
  console.error(
    'Supabase 未配置：请复制 web-app/.env.example 为 .env，并填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY（与 iOS SupabaseConfig.swift 相同）'
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
