import type { Ingredient, ParsedReceiptItem } from '../types'

const TESSERACT_VERSION = '5.1.1'

const SKIP_WORDS = [
  'total',
  'subtotal',
  'sub total',
  'cambio',
  'vuelto',
  'efectivo',
  'tarjeta',
  'itbms',
  'impuesto',
  'descuento',
  'ahorro',
  'balance',
  'recibido',
  'propina',
  'factura',
  'fecha',
  'cliente',
  'cajero',
  'ruc',
  'dv',
  'autorizacion',
  'tarjeta',
  'visa',
  'mastercard',
  'clave',
]

/** Lee una foto de factura con Tesseract (OCR en el navegador, sin servidor). */
export async function scanInvoice(
  file: File,
  onProgress: (progress: number, status: string) => void,
): Promise<{ text: string; items: ParsedReceiptItem[] }> {
  const { createWorker } = await import('tesseract.js')
  onProgress(0, 'Preparando el lector…')

  const worker = await createWorker('spa', 1, {
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
    corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`,
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress(m.progress, 'Leyendo la factura…')
      }
    },
  })

  try {
    const { data } = await worker.recognize(file)
    return { text: data.text, items: parseReceipt(data.text) }
  } finally {
    await worker.terminate()
  }
}

export function parseReceipt(text: string): ParsedReceiptItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2)

  const priceAtEnd = /(\d{1,4}[.,]\d{2})\s*(?:[a-z]{0,3})?$/
  const items: ParsedReceiptItem[] = []
  const seen = new Set<string>()

  for (const raw of lines) {
    const normalizedLine = normalize(raw)
    if (SKIP_WORDS.some((word) => normalizedLine.includes(word))) continue

    const match = raw.match(priceAtEnd)
    if (!match) continue

    const price = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(price) || price <= 0 || price > 2000) continue

    let name = raw.slice(0, match.index).trim()
    name = name
      .replace(/^[#*\-\s]+/, '')
      .replace(/^\d+([.,]\d+)?\s*(x|u|un|und|lb|kg|g|ml|oz)?\s+/i, '')
      .replace(/[$]/g, '')
      .trim()

    if (name.replace(/[^a-záéíóúñ]/gi, '').length < 3) continue

    const key = `${normalize(name)}-${price}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ name: titleCase(name), price, raw })
  }

  return items.slice(0, 40)
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP_WORDS = new Set(['de', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'en', 'para', 'del'])

function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

/** Busca el ingrediente que mejor coincide con un texto de factura. */
export function matchIngredient(text: string, ingredients: Ingredient[]): Ingredient | undefined {
  const textTokens = tokens(text)
  if (textTokens.length === 0) return undefined
  let best: { ingredient: Ingredient; score: number } | undefined

  for (const ingredient of ingredients) {
    const ingTokens = tokens(ingredient.name)
    if (ingTokens.length === 0) continue
    const hits = ingTokens.filter((t) => textTokens.some((tt) => tt === t || tt.startsWith(t) || t.startsWith(tt)))
    const score = hits.length / ingTokens.length
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { ingredient, score }
    }
  }

  return best?.ingredient
}

function titleCase(text: string): string {
  const lower = text.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
