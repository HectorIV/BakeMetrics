import { useEffect, useMemo, useState } from 'react'
import type { Batch, BatchItem, Ingredient, Recipe, StandardUnit } from '../types'
import { useApp } from '../store/store'
import { computeRecipeCost, money } from '../lib/cost'
import {
  STANDARD_UNITS,
  formatBase,
  formatCookQty,
  toBase,
  trim,
  unitLabel,
} from '../lib/units'
import {
  Button,
  Field,
  InfoNote,
  MoneyInput,
  QtyInput,
  Select,
  Sheet,
  cn,
  inputClass,
} from './ui'
import { Icon } from './Icon'
import { toast } from '../lib/toast'
import { todayInputValue, uid } from '../lib/id'

interface PackDraft {
  price: number
  packQty: number
  packUnit: StandardUnit
}

interface UsedRow {
  ing: Ingredient
  neededBase: number
  cost: number
  row: PackDraft
  packBase: number | null
  packsNeeded: number | null
}

export function TandaSheet({
  open,
  onClose,
  recipe,
  units: initialUnits,
}: {
  open: boolean
  onClose: () => void
  recipe: Recipe
  /** Unidades según el escalado actual de la receta. */
  units: number
}) {
  const { state, addBatch, upsertIngredient, addRecipeStock } = useApp()
  const [date, setDate] = useState(todayInputValue)
  const [units, setUnits] = useState(initialUnits)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Record<string, PackDraft>>({})

  const ingredientIds = useMemo(
    () => [...new Set(recipe.lines.map((line) => line.ingredientId))],
    [recipe.lines],
  )

  useEffect(() => {
    if (!open) return
    setUnits(initialUnits)
    setDate(todayInputValue())
    setNotes('')
    const next: Record<string, PackDraft> = {}
    for (const id of ingredientIds) {
      const ing = state.ingredients.find((item) => item.id === id)
      if (ing) {
        next[id] = { price: ing.packPrice, packQty: ing.packQty, packUnit: ing.packUnit }
      }
    }
    setRows(next)
    // Solo al abrir o al cambiar de receta/cantidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe.id, initialUnits])

  const tempIngredients = useMemo(
    () =>
      state.ingredients.map((ing) => {
        const row = rows[ing.id]
        return row
          ? { ...ing, packPrice: row.price, packQty: row.packQty, packUnit: row.packUnit }
          : ing
      }),
    [state.ingredients, rows],
  )

  const factorNow = recipe.yieldQty > 0 ? units / recipe.yieldQty : 1
  const cost = useMemo(
    () => computeRecipeCost(recipe, tempIngredients, state.settings, factorNow),
    [recipe, tempIngredients, state.settings, factorNow],
  )

  const usedRows = useMemo<UsedRow[]>(() => {
    const list: UsedRow[] = []
    for (const id of ingredientIds) {
      const ing = tempIngredients.find((item) => item.id === id)
      if (!ing) continue
      const neededBase = recipe.lines
        .filter((line) => line.ingredientId === id)
        .reduce((sum, line) => sum + (toBase(line.qty * factorNow, line.unit, ing) ?? 0), 0)
      const lineTotal = cost.lines
        .filter((line) => line.ingredient?.id === id)
        .reduce((sum, line) => sum + line.cost, 0)
      const row = rows[id] ?? {
        price: ing.packPrice,
        packQty: ing.packQty,
        packUnit: ing.packUnit,
      }
      const packBase = toBase(row.packQty, row.packUnit, ing)
      list.push({
        ing,
        neededBase,
        cost: ing.free ? 0 : lineTotal,
        row,
        packBase,
        packsNeeded: packBase && packBase > 0 ? neededBase / packBase : null,
      })
    }
    return list
  }, [ingredientIds, tempIngredients, recipe.lines, factorNow, cost.lines, rows])

  const spent = usedRows.reduce((sum, item) => {
    if (item.ing.free) return sum
    const packs =
      item.packsNeeded && item.packsNeeded > 0 ? Math.max(1, Math.ceil(item.packsNeeded)) : 1
    return sum + packs * Math.max(0, item.row.price)
  }, 0)

  const updateRow = (id: string, patch: Partial<PackDraft>) =>
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const save = () => {
    if (!Number.isFinite(units) || units <= 0) {
      toast('Indica cuántas unidades salieron', 'error')
      return
    }
    const invalid = usedRows.find(
      (item) => !item.ing.free && (item.packBase === null || item.packBase <= 0),
    )
    if (invalid) {
      toast(`Revisa cuánto trae el paquete de ${invalid.ing.name}`, 'error')
      return
    }

    const iso = new Date(`${date}T12:00:00`).toISOString()
    const items: BatchItem[] = usedRows.map((item) => ({
      ingredientId: item.ing.id,
      name: item.ing.name,
      price: item.ing.free ? 0 : item.row.price,
      packQty: item.row.packQty,
      packUnit: item.row.packUnit,
      cost: item.cost,
    }))

    for (const item of usedRows) {
      if (item.ing.free) continue
      upsertIngredient({
        ...item.ing,
        packPrice: item.row.price,
        packQty: item.row.packQty,
        packUnit: item.row.packUnit,
        priceEstimated: item.row.price > 0 ? false : item.ing.priceEstimated,
        lastPurchaseAt: iso,
      })
    }

    const batch: Batch = {
      id: uid('bat-'),
      date: iso,
      recipeId: recipe.id,
      recipeName: recipe.name,
      factor: factorNow,
      units,
      totalCost: cost.totalCost,
      pricePerUnit: cost.finalPrice,
      spent,
      ingredientsCost: cost.ingredientsCost,
      items,
      notes: notes.trim() || undefined,
    }
    addBatch(batch)
    const usage: Record<string, number> = {}
    for (const item of usedRows) {
      if (item.ing.free || item.neededBase <= 0) continue
      usage[item.ing.id] = -item.neededBase
    }
    if (Object.keys(usage).length > 0) addRecipeStock(recipe.id, usage)
    toast(
      `Tanda guardada: ${formatCookQty(units)} ${recipe.yieldLabel} · ${money(cost.costPerUnit)} c/u`,
      'success',
    )
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar tanda"
      subtitle={`${recipe.name} · ${formatCookQty(units || 0)} ${recipe.yieldLabel}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>
            <Icon name="check" className="h-4 w-4" /> Guardar tanda
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="tanda-date">
            <input
              id="tanda-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={cn(inputClass, 'py-2.5')}
            />
          </Field>
          <Field label={`Unidades que salieron`} htmlFor="tanda-units">
            <QtyInput
              id="tanda-units"
              value={units}
              onChange={setUnits}
              suffix={recipe.yieldLabel}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-ink p-3.5 text-cream">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Costo/tanda</p>
              <p className="font-display text-[18px] font-semibold leading-tight">
                {money(cost.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Pagaste</p>
              <p className="font-display text-[18px] font-semibold leading-tight">{money(spent)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Costo/u</p>
              <p className="font-display text-[18px] font-semibold leading-tight">
                {money(cost.costPerUnit)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-cream/55">
            Venta sugerida {money(cost.finalPrice)} c/u · incluye mano de obra, empaques y gastos
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-sand bg-white/60 px-3 py-2.5 text-[11.5px] leading-snug text-ink/55">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Escribe lo que pagaste por cada paquete. Solo se suma a la tanda la parte que usas;
            el resto queda para otra receta. “Pagaste” es lo que cuestan los paquetes completos y,
            al guardar, estos precios quedan como referencia en tus ingredientes.
          </span>
        </div>

        <div className="space-y-2">
          {usedRows.map((item) => {
            const compatible = STANDARD_UNITS.filter((unit) => toBase(1, unit.key, item.ing) !== null)
            const pct = item.packsNeeded
            return (
              <div
                key={item.ing.id}
                className="rounded-2xl border border-sand/70 bg-white/70 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{item.ing.name}</p>
                    <p className="text-[11px] text-ink/45">
                      Necesitas {formatBase(item.neededBase, item.ing.baseUnit)}
                      {item.ing.free ? ' · sin costo' : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                    {item.ing.free ? '—' : money(item.cost)}
                  </p>
                </div>

                {!item.ing.free && (
                  <>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Field label="Pagué por el paquete">
                        <MoneyInput
                          value={item.row.price}
                          onChange={(value) => updateRow(item.ing.id, { price: value })}
                          aria-label={`Precio del paquete de ${item.ing.name}`}
                        />
                      </Field>
                      <Field label="El paquete trae">
                        <div className="grid grid-cols-[1fr,78px] gap-1.5">
                          <QtyInput
                            value={item.row.packQty}
                            onChange={(value) => updateRow(item.ing.id, { packQty: value })}
                            aria-label={`Cantidad del paquete de ${item.ing.name}`}
                          />
                          <Select
                            value={item.row.packUnit}
                            onChange={(event) =>
                              updateRow(item.ing.id, {
                                packUnit: event.target.value as StandardUnit,
                              })
                            }
                            className="px-1.5 text-[12px]"
                            aria-label={`Unidad del paquete de ${item.ing.name}`}
                          >
                            {compatible.map((unit) => (
                              <option key={unit.key} value={unit.key}>
                                {unit.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </Field>
                    </div>

                    <p
                      className={cn(
                        'mt-1.5 text-[11px]',
                        item.packBase === null ? 'font-medium text-berry' : 'text-ink/45',
                      )}
                    >
                      {item.packBase === null
                        ? 'La unidad del paquete no se puede convertir.'
                        : pct !== null && pct <= 1
                          ? `Usas ${Math.max(1, Math.round(pct * 100))}% de un paquete de ${formatCookQty(
                              item.row.packQty,
                            )} ${unitLabel(item.row.packUnit, item.ing)}`
                          : `Necesitas ${trim(pct ?? 0, 1)} paquetes de ${formatCookQty(
                              item.row.packQty,
                            )} ${unitLabel(item.row.packUnit, item.ing)}`}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {usedRows.length === 0 && (
          <InfoNote tone="warn" icon="alert">
            Esta receta todavía no tiene ingredientes.
          </InfoNote>
        )}

        <Field label="Notas (opcional)" htmlFor="tanda-notes">
          <textarea
            id="tanda-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej.: compré en el super, quedaron 2 extra…"
            className={cn(inputClass, 'min-h-20 resize-y')}
          />
        </Field>
      </div>
    </Sheet>
  )
}
