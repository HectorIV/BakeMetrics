import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type {
  AppState,
  Batch,
  Ingredient,
  Purchase,
  Recipe,
  RecipePurchase,
  Settings,
  ShoppingExtra,
} from '../types'
import { DEFAULT_SETTINGS, SEED_PACKAGING, seedState } from '../data/seed'

const STORAGE_KEY = 'bakemetrics.state.v1'
const CURRENT_VERSION = 2

type Action =
  | { type: 'upsertIngredient'; ingredient: Ingredient }
  | { type: 'deleteIngredient'; id: string }
  | { type: 'upsertRecipe'; recipe: Recipe }
  | { type: 'deleteRecipe'; id: string }
  | { type: 'addPurchase'; purchase: Purchase }
  | { type: 'deletePurchase'; id: string }
  | { type: 'addBatch'; batch: Batch }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'replaceState'; state: AppState }
  | { type: 'reset' }
  | { type: 'wipe' }
  | { type: 'toggleShopping'; key: string }
  | { type: 'setRecipeStock'; recipeId: string; ingredientId: string; value: number }
  | { type: 'addRecipeStock'; recipeId: string; adds: Record<string, number> }
  | { type: 'upsertExtra'; recipeId: string; extra: ShoppingExtra }
  | { type: 'deleteExtra'; recipeId: string; id: string }
  | { type: 'addRecipePurchase'; recipeId: string; purchase: RecipePurchase }

function normalizeState(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Partial<AppState>
  if (!Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) return null
  const previousVersion = typeof data.version === 'number' ? data.version : 1
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
      packagingItems:
        r.packagingItems ?? (previousVersion < 2 ? (SEED_PACKAGING[r.id] ?? []) : []),
    })),
    purchases: data.purchases ?? [],
    batches: data.batches ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    shoppingChecks: data.shoppingChecks ?? {},
    recipeStock: data.recipeStock ?? {},
    recipeExtras: data.recipeExtras ?? {},
    recipePurchases: data.recipePurchases ?? {},
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
          const next: Ingredient = {
            ...ing,
            packPrice: p.total,
            packQty: p.qty,
            packUnit: p.unit,
            priceEstimated: false,
            lastPurchaseAt: p.date,
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
        recipeStock: {},
        recipeExtras: {},
        recipePurchases: {},
      }
    case 'toggleShopping':
      return {
        ...state,
        shoppingChecks: {
          ...state.shoppingChecks,
          [action.key]: !state.shoppingChecks[action.key],
        },
      }
    case 'setRecipeStock': {
      const current = state.recipeStock[action.recipeId] ?? {}
      return {
        ...state,
        recipeStock: {
          ...state.recipeStock,
          [action.recipeId]: {
            ...current,
            [action.ingredientId]: Math.max(0, action.value),
          },
        },
      }
    }
    case 'addRecipeStock': {
      const current = state.recipeStock[action.recipeId] ?? {}
      const next = { ...current }
      for (const [id, delta] of Object.entries(action.adds)) {
        next[id] = Math.max(0, (next[id] ?? 0) + delta)
      }
      return {
        ...state,
        recipeStock: { ...state.recipeStock, [action.recipeId]: next },
      }
    }
    case 'upsertExtra': {
      const current = state.recipeExtras[action.recipeId] ?? []
      const exists = current.some((e) => e.id === action.extra.id)
      return {
        ...state,
        recipeExtras: {
          ...state.recipeExtras,
          [action.recipeId]: exists
            ? current.map((e) => (e.id === action.extra.id ? action.extra : e))
            : [...current, action.extra],
        },
      }
    }
    case 'deleteExtra':
      return {
        ...state,
        recipeExtras: {
          ...state.recipeExtras,
          [action.recipeId]: (state.recipeExtras[action.recipeId] ?? []).filter(
            (e) => e.id !== action.id,
          ),
        },
      }
    case 'addRecipePurchase': {
      const current = state.recipePurchases[action.recipeId] ?? []
      return {
        ...state,
        recipePurchases: {
          ...state.recipePurchases,
          [action.recipeId]: [action.purchase, ...current].slice(0, 50),
        },
      }
    }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  upsertIngredient: (ingredient: Ingredient) => void
  deleteIngredient: (id: string) => void
  upsertRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  addPurchase: (purchase: Purchase) => void
  deletePurchase: (id: string) => void
  addBatch: (batch: Batch) => void
  updateSettings: (settings: Partial<Settings>) => void
  importState: (raw: string) => { ok: boolean; error?: string }
  resetDemo: () => void
  wipeData: () => void
  toggleShopping: (key: string) => void
  setRecipeStock: (recipeId: string, ingredientId: string, value: number) => void
  addRecipeStock: (recipeId: string, adds: Record<string, number>) => void
  upsertExtra: (recipeId: string, extra: ShoppingExtra) => void
  deleteExtra: (recipeId: string, id: string) => void
  addRecipePurchase: (recipeId: string, purchase: RecipePurchase) => void
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
      upsertRecipe: (recipe) => dispatch({ type: 'upsertRecipe', recipe }),
      deleteRecipe: (id) => dispatch({ type: 'deleteRecipe', id }),
      addPurchase: (purchase) => dispatch({ type: 'addPurchase', purchase }),
      deletePurchase: (id) => dispatch({ type: 'deletePurchase', id }),
      addBatch: (batch) => dispatch({ type: 'addBatch', batch }),
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
      setRecipeStock: (recipeId, ingredientId, value) =>
        dispatch({ type: 'setRecipeStock', recipeId, ingredientId, value }),
      addRecipeStock: (recipeId, adds) => dispatch({ type: 'addRecipeStock', recipeId, adds }),
      upsertExtra: (recipeId, extra) => dispatch({ type: 'upsertExtra', recipeId, extra }),
      deleteExtra: (recipeId, id) => dispatch({ type: 'deleteExtra', recipeId, id }),
      addRecipePurchase: (recipeId, purchase) =>
        dispatch({ type: 'addRecipePurchase', recipeId, purchase }),
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
