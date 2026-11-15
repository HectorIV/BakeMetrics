export function uid(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 9)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}${random}${time}`
}

export function todayISO(): string {
  return new Date().toISOString()
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-PA', { day: 'numeric', month: 'short' })
}
