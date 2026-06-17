const EXTRA_SPACES = /[\u3000\u00A0]/g
const PUNCTUATION = /[\p{P}\p{S}]/gu
const WHITESPACE = /\s/g

function normalize(text: string, keepPunctuation = false): string {
  let result = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(EXTRA_SPACES, '')
    .replace(WHITESPACE, '')
  if (!keepPunctuation) {
    result = result.replace(PUNCTUATION, '')
  }
  return result
}

function containsAllCharacters(query: string, candidate: string): boolean {
  if (!query) return true
  const pool = [...candidate]
  for (const character of query) {
    const index = pool.indexOf(character)
    if (index === -1) return false
    pool.splice(index, 1)
  }
  return true
}

/** Matches iOS EquipmentFuzzySearch.matches */
export function fuzzySearchMatches(
  query: string,
  candidate: string,
  keepPunctuation = false
): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true

  const normalizedCandidate = normalize(candidate, keepPunctuation)
  const normalizedQuery = normalize(trimmed, keepPunctuation)
  if (!normalizedQuery) return true

  if (normalizedCandidate.includes(normalizedQuery)) return true

  const parts = trimmed
    .split(/\s+/)
    .map((part) => normalize(part, keepPunctuation))
    .filter(Boolean)

  if (
    parts.length > 1 &&
    parts.every(
      (part) =>
        normalizedCandidate.includes(part) ||
        containsAllCharacters(part, normalizedCandidate)
    )
  ) {
    return true
  }

  return containsAllCharacters(normalizedQuery, normalizedCandidate)
}

export function equipmentMatchesSearch(
  equipment: {
    name: string
    category: string
    barcode: string
    groupId: string | null
  },
  query: string,
  options: {
    groupLabel: string
    groupDisplayPath?: string
  }
): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  if (fuzzySearchMatches(trimmed, equipment.name)) return true
  if (fuzzySearchMatches(trimmed, equipment.category)) return true
  if (fuzzySearchMatches(trimmed, equipment.barcode, true)) return true
  if (options.groupLabel !== '未分组' && fuzzySearchMatches(trimmed, options.groupLabel)) {
    return true
  }
  if (options.groupDisplayPath && fuzzySearchMatches(trimmed, options.groupDisplayPath)) {
    return true
  }
  return false
}
