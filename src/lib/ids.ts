/** 统一 UUID 格式（小写 + 连字符），避免订单与器材表 ID 写法不一致导致匹配失败 */
export function normalizeEntityId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return trimmed
  const cleaned = trimmed.replace(/-/g, '').toLowerCase()
  if (cleaned.length === 32 && /^[0-9a-f]+$/.test(cleaned)) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}-${cleaned.slice(16, 20)}-${cleaned.slice(20)}`
  }
  return trimmed.toLowerCase()
}
