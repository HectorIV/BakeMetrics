import type { Ingredient, Recipe, RecipeCategory, Settings } from '../types'
import type { RecipeCost } from './cost'
import { money } from './cost'
import { formatCookQty, trim, unitLabel } from './units'

export type PromoTemplate = 'square' | 'story' | 'card'

export interface PromoOptions {
  recipe: Recipe
  ingredients: Ingredient[]
  cost: RecipeCost
  settings: Settings
  template: PromoTemplate
  price: number
  showPrice: boolean
  showIngredients: boolean
  photo?: string | null
  tagline?: string
}

export const TEMPLATE_INFO: Record<PromoTemplate, { label: string; hint: string; width: number; height: number }> = {
  square: { label: 'Post cuadrado', hint: '1080 × 1080 · feed de Instagram', width: 1080, height: 1080 },
  story: { label: 'Historia', hint: '1080 × 1920 · stories y estados', width: 1080, height: 1920 },
  card: { label: 'Tarjeta de receta', hint: '1080 × 1350 · ingredientes y horneado', width: 1080, height: 1350 },
}

const INK = '#2E1B10'
const CREAM = '#FFF6EA'

export async function renderPromo(options: PromoOptions): Promise<HTMLCanvasElement> {
  const { width, height } = TEMPLATE_INFO[options.template]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No pudimos crear el lienzo')

  const photo = options.photo ? await loadImage(options.photo) : null

  if (options.template === 'card') {
    drawCard(ctx, width, height, options, photo)
  } else {
    drawPost(ctx, width, height, options, photo)
  }

  return canvas
}

/* ------------------------------------------------------------------ */
/* Plantillas de promoción                                             */
/* ------------------------------------------------------------------ */

function drawPost(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: PromoOptions,
  photo: HTMLImageElement | null,
): void {
  const { settings, recipe } = options
  const isStory = options.template === 'story'
  const pad = isStory ? 72 : 64

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, settings.themeColor)
  bg.addColorStop(1, shade(settings.themeColor, -18))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  drawTexture(ctx, width, height, settings.accentColor)

  ctx.strokeStyle = withAlpha(settings.accentColor, 0.55)
  ctx.lineWidth = 3
  roundRect(ctx, 34, 34, width - 68, height - 68, 44)
  ctx.stroke()

  // Encabezado
  ctx.textAlign = 'center'
  ctx.fillStyle = settings.accentColor
  ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif'
  letterspaced(ctx, settings.businessName.toUpperCase(), width / 2, isStory ? 126 : 112, 5)

  // Título
  const titleTop = isStory ? 196 : 172
  const titleWidth = width - pad * 2 - 50
  const titleFont = fitTitle(ctx, recipe.name, titleWidth, isStory ? 94 : 80, 54, isStory ? 3 : 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${titleFont.size}px Georgia, "Times New Roman", serif`
  ctx.textBaseline = 'top'
  let y = titleTop
  for (const line of titleFont.lines) {
    ctx.fillText(line, width / 2, y)
    y += titleFont.size * 1.12
  }

  const categoryLabel = categoryName(recipe.category).toUpperCase()
  ctx.font = '500 24px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = withAlpha('#FFFFFF', 0.66)
  letterspaced(ctx, categoryLabel, width / 2, y + 18, 4)

  // Foto o ilustración
  const artTop = isStory ? 520 : 396
  const artSize = isStory ? 520 : 384
  drawFeature(ctx, width / 2, artTop + artSize / 2, artSize, options, photo)

  // Chips de información
  const chips: string[] = []
  if (recipe.yieldQty > 0) chips.push(`${trim(recipe.yieldQty)} ${recipe.yieldLabel}`)
  if (recipe.bake.tempC) chips.push(`${recipe.bake.tempC} °C`)
  if (recipe.bake.minutes) chips.push(`${recipe.bake.minutes} min`)
  const chipsY = isStory ? 1170 : 838
  drawChips(ctx, width / 2, chipsY, chips, settings.accentColor)

  if (options.showIngredients && isStory) {
    const list = listIngredients(options, options.showPrice ? 4 : 5)
    const startY = isStory ? 1300 : 970
    ctx.textAlign = 'left'
    ctx.font = '400 28px ui-sans-serif, system-ui, sans-serif'
    list.forEach((text, index) => {
      const yy = startY + index * 42
      ctx.fillStyle = withAlpha(settings.accentColor, 0.9)
      ctx.beginPath()
      ctx.arc(150, yy + 10, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = withAlpha('#FFFFFF', 0.88)
      ctx.fillText(truncate(ctx, text, width - 320), 174, yy)
    })
  }

  // Precio
  if (options.showPrice && options.price > 0) {
    const priceY = isStory ? 1560 : 936
    drawPriceBadge(ctx, width / 2, priceY, options.price, recipe.yieldLabel, settings)
    if (isStory) {
      drawCta(ctx, width / 2, 1740, settings)
    }
  } else if (isStory) {
    drawCta(ctx, width / 2, 1620, settings)
  }

  drawSocialFooter(ctx, width, settings, isStory ? 1846 : 1008)
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: PromoOptions,
  photo: HTMLImageElement | null,
): void {
  const { settings, recipe } = options
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, width, height)

  const panelX = 46
  const panelY = 46
  const panelW = width - panelX * 2
  const panelH = height - panelY * 2
  const bg = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH)
  bg.addColorStop(0, settings.themeColor)
  bg.addColorStop(1, shade(settings.themeColor, -20))
  ctx.fillStyle = bg
  roundRect(ctx, panelX, panelY, panelW, panelH, 36)
  ctx.fill()
  drawTexture(ctx, panelX, panelY, settings.accentColor, panelW, panelH)

  const centerX = width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  ctx.fillStyle = settings.accentColor
  ctx.font = '600 24px ui-sans-serif, system-ui, sans-serif'
  letterspaced(ctx, settings.businessName.toUpperCase(), centerX, 108, 5)

  const title = fitTitle(ctx, recipe.name, panelW - 120, 64, 44, 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${title.size}px Georgia, "Times New Roman", serif`
  let y = 162
  for (const line of title.lines) {
    ctx.fillText(line, centerX, y)
    y += title.size * 1.1
  }

  ctx.strokeStyle = withAlpha(settings.accentColor, 0.5)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(centerX - 70, y + 12)
  ctx.lineTo(centerX + 70, y + 12)
  ctx.stroke()

  // Ingredientes
  const lines = recipe.lines
  const shown = lines.slice(0, 9)
  const listTop = y + 54
  ctx.textAlign = 'left'
  const left = panelX + 104
  const right = panelX + panelW - 80

  shown.forEach((line, index) => {
    const ing = options.ingredients.find((i) => i.id === line.ingredientId)
    const name = ing?.name ?? 'Ingrediente'
    const qty = `${formatCookQty(line.qty)} ${unitLabel(line.unit, ing ?? undefined)}`.trim()
    const yy = listTop + index * 50

    if (index % 2 === 0) {
      ctx.fillStyle = withAlpha('#FFFFFF', 0.06)
      roundRect(ctx, panelX + 68, yy - 8, panelW - 136, 44, 12)
      ctx.fill()
    }

    ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = settings.accentColor
    ctx.textBaseline = 'middle'
    ctx.fillText(qty, left, yy + 14)

    ctx.font = '400 28px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = withAlpha('#FFFFFF', 0.94)
    const qtyWidth = ctx.measureText(qty).width
    ctx.fillText(
      truncate(ctx, name, right - left - qtyWidth - 28),
      left + Math.max(qtyWidth + 28, 190),
      yy + 14,
    )
    ctx.textBaseline = 'top'
  })

  let nextY = listTop + shown.length * 50 + 12
  if (lines.length > shown.length) {
    const rest = lines.length - shown.length
    ctx.font = 'italic 400 24px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = withAlpha('#FFFFFF', 0.7)
    ctx.fillText(`+ ${rest} ${rest === 1 ? 'ingrediente' : 'ingredientes'} más`, left, nextY)
    nextY += 46
  }

  // Horneado
  const bakeParts: string[] = []
  if (recipe.bake.tempC) bakeParts.push(`${recipe.bake.tempC} °C`)
  if (recipe.bake.minutes) bakeParts.push(`${recipe.bake.minutes} min`)
  if (recipe.bake.chillMinutes) bakeParts.push(`frío ${recipe.bake.chillMinutes} min`)
  if (recipe.bake.restMinutes) bakeParts.push(`reposo ${recipe.bake.restMinutes} min`)

  const bakeY = Math.max(nextY + 18, height - 330)
  ctx.fillStyle = withAlpha('#FFFFFF', 0.1)
  roundRect(ctx, panelX + 68, bakeY, panelW - 136, 112, 24)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = settings.accentColor
  ctx.font = '600 22px ui-sans-serif, system-ui, sans-serif'
  letterspaced(ctx, 'HORNEADO', centerX, bakeY + 24, 4)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 34px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(bakeParts.length ? bakeParts.join('   ·   ') : 'Según tu receta', centerX, bakeY + 54)

  if (options.showPrice && options.price > 0) {
    ctx.fillStyle = settings.accentColor
    roundRect(ctx, centerX - 190, bakeY + 132, 380, 74, 37)
    ctx.fill()
    ctx.fillStyle = INK
    ctx.font = '700 36px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${money(options.price)} c/u`, centerX, bakeY + 169)
    ctx.textBaseline = 'top'
  }

  // Pie
  ctx.textAlign = 'center'
  ctx.fillStyle = withAlpha('#FFFFFF', 0.75)
  ctx.font = '400 24px ui-sans-serif, system-ui, sans-serif'
  const contact = contactLine(settings)
  if (contact) ctx.fillText(contact, centerX, height - 132)

  // Foto pequeña opcional en la esquina
  if (photo) {
    const size = 150
    ctx.save()
    ctx.beginPath()
    ctx.arc(panelX + panelW - 120, 126, size / 2, 0, Math.PI * 2)
    ctx.clip()
    drawCover(ctx, photo, panelX + panelW - 120 - size / 2, 126 - size / 2, size, size)
    ctx.restore()
    ctx.strokeStyle = withAlpha(settings.accentColor, 0.8)
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(panelX + panelW - 120, 126, size / 2, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/* ------------------------------------------------------------------ */
/* Piezas reutilizables                                                */
/* ------------------------------------------------------------------ */

function drawFeature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  options: PromoOptions,
  photo: HTMLImageElement | null,
): void {
  if (photo) {
    const w = size
    const h = size * 0.82
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 40)
    ctx.fill()
    ctx.restore()

    ctx.save()
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 30)
    ctx.clip()
    drawCover(ctx, photo, cx - w / 2, cy - h / 2, w, h)
    ctx.restore()
    return
  }

  // Halo
  ctx.fillStyle = withAlpha(options.settings.accentColor, 0.18)
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2)
  ctx.fill()

  drawIllustration(ctx, options.recipe.category, cx, cy, size * 0.74, options.settings)
}

function drawIllustration(
  ctx: CanvasRenderingContext2D,
  category: RecipeCategory,
  cx: number,
  cy: number,
  size: number,
  settings: Settings,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  const s = size / 300
  ctx.scale(s, s)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (category === 'galletas') {
    ctx.fillStyle = '#E7B77F'
    ctx.beginPath()
    ctx.arc(0, 0, 128, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#C98A4B'
    ctx.lineWidth = 8
    ctx.stroke()

    const chips: [number, number, number][] = [
      [-52, -42, 17], [8, -72, 13], [58, -28, 16], [-18, -12, 12], [40, 22, 18],
      [-62, 30, 14], [-8, 62, 15], [72, 66, 12], [6, 18, 11], [-38, 78, 10], [86, 10, 9],
    ]
    ctx.fillStyle = '#4A2A1A'
    for (const [x, y, r] of chips) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.arc(-42, -56, 32, 0, Math.PI * 2)
    ctx.fill()
  } else if (category === 'muffins' || category === 'postres') {
    // Capacillo
    ctx.fillStyle = settings.accentColor
    ctx.beginPath()
    ctx.moveTo(-78, 8)
    ctx.lineTo(78, 8)
    ctx.lineTo(58, 122)
    ctx.lineTo(-58, 122)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 5
    for (let i = -50; i <= 50; i += 25) {
      ctx.beginPath()
      ctx.moveTo(i, 14)
      ctx.lineTo(i * 0.8, 116)
      ctx.stroke()
    }
    // Domo
    ctx.fillStyle = '#E7B77F'
    ctx.beginPath()
    ctx.moveTo(-92, 12)
    ctx.bezierCurveTo(-96, -92, 96, -92, 92, 12)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#C98A4B'
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.fillStyle = '#4A2A1A'
    for (const [x, y, r] of [[-42, -24, 12], [10, -46, 10], [44, -12, 13], [-8, 0, 9], [62, 4, 8]] as const) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (category === 'pizza') {
    ctx.fillStyle = '#E9C18A'
    ctx.beginPath()
    ctx.moveTo(0, -128)
    ctx.lineTo(128, 108)
    ctx.bezierCurveTo(60, 140, -60, 140, -128, 108)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#C98A4B'
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.strokeStyle = '#B45309'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(-128, 108)
    ctx.bezierCurveTo(-60, 140, 60, 140, 128, 108)
    ctx.stroke()
    ctx.fillStyle = '#C0562F'
    for (const [x, y, r] of [[0, 10, 16], [-46, 58, 13], [52, 62, 14], [16, 96, 10]] as const) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (category === 'saludables') {
    ctx.fillStyle = '#7FA37B'
    ctx.beginPath()
    ctx.ellipse(0, 0, 78, 132, Math.PI / 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#5F7F63'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(-58, -96)
    ctx.quadraticCurveTo(28, 10, 58, 108)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 6
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath()
      ctx.moveTo(i * 22 - 6, -40 + i * 6)
      ctx.lineTo(i * 22 + 26, 12 + i * 6)
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = '#E0AE72'
    ctx.beginPath()
    ctx.ellipse(0, 10, 118, 86, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#B77E43'
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 7
    for (const offset of [-40, 0, 40]) {
      ctx.beginPath()
      ctx.moveTo(offset - 30, -40)
      ctx.lineTo(offset + 12, -46)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawChips(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  labels: string[],
  accent: string,
): void {
  if (labels.length === 0) return
  ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif'
  const gap = 16
  const widths = labels.map((l) => ctx.measureText(l).width + 52)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1)
  let x = cx - total / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  labels.forEach((label, i) => {
    const w = widths[i]
    ctx.fillStyle = withAlpha('#FFFFFF', 0.14)
    roundRect(ctx, x, y - 30, w, 60, 30)
    ctx.fill()
    ctx.strokeStyle = withAlpha(accent, 0.4)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, x + w / 2, y + 1)
    x += w + gap
  })
  ctx.textBaseline = 'top'
}

function drawPriceBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  price: number,
  yieldLabel: string,
  settings: Settings,
): void {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.fillStyle = settings.accentColor
  roundRect(ctx, cx - 235, cy - 58, 470, 116, 58)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 58px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(money(price), cx, cy - 6)
  ctx.font = '500 22px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(46,27,16,0.7)'
  ctx.fillText(`por ${singular(yieldLabel)}`, cx, cy + 34)
  ctx.textBaseline = 'top'
}

function drawCta(ctx: CanvasRenderingContext2D, cx: number, y: number, settings: Settings): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = withAlpha('#FFFFFF', 0.92)
  ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif'
  letterspaced(ctx, 'PIDE EL TUYO', cx, y, 6)
  ctx.fillStyle = withAlpha(settings.accentColor, 0.9)
  ctx.font = '500 24px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('Escríbeme por DM para apartar tu pedido', cx, y + 42)
}

function drawSocialFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  settings: Settings,
  y: number,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = withAlpha('#FFFFFF', 0.78)
  ctx.font = '500 24px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(contactLine(settings) || settings.businessName, width / 2, y)
}

function contactLine(settings: Settings): string {
  const parts: string[] = []
  if (settings.instagram.trim()) {
    parts.push(settings.instagram.startsWith('@') ? settings.instagram : `@${settings.instagram}`)
  }
  if (settings.whatsapp.trim()) parts.push(`WhatsApp ${settings.whatsapp}`)
  return parts.join('  ·  ')
}

function listIngredients(options: PromoOptions, max: number): string[] {
  return options.recipe.lines.slice(0, max).map((line) => {
    const ing = options.ingredients.find((i) => i.id === line.ingredientId)
    return `${formatCookQty(line.qty)} ${unitLabel(line.unit, ing ?? undefined)} ${ing?.name ?? ''}`.trim()
  })
}

/* ------------------------------------------------------------------ */
/* Ayudas de dibujo                                                    */
/* ------------------------------------------------------------------ */

function drawTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accent: string,
  width = ctx.canvas.width,
  height = ctx.canvas.height,
): void {
  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.fillStyle = accent
  const size = 4
  for (let i = x + 40; i < x + width - 20; i += 42) {
    for (let j = y + 40; j < y + height - 20; j += 42) {
      ctx.beginPath()
      ctx.arc(i, j, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x + width - 60, y + 40, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function letterspaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
): void {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  const previousAlign = ctx.textAlign
  ctx.textAlign = 'left'
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], x, y)
    x += widths[i] + spacing
  }
  ctx.textAlign = previousAlign
}

function fitTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  maxLines: number,
): { lines: string[]; size: number } {
  let size = startSize
  while (size > minSize) {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`
    const lines = wrap(ctx, text, maxWidth)
    if (lines.length <= maxLines) return { lines, size }
    size -= 4
  }
  ctx.font = `700 ${minSize}px Georgia, "Times New Roman", serif`
  return { lines: wrap(ctx, text, maxWidth).slice(0, maxLines), size: minSize }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 3 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result.trimEnd()}…`
}

function categoryName(category: RecipeCategory): string {
  const names: Record<RecipeCategory, string> = {
    galletas: 'Galletas artesanales',
    postres: 'Postre casero',
    muffins: 'Muffins recién horneados',
    saludables: 'Opciones saludables',
    pizza: 'Pizza casera',
    salados: 'Salado casero',
    otros: 'Hecho en casa',
  }
  return names[category]
}

function singular(label: string): string {
  if (!label) return 'unidad'
  return label.endsWith('s') ? label.slice(0, -1) : label
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = Number.parseInt(full, 16)
  if (Number.isNaN(num)) return { r: 139, g: 69, b: 19 }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  const adjust = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)))
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function sharePromo(
  canvas: HTMLCanvasElement,
  filename: string,
  caption: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No pudimos generar la imagen')

  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text: caption, title: 'Promoción' })
      return 'shared'
    } catch {
      // El usuario canceló o el navegador falló: descargamos.
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
