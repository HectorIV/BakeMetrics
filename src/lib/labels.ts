import type { IngredientCategory, RecipeCategory } from '../types'

export const INGREDIENT_CATEGORIES: { id: IngredientCategory; label: string }[] = [
  { id: 'harinas', label: 'Harinas y granos' },
  { id: 'endulzantes', label: 'Endulzantes' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'huevos', label: 'Huevos' },
  { id: 'grasas', label: 'Grasas y aceites' },
  { id: 'chocolates', label: 'Chocolates' },
  { id: 'frutas', label: 'Frutas' },
  { id: 'salados', label: 'Salados' },
  { id: 'otros', label: 'Otros' },
]

export const RECIPE_CATEGORIES: { id: RecipeCategory; label: string }[] = [
  { id: 'galletas', label: 'Galletas' },
  { id: 'postres', label: 'Postres' },
  { id: 'muffins', label: 'Muffins' },
  { id: 'saludables', label: 'Saludables' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'salados', label: 'Salados' },
  { id: 'otros', label: 'Otros' },
]

export function ingredientCategoryLabel(id: IngredientCategory): string {
  return INGREDIENT_CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros'
}

export function recipeCategoryLabel(id: RecipeCategory): string {
  return RECIPE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros'
}

export const CATEGORY_GRADIENTS: Record<RecipeCategory, string> = {
  galletas: 'linear-gradient(135deg,#E9B384 0%,#C0562F 100%)',
  postres: 'linear-gradient(135deg,#D9A5B3 0%,#A63D5C 100%)',
  muffins: 'linear-gradient(135deg,#C9A27E 0%,#6B3F25 100%)',
  saludables: 'linear-gradient(135deg,#A8C0A0 0%,#5F7F63 100%)',
  pizza: 'linear-gradient(135deg,#E7B37A 0%,#B45309 100%)',
  salados: 'linear-gradient(135deg,#D6C09A 0%,#8A6A43 100%)',
  otros: 'linear-gradient(135deg,#D8C3AA 0%,#9A7B5A 100%)',
}
