import { supabase } from './supabase'

export async function fetchAdminUsernames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('app_admins')
    .select('username')
    .order('username', { ascending: true })

  if (error) {
    console.warn('加载管理员列表失败', error)
    return []
  }
  return (data ?? []).map((row) => String((row as { username: string }).username))
}
