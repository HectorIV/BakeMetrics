import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { AppState, Batch, Ingredient, Purchase, Recipe, Settings } from '../types'
import { DEFAULT_SETTINGS, seedState } from '../data/seed'
import { deductIngredients } from '../lib/cost'
import { toBase } from '../lib/units'

const STORAGE_KEY = 'bakemetrics.state.v1'
const CURRENT_VERSION = 1

type Action =
  | { type: 'upsertIngredient'; ingredient: Ingredient }
  | { type: 'deleteIngredient'; id: string }
  | { type: 'setStock'; id: string; stock: number }
  | { type: 'upsertRecipe'; recipe: Recipe }
  | { type: 'deleteRecipe'; id: string }
  | { type: 'addPurchase'; purchase: Purchase }
  | { type: 'deletePurchase'; id: string }
  | { type: 'addBatch'; batch: Batch; recipe: Recipe; factor: number; deduct: boolean }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'replaceState'; state: AppState }
  | { type: 'reset' }
  | { type: 'wipe' }
  | { type: 'toggleShopping'; key: string }
  | { type: 'clearShopping' }

function normalizeState(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Partial<AppState>
  if (!Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) return null
  return {
    version: CURRENT_VERSION,
    ingredients: data.ingredients.map((i) => ({
      ...i,
      customUnits: i.customUnits ?? [],
      ...(i.free === undefined && i.id === 'agua' ? { free: true } : {}),
    })),
    recipes: data.recipes.map((r) => ({
      ...r,
      lines: r.lines ?? [],
      steps: r.steps ?? [],
      bake: r.bake ?? {},
      prepMinutes: r.prepMinutes ?? 0,
      laborMinutes: r.laborMinutes ?? 0,
      extraCostPerBatch: r.extraCostPerBatch ?? 0,
      mermaPct: r.mermaPct ?? 0,
      priceMode: r.priceMode ?? 'auto',
      itbms: r.itbms ?? false,
      favorite: r.favorite ?? false,
      tags: r.tags ?? [],
    })),
    purchases: data.purchases ?? [],
    batches: data.batches ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    shoppingChecks: data.shoppingChecks ?? {},
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = normalizeState(JSON.parse(raw))
    return parsed ?? seedState()
  } catch {
    return seedState()
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'upsertIngredient': {
      const exists = state.ingredients.some((i) => i.id === action.ingredient.id)
      return {
        ...state,
        ingredients: exists
          ? state.ingredients.map((i) => (i.id === action.ingredient.id ? action.ingredient : i))
          : [...state.ingredients, action.ingredient],
      }
    }
    case 'deleteIngredient':
      return {
        ...state,
        ingredients: state.ingredients.filter((i) => i.id !== action.id),
        recipes: state.recipes.map((r) => ({
          ...r,
          lines: r.lines.filter((l) => l.ingredientId !== action.id),
        })),
      }
    case 'setStock':
      return {
        ...state,
        ingredients: state.ingredients.map((i) =>
          i.id === action.id ? { ...i, stock: Math.max(0, action.stock) } : i,
        ),
      }
    case 'upsertRecipe': {
      const exists = state.recipes.some((r) => r.id === action.recipe.id)
      return {
        ...state,
        recipes: exists
          ? state.recipes.map((r) => (r.id === action.recipe.id ? action.recipe : r))
          : [action.recipe, ...state.recipes],
      }
    }
    case 'deleteRecipe':
      return { ...state, recipes: state.recipes.filter((r) => r.id !== action.id) }
    case 'addPurchase': {
      const p = action.purchase
      return {
        ...state,
        purchases: [p, ...state.purchases],
        ingredients: state.ingredients.map((ing) => {
          if (ing.id !== p.ingredientId) return ing
          const baseQty = toBase(p.qty, p.unit, ing)
          const next: Ingredient = {
            ...ing,
            packPrice: p.total,
            packQty: p.qty,
            packUnit: p.unit,
            priceEstimated: false,
            lastPurchaseAt: p.date,
            stock: Math.max(0, ing.stock + (baseQty ?? 0)),
          }
          if (p.supplier) next.supplier = p.supplier
          return next
        }),
      }
    }
    case 'deletePurchase':
      return { ...state, purchases: state.purchases.filter((p) => p.id !== action.id) }
    case 'addBatch':
      return {
        ...state,
        batches: [action.batch, ...state.batches].slice(0, 200),
        ingredients: action.deduct
          ? deductIngredients(state.ingredients, action.recipe, action.factor)
          : state.ingredients,
      }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'replaceState':
      return action.state
    case 'reset':
      return seedState()
    case 'wipe':
      return {
        version: CURRENT_VERSION,
        ingredients: [],
        recipes: [],
        purchases: [],
        batches: [],
        settings: state.settings,
        shoppingChecks: {},
      }
    case 'toggleShopping':
      return {
        ...state,
        shoppingChecks: {
          ...state.shoppingChecks,
          [action.key]: !state.shoppingChecks[action.key],
        },
      }
    case 'clearShopping':
      return { ...state, shoppingChecks: {} }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  upsertIngredient: (ingredient: Ingredient) => void
  deleteIngredient: (id: string) => void
  setStock: (id: string, stock: number) => void
  upsertRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  addPurchase: (purchase: Purchase) => void
  deletePurchase: (id: string) => void
  addBatch: (batch: Batch, recipe: Recipe, factor: number, deduct: boolean) => void
  updateSettings: (settings: Partial<Settings>) => void
  importState: (raw: string) => { ok: boolean; error?: string }
  resetDemo: () => void
  wipeData: () => void
  toggleShopping: (key: string) => void
  clearShopping: () => void
  exportJson: () => string
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('No se pudo guardar en el navegador', error)
    }
  }, [state])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      upsertIngredient: (ingredient) => dispatch({ type: 'upsertIngredient', ingredient }),
      deleteIngredient: (id) => dispatch({ type: 'deleteIngredient', id }),
      setStock: (id, stock) => dispatch({ type: 'setStock', id, stock }),
      upsertRecipe: (recipe) => dispatch({ type: 'upsertRecipe', recipe }),
      deleteRecipe: (id) => dispatch({ type: 'deleteRecipe', id }),
      addPurchase: (purchase) => dispatch({ type: 'addPurchase', purchase }),
      deletePurchase: (id) => dispatch({ type: 'deletePurchase', id }),
      addBatch: (batch, recipe, factor, deduct) =>
        dispatch({ type: 'addBatch', batch, recipe, factor, deduct }),
      updateSettings: (settings) => dispatch({ type: 'updateSettings', settings }),
      importState: (raw) => {
        try {
          const parsed = normalizeState(JSON.parse(raw))
          if (!parsed) return { ok: false, error: 'El archivo no tiene el formato esperado.' }
          dispatch({ type: 'replaceState', state: parsed })
          return { ok: true }
        } catch {
          return { ok: false, error: 'No pudimos leer el archivo JSON.' }
        }
      },
      resetDemo: () => dispatch({ type: 'reset' }),
      wipeData: () => dispatch({ type: 'wipe' }),
      toggleShopping: (key) => dispatch({ type: 'toggleShopping', key }),
      clearShopping: () => dispatch({ type: 'clearShopping' }),
      exportJson: () => JSON.stringify(state, null, 2),
    }),
    [state],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}

export { STORAGE_KEY }
