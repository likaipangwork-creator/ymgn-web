import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
