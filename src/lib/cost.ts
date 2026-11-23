import type { Ingredient, PackagingItem, Recipe, RecipeLine, Settings } from '../types'
import { ceilToStep, round2, toBase } from './units'

export interface LineCost {
  line: RecipeLine
  ingredient?: Ingredient
  baseQty: number | null
  cost: number
  ok: boolean
  error?: string
}

export interface PackagingLineCost {
  item: PackagingItem
  /** Costo de empaque por unidad vendida. */
  perUnit: number
  /** Costo de esa línea para la tanda escalada. */
  total: number
}

export interface RecipeCost {
  factor: number
  units: number
  lines: LineCost[]
  ingredientsCost: number
  mermaCost: number
  laborCost: number
  packagingCost: number
  packagingLines: PackagingLineCost[]
  extraCost: number
  overhead: number
  totalCost: number
  costPerUnit: number
  pricePreTax: number
  itbmsAmount: number
  finalPrice: number
  profitPerUnit: number
  marginRealPct: number
  markupPct: number
  totalRevenue: number
  totalProfit: number
  missingPrices: string[]
  missingConversions: string[]
  totalWeightG: number
  weightUnits: number | null
}

export function money(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function moneyPrecise(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0.00'
  if (Math.abs(n) >= 0.1) return money(n)
  if (Math.abs(n) >= 0.01) return money(n, 3)
  return money(n, 4)
}

export function percent(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('es-PA', { maximumFractionDigits: decimals })}%`
}

export function pricePerBase(ing: Ingredient): number {
  if (ing.free) return 0
  const base = toBase(ing.packQty, ing.packUnit, ing)
  if (!base || base <= 0 || ing.packPrice <= 0) return 0
  return ing.packPrice / base
}

/** Precio legible de referencia: "$12.60/kg", "$0.19/u"… */
export function pricePerBaseLabel(ing: Ingredient): string {
  if (ing.free) return 'Sin costo'
  const per = pricePerBase(ing)
  if (per <= 0) return 'Sin precio'
  if (ing.baseUnit === 'g') return `${money(per * 1000)}/kg`
  if (ing.baseUnit === 'ml') return `${money(per * 1000)}/L`
  return `${money(per)}/u`
}

/** Costo de una línea de receta, sin merma extra del ingrediente. */
export function lineCost(line: RecipeLine, ingredients: Ingredient[], factor = 1): LineCost {
  const ingredient = ingredients.find((i) => i.id === line.ingredientId)
  if (!ingredient) {
    return { line, baseQty: null, cost: 0, ok: false, error: 'Ingrediente eliminado' }
  }
  const baseQty = toBase(line.qty * factor, line.unit, ingredient)
  if (baseQty === null) {
    return {
      line,
      ingredient,
      baseQty: null,
      cost: 0,
      ok: false,
      error: 'Falta la equivalencia de esta unidad',
    }
  }
  const cost = baseQty * pricePerBase(ingredient) * (1 + (ingredient.wastePct || 0) / 100)
  return { line, ingredient, baseQty, cost, ok: true }
}

export function computeRecipeCost(
  recipe: Recipe,
  ingredients: Ingredient[],
  settings: Settings,
  factor = 1,
): RecipeCost {
  const safeFactor = adjustFactor(factor)
  const units = recipe.yieldQty * safeFactor
  const lines = recipe.lines.map((l) => lineCost(l, ingredients, safeFactor))

  const ingredientsCost = lines.reduce((sum, l) => sum + l.cost, 0)
  const mermaCost = ingredientsCost * ((recipe.mermaPct || 0) / 100)

  const laborRate = recipe.laborRate ?? settings.laborRatePerHour
  const laborCost = (recipe.laborMinutes / 60) * laborRate * safeFactor
  const packagingPerUnit = recipe.packagingPerUnit ?? settings.packagingPerUnit
  const packagingItems = recipe.packagingItems ?? []
  const packagingLines: PackagingLineCost[] = packagingItems.map((item) => {
    const covers = item.coversUnits > 0 ? item.coversUnits : 1
    const perUnit = item.packPrice > 0 ? item.packPrice / covers : 0
    return { item, perUnit, total: perUnit * units }
  })
  const packagingCost =
    packagingLines.length > 0
      ? packagingLines.reduce((sum, line) => sum + line.total, 0)
      : packagingPerUnit * units
  const extraCost = (recipe.extraCostPerBatch || 0) * safeFactor

  const subtotal = ingredientsCost + mermaCost + laborCost + packagingCost + extraCost
  const overhead = subtotal * ((settings.overheadPct || 0) / 100)
  const totalCost = subtotal + overhead
  const costPerUnit = units > 0 ? totalCost / units : 0

  const margin = Math.min(recipe.marginPct ?? settings.defaultMarginPct, 94)
  const taxRate = recipe.itbms ? settings.itbmsRate / 100 : 0

  let finalPriceExact: number
  if (recipe.priceMode === 'manual' && recipe.manualPrice && recipe.manualPrice > 0) {
    finalPriceExact = recipe.manualPrice
  } else {
    const preTax = costPerUnit / (1 - margin / 100)
    finalPriceExact = preTax * (1 + taxRate)
  }

  const step = settings.rounding === 'none' ? 0 : Number(settings.rounding)
  const finalPrice = step > 0 ? round2(ceilToStep(finalPriceExact, step)) : round2(finalPriceExact)
  const pricePreTax = taxRate > 0 ? finalPrice / (1 + taxRate) : finalPrice
  const itbmsAmount = finalPrice - pricePreTax
  const profitPerUnit = pricePreTax - costPerUnit
  const marginRealPct = pricePreTax > 0 ? (profitPerUnit / pricePreTax) * 100 : 0
  const markupPct = costPerUnit > 0 ? (profitPerUnit / costPerUnit) * 100 : 0

  const missingPrices = [
    ...new Set(
      lines
        .filter((l) => l.ingredient && !l.ingredient.free && pricePerBase(l.ingredient) <= 0)
        .map((l) => l.ingredient!.name),
    ),
  ]
  const missingConversions = [
    ...new Set(lines.filter((l) => l.baseQty === null && l.ingredient).map((l) => l.ingredient!.name)),
  ]

  const totalWeightG = lines.reduce((sum, l) => {
    if (!l.ingredient || l.baseQty === null) return sum
    if (l.ingredient.baseUnit === 'g' || l.ingredient.baseUnit === 'ml') return sum + l.baseQty
    return sum
  }, 0)
  const weightUnits =
    recipe.pieceGrams && recipe.pieceGrams > 0 && totalWeightG > 0
      ? Math.round(totalWeightG / recipe.pieceGrams)
      : null

  return {
    factor: safeFactor,
    units,
    lines,
    ingredientsCost,
    mermaCost,
    laborCost,
    packagingCost,
    packagingLines,
    extraCost,
    overhead,
    totalCost,
    costPerUnit,
    pricePreTax,
    itbmsAmount,
    finalPrice,
    profitPerUnit,
    marginRealPct,
    markupPct,
    totalRevenue: finalPrice * units,
    totalProfit: profitPerUnit * units,
    missingPrices,
    missingConversions,
    totalWeightG,
    weightUnits,
  }
}

export function adjustFactor(factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) return 1
  return factor
}

export function batchPlan(recipe: Recipe, targetUnits: number) {
  const factor = recipe.yieldQty > 0 ? Math.max(0.1, targetUnits / recipe.yieldQty) : 1
  const wholeBatches = Math.max(1, Math.ceil(factor - 1e-6))
  return {
    factor,
    units: recipe.yieldQty * factor,
    wholeBatches,
    wholeUnits: recipe.yieldQty * wholeBatches,
    leftoverUnits: recipe.yieldQty * wholeBatches - targetUnits,
  }
}
