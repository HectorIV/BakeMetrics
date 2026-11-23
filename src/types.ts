/** Unidades base internas: todo se convierte a gramos, mililitros o unidades. */
export type BaseUnit = 'g' | 'ml' | 'unit'

/** Unidades estándar que se pueden usar en recetas y compras. */
export type StandardUnit = 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'taza' | 'cda' | 'cdta' | 'unidad'

export type IngredientCategory =
  | 'harinas'
  | 'endulzantes'
  | 'lacteos'
  | 'huevos'
  | 'grasas'
  | 'chocolates'
  | 'frutas'
  | 'salados'
  | 'otros'

export type RecipeCategory =
  | 'galletas'
  | 'postres'
  | 'muffins'
  | 'saludables'
  | 'pizza'
  | 'salados'
  | 'otros'

export interface CustomUnit {
  id: string
  label: string
  baseQty: number
}

export interface Ingredient {
  id: string
  name: string
  category: IngredientCategory
  baseUnit: BaseUnit
  /** Existencias actuales, en unidad base. */
  stock: number
  /** Nivel bajo a partir del cual se avisa que hay que comprar. */
  minStock: number
  /** Precio pagado por el paquete de referencia. */
  packPrice: number
  /** Cantidad del paquete de referencia (en packUnit). */
  packQty: number
  packUnit: StandardUnit
  /** Equivalencias para tazas y cucharadas cuando la unidad base es gramos. */
  gramsPerCup?: number
  gramsPerTbsp?: number
  gramsPerTsp?: number
  customUnits: CustomUnit[]
  /** Merma estimada al usar el ingrediente (cáscaras, restos, etc.). */
  wastePct: number
  supplier?: string
  /** Ingrediente sin costo (agua, hielo…): no se pide precio ni suma al costo. */
  free?: boolean
  /** true cuando el precio es una referencia inicial y hay que confirmarlo. */
  priceEstimated?: boolean
  lastPurchaseAt?: string
  notes?: string
  archived?: boolean
}

export interface RecipeLine {
  id: string
  ingredientId: string
  qty: number
  /** StandardUnit o `cu:<id>` para una unidad propia del ingrediente. */
  unit: string
  note?: string
}

export interface RecipeStep {
  id: string
  text: string
  minutes?: number
}

/** Empaque que se usa por unidad vendida (papel, caja, envase, etiqueta). */
export interface PackagingItem {
  id: string
  name: string
  /** Precio del paquete, rollo o caja completa. */
  packPrice: number
  /** Cuántas unidades vendibles cubre ese paquete. */
  coversUnits: number
}

export interface BakeInfo {
  tempC?: number
  minutes?: number
  restMinutes?: number
  chillMinutes?: number
  notes?: string
}

export interface Recipe {
  id: string
  name: string
  description: string
  category: RecipeCategory
  tags: string[]
  /** Rendimiento en la tanda base. */
  yieldQty: number
  yieldLabel: string
  /** Peso aproximado de cada unidad, para sugerir tandas. */
  pieceGrams?: number
  lines: RecipeLine[]
  steps: RecipeStep[]
  bake: BakeInfo
  prepMinutes: number
  laborMinutes: number
  /** Tarifa por hora propia de la receta; si falta se usa la de Ajustes. */
  laborRate?: number
  /** Costo de empaque (bolsa, etiqueta) por unidad vendida. */
  packagingPerUnit?: number
  /** Lista detallada de empaques; si existe, reemplaza a packagingPerUnit. */
  packagingItems?: PackagingItem[]
  /** Costos extra por tanda: gas, decoración, etc. */
  extraCostPerBatch: number
  /** Merma adicional de la tanda completa (%). */
  mermaPct: number
  /** Margen de ganancia deseado sobre el precio de venta, sin ITBMS. */
  marginPct?: number
  priceMode: 'auto' | 'manual'
  /** Precio al cliente (con ITBMS incluido) cuando priceMode = manual. */
  manualPrice?: number
  itbms: boolean
  favorite: boolean
  imageDataUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Purchase {
  id: string
  date: string
  ingredientId: string
  ingredientName: string
  qty: number
  unit: StandardUnit
  total: number
  supplier?: string
  source: 'manual' | 'ocr'
  note?: string
}

/** Precio y presentación usados en una tanda concreta. */
export interface BatchItem {
  ingredientId: string
  name: string
  /** Precio pagado por el paquete o presentación. */
  price: number
  /** Cantidad que traía ese paquete. */
  packQty: number
  packUnit: StandardUnit
  /** Costo proporcional a lo usado en la tanda. */
  cost: number
}

export interface Batch {
  id: string
  date: string
  recipeId: string
  recipeName: string
  factor: number
  units: number
  totalCost: number
  pricePerUnit: number
  /** Dinero desembolsado en la compra de esta tanda. */
  spent?: number
  /** Costo de los ingredientes usados, sin mano de obra ni empaques. */
  ingredientsCost?: number
  /** Precios y presentaciones registrados para esta tanda. */
  items?: BatchItem[]
  notes?: string
}

export type Rounding = 'none' | '0.05' | '0.10' | '0.25' | '0.50' | '1'

export interface Settings {
  businessName: string
  tagline: string
  instagram: string
  whatsapp: string
  city: string
  itbmsRate: number
  /** Valor inicial para recetas nuevas. */
  itbmsDefault: boolean
  laborRatePerHour: number
  overheadPct: number
  defaultMarginPct: number
  packagingPerUnit: number
  rounding: Rounding
  themeColor: string
  accentColor: string
  logoDataUrl?: string
}

export interface AppState {
  version: number
  ingredients: Ingredient[]
  recipes: Recipe[]
  purchases: Purchase[]
  batches: Batch[]
  settings: Settings
  shoppingChecks: Record<string, boolean>
}

export interface ParsedReceiptItem {
  name: string
  price: number
  raw: string
}
