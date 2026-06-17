const CHINESE_DATETIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
}

/** Matches iOS DateFormatter.chineseDateTime: yyyy年MM月dd日 HH:mm */
export function formatChineseDateTime(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : parseSupabaseDate(value)
  if (!date || Number.isNaN(date.getTime())) return String(value)
  const parts = new Intl.DateTimeFormat('zh-CN', CHINESE_DATETIME_FORMAT).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}年${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')}`
}

/** Parse Supabase / ISO date strings (with or without fractional seconds). */
export function parseSupabaseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct
  const posix = value
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d*/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00')
  const parsed = new Date(posix)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Serialize a Date to ISO 8601 with fractional seconds (matches iOS OAReportDB). */
export function toISOString(date: Date): string {
  return date.toISOString()
}
