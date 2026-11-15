import type { Ingredient, Recipe, Settings } from '../types'
import { money } from './cost'
import { formatCookQty, unitLabel } from './units'

const EMOJI: Record<Recipe['category'], string> = {
  galletas: '🍪',
  postres: '🍰',
  muffins: '🧁',
  saludables: '🌿',
  pizza: '🍕',
  salados: '🥖',
  otros: '🥐',
}

export function buildCaption(
  recipe: Recipe,
  settings: Settings,
  ingredients: Ingredient[],
  price: number,
): string {
  const emoji = EMOJI[recipe.category] ?? '🧁'
  const lines: string[] = []

  lines.push(`${emoji} ${recipe.name}`)
  if (recipe.description) lines.push(recipe.description)
  lines.push('')

  if (price > 0) {
    const tax = recipe.itbms ? ' · ITBMS incluido' : ''
    lines.push(`💵 ${money(price)} por ${singular(recipe.yieldLabel)}${tax}`)
  }
  lines.push(`📦 Rinde ${formatCookQty(recipe.yieldQty)} ${recipe.yieldLabel}`)

  const bake: string[] = []
  if (recipe.bake.tempC) bake.push(`${recipe.bake.tempC} °C`)
  if (recipe.bake.minutes) bake.push(`${recipe.bake.minutes} min`)
  if (bake.length) lines.push(`🔥 Horneado a ${bake.join(' · ')}`)

  lines.push('')
  lines.push('Ingredientes:')
  for (const line of recipe.lines) {
    const ing = ingredients.find((i) => i.id === line.ingredientId)
    if (!ing) continue
    lines.push(`• ${formatCookQty(line.qty)} ${unitLabel(line.unit, ing)} ${ing.name}`)
  }

  lines.push('')
  const contact = settings.instagram
    ? settings.instagram.startsWith('@')
      ? settings.instagram
      : `@${settings.instagram}`
    : ''
  lines.push(`📲 Pide el tuyo por DM${contact ? ` ${contact}` : ''}`)
  if (settings.whatsapp) lines.push(`WhatsApp: ${settings.whatsapp}`)

  const tags = new Set<string>()
  for (const tag of recipe.tags) {
    const clean = tag
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
    if (clean) tags.add(`#${clean}`)
  }
  tags.add('#reposteriacasera')
  tags.add('#hechoencasa')
  tags.add('#panama')
  tags.add(`#${settings.businessName.replace(/[^a-zA-Z0-9]/g, '')}`)

  lines.push('')
  lines.push([...tags].join(' '))

  return lines.join('\n').trim()
}

function singular(label: string): string {
  if (!label) return 'unidad'
  return label.endsWith('s') ? label.slice(0, -1) : label
}
