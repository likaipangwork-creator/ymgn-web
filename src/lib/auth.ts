export const SUPER_ADMIN_USERNAME = '庞力恺'
export const AUTH_EMAIL_DOMAIN = 'rentalapp.com'

/**
 * 与 iOS AuthManager.usernameToEmail 一致：
 * username.addingPercentEncoding(withAllowedCharacters: .alphanumerics)
 * 非字母数字的字符按 UTF-8 百分号编码（大写十六进制）
 */
export function swiftUsernameToEmail(username: string): string {
  let encoded = ''
  for (const char of username) {
    if (/^[\p{L}\p{N}]$/u.test(char)) {
      encoded += char
    } else {
      for (const byte of new TextEncoder().encode(char)) {
        encoded += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
      }
    }
  }
  return `${encoded}@${AUTH_EMAIL_DOMAIN}`
}

/** 登录时尝试的邮箱候选（兼容不同版本 App 注册的账号） */
export function emailCandidatesForUsername(username: string): string[] {
  const seen = new Set<string>()
  const add = (email: string) => {
    if (email && !seen.has(email)) seen.add(email)
  }

  // iOS signIn 不 trim，与 createAccount 会 trim — 两种都试
  add(swiftUsernameToEmail(username))
  add(swiftUsernameToEmail(username.trim()))

  // 旧版或未编码的特殊字符账号
  add(`${username}@${AUTH_EMAIL_DOMAIN}`)
  add(`${username.trim()}@${AUTH_EMAIL_DOMAIN}`)

  // 整段 encodeURIComponent（极少数历史账号）
  const fullyEncoded = encodeURIComponent(username.trim())
  if (fullyEncoded !== username.trim()) {
    add(`${fullyEncoded}@${AUTH_EMAIL_DOMAIN}`)
  }

  return [...seen]
}

/** @deprecated 使用 swiftUsernameToEmail */
export function usernameToEmail(username: string): string {
  return swiftUsernameToEmail(username.trim())
}

/** 与 iOS AuthManager.emailToUsername 保持一致 */
export function emailToUsername(email: string): string {
  const raw = email.replace(new RegExp(`@${AUTH_EMAIL_DOMAIN}$`, 'i'), '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function usernameFromAuthUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}): string {
  const meta = user.user_metadata
  const fromMeta =
    (typeof meta?.username === 'string' && meta.username) ||
    (typeof meta?.full_name === 'string' && meta.full_name)
  if (fromMeta) return fromMeta
  if (user.email) return emailToUsername(user.email)
  return ''
}
