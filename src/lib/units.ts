import type { BaseUnit, CustomUnit, StandardUnit } from '../types'

export interface Convertible {
  baseUnit: BaseUnit
  gramsPerCup?: number
  gramsPerTbsp?: number
  gramsPerTsp?: number
  customUnits?: CustomUnit[]
}

export const STANDARD_UNITS: { key: StandardUnit; label: string; hint?: string }[] = [
  { key: 'g', label: 'gramos' },
  { key: 'kg', label: 'kilos' },
  { key: 'oz', label: 'onzas' },
  { key: 'lb', label: 'libras' },
  { key: 'ml', label: 'mililitros' },
  { key: 'l', label: 'litros' },
  { key: 'taza', label: 'tazas' },
  { key: 'cda', label: 'cucharadas' },
  { key: 'cdta', label: 'cucharaditas' },
  { key: 'unidad', label: 'unidades' },
]

const SHORT: Record<StandardUnit, string> = {
  g: 'g',
  kg: 'kg',
  oz: 'oz',
  lb: 'lb',
  ml: 'ml',
  l: 'L',
  taza: 'taza',
  cda: 'cda',
  cdta: 'cdta',
  unidad: 'u',
}

export const UNIT_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: 'g', label: 'gramos (g)', group: 'Peso' },
  { value: 'kg', label: 'kilos (kg)', group: 'Peso' },
  { value: 'oz', label: 'onzas (oz)', group: 'Peso' },
  { value: 'lb', label: 'libras (lb)', group: 'Peso' },
  { value: 'taza', label: 'tazas', group: 'Cocina' },
  { value: 'cda', label: 'cucharadas', group: 'Cocina' },
  { value: 'cdta', label: 'cucharaditas', group: 'Cocina' },
  { value: 'ml', label: 'mililitros (ml)', group: 'Volumen' },
  { value: 'l', label: 'litros (L)', group: 'Volumen' },
  { value: 'unidad', label: 'unidades', group: 'Conteo' },
]

export function isStandardUnit(unit: string): unit is StandardUnit {
  return unit in SHORT
}

export function defaultBaseUnit(unit: string): BaseUnit {
  if (unit === 'ml' || unit === 'l') return 'ml'
  if (unit === 'unidad') return 'unit'
  return 'g'
}

const MASS: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 }
const VOLUME: Record<string, number> = { ml: 1, l: 1000 }

/**
 * Convierte una cantidad a la unidad base del ingrediente.
 * Devuelve null cuando no hay una equivalencia razonable (por ejemplo tazas de un ingrediente que se cuenta por unidades).
 */
export function toBase(qty: number, unit: string, ing: Convertible): number | null {
  if (!Number.isFinite(qty)) return null

  if (unit.startsWith('cu:')) {
    const custom = ing.customUnits?.find((c) => `cu:${c.id}` === unit)
    if (!custom) return null
    return qty * custom.baseQty
  }

  if (!isStandardUnit(unit)) return null

  if (unit in MASS) {
    const grams = qty * MASS[unit]
    if (ing.baseUnit === 'g') return grams
    if (ing.baseUnit === 'ml') return grams // densidad aproximada 1
    return null
  }

  if (unit in VOLUME) {
    const ml = qty * VOLUME[unit]
    if (ing.baseUnit === 'ml') return ml
    if (ing.baseUnit === 'g') return ml // densidad aproximada 1
    return null
  }

  if (unit === 'taza') {
    if (ing.baseUnit === 'ml') return qty * 240
    if (ing.baseUnit === 'g') return qty * (ing.gramsPerCup ?? 200)
    return null
  }

  if (unit === 'cda') {
    if (ing.baseUnit === 'ml') return qty * 15
    if (ing.baseUnit === 'g') return qty * (ing.gramsPerTbsp ?? 15)
    return null
  }

  if (unit === 'cdta') {
    if (ing.baseUnit === 'ml') return qty * 5
    if (ing.baseUnit === 'g') return qty * (ing.gramsPerTsp ?? 5)
    return null
  }

  if (unit === 'unidad') {
    if (ing.baseUnit === 'unit') return qty
    return null
  }

  return null
}

export function unitFactor(unit: string, ing: Convertible): number | null {
  return toBase(1, unit, ing)
}

export function unitLabel(unit: string, ing?: Convertible): string {
  if (unit.startsWith('cu:')) {
    const cu = ing?.customUnits?.find((c) => `cu:${c.id}` === unit)
    return cu?.label ?? 'unidad propia'
  }
  if (isStandardUnit(unit)) {
    if (unit === 'unidad' && ing?.baseUnit === 'unit') return 'u'
    return SHORT[unit]
  }
  return unit
}

export function baseUnitLabel(base: BaseUnit, plural = false): string {
  if (base === 'g') return 'g'
  if (base === 'ml') return 'ml'
  return plural ? 'unidades' : 'u'
}

export function baseUnitName(base: BaseUnit): string {
  if (base === 'g') return 'gramos'
  if (base === 'ml') return 'mililitros'
  return 'unidades'
}

/** Muestra una cantidad en la unidad base, cambiando a kg/L cuando conviene. */
export function formatBase(qty: number, base: BaseUnit): string {
  if (!Number.isFinite(qty)) return '—'
  if (base === 'g') {
    if (Math.abs(qty) >= 1000) return `${trim(qty / 1000)} kg`
    return `${trim(qty)} g`
  }
  if (base === 'ml') {
    if (Math.abs(qty) >= 1000) return `${trim(qty / 1000)} L`
    return `${trim(qty)} ml`
  }
  return `${trim(qty)} ${Math.abs(qty) === 1 ? 'u' : 'u'}`
}

export function trim(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—'
  const rounded = Number(n.toFixed(decimals))
  return rounded.toLocaleString('es-PA', { maximumFractionDigits: decimals })
}

const FRACTIONS: { value: number; label: string }[] = [
  { value: 1 / 8, label: '1/8' },
  { value: 1 / 4, label: '1/4' },
  { value: 1 / 3, label: '1/3' },
  { value: 3 / 8, label: '3/8' },
  { value: 1 / 2, label: '1/2' },
  { value: 5 / 8, label: '5/8' },
  { value: 2 / 3, label: '2/3' },
  { value: 3 / 4, label: '3/4' },
  { value: 7 / 8, label: '7/8' },
]

/** Convierte 1.5 en "1 1/2" para que las recetas se lean como en la cocina. */
export function formatCookQty(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  const whole = Math.floor(n)
  const rest = n - whole
  for (const f of FRACTIONS) {
    if (Math.abs(rest - f.value) < 0.035) {
      return whole > 0 ? `${whole} ${f.label}` : f.label
    }
  }
  return trim(n, n < 10 ? 2 : 1)
}

/** Redondea hacia arriba al escalón de precio indicado. */
export function ceilToStep(value: number, step: number): number {
  if (!step || step <= 0) return value
  return Math.ceil((value - 1e-9) / step) * step
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
