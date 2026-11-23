import { useMemo } from 'react'
import type { Recipe, RecipePurchase, RecipePurchaseLine, ShoppingExtra } from '../types'
import { useApp } from '../store/store'
import { money } from '../lib/cost'
import { baseUnitName, formatBase, formatCookQty, toBase } from '../lib/units'
import {
  Button,
  Field,
  IconButton,
  InfoNote,
  MoneyInput,
  QtyInput,
  SectionTitle,
  Sheet,
  TextInput,
  cn,
} from './ui'
import { Icon } from './Icon'
import { toast } from '../lib/toast'
import { todayInputValue, uid } from '../lib/id'

interface IngLine {
  id: string
  name: string
  baseUnit: 'g' | 'ml' | 'unit'
  neededBase: number
  have: number
  faltaBase: number
  packBase: number | null
  packs: number
  price: number
  total: number
  checked: boolean
  free: boolean
}

interface PackLine {
  id: string
  name: string
  coversUnits: number
  packs: number
  price: number
  total: number
  checked: boolean
}

export function RecipeShopSheet({
  open,
  onClose,
  recipe,
  units,
  factor,
}: {
  open: boolean
  onClose: () => void
  recipe: Recipe
  units: number
  factor: number
}) {
  const {
    state,
    upsertIngredient,
    upsertRecipe,
    toggleShopping,
    setRecipeStock,
    addRecipeStock,
    upsertExtra,
    deleteExtra,
    addRecipePurchase,
  } = useApp()

  const stock = state.recipeStock[recipe.id] ?? {}
  const extras = state.recipeExtras[recipe.id] ?? []
  const packagingItems = recipe.packagingItems ?? []

  const ingLines = useMemo<IngLine[]>(() => {
    const ids = [...new Set(recipe.lines.map((l) => l.ingredientId))]
    const list: IngLine[] = []
    for (const id of ids) {
      const ing = state.ingredients.find((i) => i.id === id)
      if (!ing) continue
      const neededBase = recipe.lines
        .filter((l) => l.ingredientId === id)
        .reduce((sum, l) => sum + (toBase(l.qty * factor, l.unit, ing) ?? 0), 0)
      const have = stock[id] ?? 0
      const faltaBase = Math.max(0, neededBase - have)
      const packBase = toBase(ing.packQty, ing.packUnit, ing)
      const packs = packBase && packBase > 0 ? Math.ceil(faltaBase / packBase) : 0
      const price = ing.free ? 0 : ing.packPrice
      list.push({
        id,
        name: ing.name,
        baseUnit: ing.baseUnit,
        neededBase,
        have,
        faltaBase,
        packBase,
        packs,
        price,
        total: ing.free ? 0 : packs * price,
        checked: Boolean(state.shoppingChecks[`${recipe.id}:${id}`]),
        free: Boolean(ing.free),
      })
    }
    return list
  }, [recipe, state.ingredients, state.shoppingChecks, stock, factor])

  const packLines = useMemo<PackLine[]>(
    () =>
      packagingItems.map((item) => {
        const covers = item.coversUnits > 0 ? item.coversUnits : 1
        const packs = units > 0 ? Math.ceil(units / covers) : 0
        return {
          id: item.id,
          name: item.name,
          coversUnits: covers,
          packs,
          price: item.packPrice,
          total: packs * item.packPrice,
          checked: Boolean(state.shoppingChecks[`${recipe.id}:pack:${item.id}`]),
        }
      }),
    [packagingItems, units, state.shoppingChecks, recipe.id],
  )

  const extraLines = extras.map((e) => ({
    ...e,
    total: e.price,
    checked: Boolean(state.shoppingChecks[`${recipe.id}:extra:${e.id}`]),
  }))

  const allTotals = [
    ...ingLines.map((l) => ({ total: l.total, checked: l.checked })),
    ...packLines.map((l) => ({ total: l.total, checked: l.checked })),
    ...extraLines.map((l) => ({ total: l.total, checked: l.checked })),
  ]
  const comprado = allTotals.filter((l) => l.checked).reduce((s, l) => s + l.total, 0)
  const pendiente = allTotals.filter((l) => !l.checked).reduce((s, l) => s + l.total, 0)

  const setIngPrice = (id: string, price: number) => {
    const ing = state.ingredients.find((i) => i.id === id)
    if (!ing) return
    upsertIngredient({ ...ing, packPrice: price, priceEstimated: price > 0 ? false : ing.priceEstimated })
  }

  const setPackPrice = (id: string, price: number) => {
    upsertRecipe({
      ...recipe,
      packagingItems: packagingItems.map((p) => (p.id === id ? { ...p, packPrice: price } : p)),
      updatedAt: new Date().toISOString(),
    })
  }

  const addExtra = () => {
    const extra: ShoppingExtra = { id: uid('ex-'), name: '', price: 0 }
    upsertExtra(recipe.id, extra)
  }

  const save = () => {
    const lines: RecipePurchaseLine[] = []
    const adds: Record<string, number> = {}
    for (const l of ingLines) {
      if (!l.checked || l.free) continue
      lines.push({
        name: l.name,
        kind: 'ingredient',
        qty: l.packs,
        unit: 'paq',
        price: l.price,
        total: l.total,
      })
      if (l.packs > 0 && l.packBase) adds[l.id] = l.packs * l.packBase
    }
    for (const l of packLines) {
      if (!l.checked) continue
      lines.push({ name: l.name, kind: 'packaging', qty: l.packs, unit: 'paq', price: l.price, total: l.total })
    }
    for (const l of extraLines) {
      if (!l.checked) continue
      lines.push({ name: l.name || 'Extra', kind: 'extra', qty: 1, price: l.price, total: l.total })
    }
    if (lines.length === 0) {
      toast('Marca con la casilla lo que ya compraste', 'error')
      return
    }
    const total = lines.reduce((s, l) => s + l.total, 0)
    const purchase: RecipePurchase = {
      id: uid('rp-'),
      date: new Date(`${todayInputValue()}T12:00:00`).toISOString(),
      total,
      lines,
    }
    if (Object.keys(adds).length > 0) addRecipeStock(recipe.id, adds)
    addRecipePurchase(recipe.id, purchase)
    for (const l of ingLines) if (l.checked && !l.free) toggleShopping(`${recipe.id}:${l.id}`)
    for (const l of packLines) if (l.checked) toggleShopping(`${recipe.id}:pack:${l.id}`)
    for (const l of extraLines) if (l.checked) toggleShopping(`${recipe.id}:extra:${l.id}`)
    toast(`Compra guardada: ${money(total)} · inventario de la receta actualizado`, 'success')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Compras e inventario"
      subtitle={`${recipe.name} · ${formatCookQty(units)} ${recipe.yieldLabel}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>
            <Icon name="check" className="h-4 w-4" /> Guardar compra
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-ink p-3.5 text-center text-cream">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-cream/50">Comprado</p>
            <p className="font-display text-[20px] font-semibold leading-tight">{money(comprado)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-cream/50">Por comprar</p>
            <p className="font-display text-[20px] font-semibold leading-tight">{money(pendiente)}</p>
          </div>
        </div>

        <InfoNote icon="info">
          Anota lo que tienes de cada ingrediente, el precio del paquete y marca la casilla cuando
          lo compres. Al guardar, se suma al inventario de esta receta y queda en el historial.
        </InfoNote>

        {/* Ingredientes */}
        <div>
          <SectionTitle>Ingredientes</SectionTitle>
          <div className="space-y-2">
            {ingLines.map((l) => (
              <div key={l.id} className="rounded-2xl border border-sand/70 bg-white/70 p-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={l.checked}
                    onChange={() => toggleShopping(`${recipe.id}:${l.id}`)}
                    className="mt-1 h-5 w-5 shrink-0 accent-terra"
                    aria-label={`Comprado ${l.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13.5px] font-semibold', l.checked && 'text-ink/40 line-through')}>
                      {l.name}
                    </span>
                    <span className="block text-[11px] text-ink/45">
                      Necesitas {formatBase(l.neededBase, l.baseUnit)}
                      {l.free ? ' · sin costo' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                    {l.free ? '—' : money(l.total)}
                  </span>
                </label>

                {!l.free && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label={`Tengo (${baseUnitName(l.baseUnit)})`}>
                      <QtyInput
                        value={l.have}
                        onChange={(v) => setRecipeStock(recipe.id, l.id, v)}
                        aria-label={`Inventario de ${l.name}`}
                      />
                    </Field>
                    <Field label="Precio del paquete">
                      <MoneyInput
                        value={l.price}
                        onChange={(v) => setIngPrice(l.id, v)}
                        aria-label={`Precio del paquete de ${l.name}`}
                      />
                    </Field>
                  </div>
                )}
                {!l.free && (
                  <p className="mt-1.5 text-[11px] text-ink/45">
                    {l.faltaBase <= 0
                      ? 'Ya tienes lo necesario para esta tanda.'
                      : `Faltan ${formatBase(l.faltaBase, l.baseUnit)} · ${l.packs} ${
                          l.packs === 1 ? 'paquete' : 'paquetes'
                        }`}
                  </p>
                )}
              </div>
            ))}
            {ingLines.length === 0 && (
              <p className="py-2 text-center text-[12px] text-ink/40">La receta no tiene ingredientes.</p>
            )}
          </div>
        </div>

        {/* Empaques y envases */}
        <div>
          <SectionTitle>Empaques y envases</SectionTitle>
          <div className="space-y-2">
            {packLines.map((l) => (
              <div key={l.id} className="rounded-2xl border border-sand/70 bg-white/70 p-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={l.checked}
                    onChange={() => toggleShopping(`${recipe.id}:pack:${l.id}`)}
                    className="mt-1 h-5 w-5 shrink-0 accent-terra"
                    aria-label={`Comprado ${l.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13.5px] font-semibold', l.checked && 'text-ink/40 line-through')}>
                      {l.name}
                    </span>
                    <span className="block text-[11px] text-ink/45">
                      Rinde {formatCookQty(l.coversUnits)} u · necesitas {l.packs}{' '}
                      {l.packs === 1 ? 'paquete' : 'paquetes'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums">{money(l.total)}</span>
                </label>
                <div className="mt-2">
                  <Field label="Precio del paquete">
                    <MoneyInput
                      value={l.price}
                      onChange={(v) => setPackPrice(l.id, v)}
                      aria-label={`Precio del paquete de ${l.name}`}
                    />
                  </Field>
                </div>
              </div>
            ))}
            {packLines.length === 0 && (
              <p className="py-2 text-center text-[12px] text-ink/40">
                Sin empaques detallados. Agrégalos en Editar receta o como “otra cosa” abajo.
              </p>
            )}
          </div>
        </div>

        {/* Otras cosas */}
        <div>
          <SectionTitle
            action={
              <button
                type="button"
                onClick={addExtra}
                className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-cocoa"
              >
                <Icon name="plus" className="h-3 w-3" /> Agregar
              </button>
            }
          >
            Otras cosas
          </SectionTitle>
          <div className="space-y-2">
            {extraLines.map((l) => (
              <div key={l.id} className="rounded-2xl border border-sand/70 bg-white/70 p-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={l.checked}
                    onChange={() => toggleShopping(`${recipe.id}:extra:${l.id}`)}
                    className="mt-2 h-5 w-5 shrink-0 accent-terra"
                    aria-label={`Comprado ${l.name}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <TextInput
                      value={l.name}
                      onChange={(e) => upsertExtra(recipe.id, { id: l.id, name: e.target.value, price: l.price })}
                      placeholder="Ej. caja de regalo, gas, decoración…"
                      aria-label="Nombre del extra"
                    />
                    <MoneyInput
                      value={l.price}
                      onChange={(v) => upsertExtra(recipe.id, { id: l.id, name: l.name, price: v })}
                      aria-label={`Precio de ${l.name || 'extra'}`}
                    />
                  </div>
                  <IconButton
                    icon="trash"
                    label="Quitar extra"
                    className="mt-1 shrink-0"
                    onClick={() => deleteExtra(recipe.id, l.id)}
                  />
                </div>
              </div>
            ))}
            {extraLines.length === 0 && (
              <p className="py-2 text-center text-[12px] text-ink/40">
                Agrega envases, cajas, gas o cualquier cosa que compres para esta receta.
              </p>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
