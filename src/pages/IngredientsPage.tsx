import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/store'
import type { BaseUnit, Ingredient, IngredientCategory } from '../types'
import { money, pricePerBaseLabel } from '../lib/cost'
import { formatCookQty, toBase, trim, baseUnitName, STANDARD_UNITS, unitLabel } from '../lib/units'
import { INGREDIENT_CATEGORIES, ingredientCategoryLabel } from '../lib/labels'
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  IconButton,
  InfoNote,
  MoneyInput,
  QtyInput,
  SectionTitle,
  Select,
  Sheet,
  Stat,
  TextInput,
  Toggle,
  cn,
  inputClass,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { toast } from '../lib/toast'
import { formatDateShort, uid } from '../lib/id'

const EMPTY_INGREDIENT: Ingredient = {
  id: '',
  name: '',
  category: 'otros',
  baseUnit: 'g',
  stock: 0,
  minStock: 0,
  packPrice: 0,
  packQty: 1000,
  packUnit: 'g',
  customUnits: [],
  wastePct: 0,
  priceEstimated: false,
}

export function IngredientsPage() {
  const { state, upsertIngredient, deleteIngredient } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'todas' | IngredientCategory>('todas')
  const [draft, setDraft] = useState<Ingredient | null>(null)
  const [isNew, setIsNew] = useState(false)

  const ingredients = useMemo(
    () =>
      [...state.ingredients]
        .filter((i) => !i.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.ingredients],
  )

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return ingredients.filter((ingredient) => {
      if (category !== 'todas' && ingredient.category !== category) return false
      if (!search) return true
      return ingredient.name.toLowerCase().includes(search)
    })
  }, [ingredients, query, category])

  const totalWithPrice = ingredients.filter((ingredient) => ingredient.packPrice > 0).length
  const estimated = ingredients.filter((ingredient) => ingredient.priceEstimated).length
  const usedCategories = INGREDIENT_CATEGORIES.filter((c) =>
    ingredients.some((i) => i.category === c.id),
  )

  const openNew = () => {
    setDraft({ ...EMPTY_INGREDIENT, id: uid('ing-') })
    setIsNew(true)
  }

  const openEdit = (ingredient: Ingredient) => {
    setDraft({ ...ingredient })
    setIsNew(false)
  }

  const save = () => {
    if (!draft) return
    if (!draft.name.trim()) {
      toast('Escribe el nombre del ingrediente', 'error')
      return
    }
    if (!draft.packQty || draft.packQty <= 0) {
      toast('Indica cuánto trae el paquete', 'error')
      return
    }
    if (toBase(draft.packQty, draft.packUnit, draft) === null) {
      toast('La unidad del paquete no es compatible con la unidad base', 'error')
      return
    }
    upsertIngredient({
      ...draft,
      name: draft.name.trim(),
      priceEstimated: false,
      customUnits: draft.customUnits.filter((unit) => unit.label.trim() && unit.baseQty > 0),
    })
    toast(isNew ? 'Ingrediente creado' : 'Ingrediente actualizado', 'success')
    setDraft(null)
  }

  const remove = () => {
    if (!draft) return
    const usedIn = state.recipes.filter((recipe) =>
      recipe.lines.some((line) => line.ingredientId === draft.id),
    )
    const message = usedIn.length
      ? `"${draft.name}" se usa en ${usedIn.length} receta(s). Se quitará de ellas. ¿Eliminar?`
      : `¿Eliminar "${draft.name}" de tus ingredientes?`
    if (window.confirm(message)) {
      deleteIngredient(draft.id)
      toast('Ingrediente eliminado')
      setDraft(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ingredientes"
        title="Precios y paquetes"
        subtitle={`${ingredients.length} ingredientes · ${totalWithPrice} con precio`}
        actions={
          <IconButton icon="plus" label="Nuevo ingrediente" className="border-terra bg-terra text-white" onClick={openNew} />
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Ingredientes" value={String(ingredients.length)} icon="box" />
        <Stat label="Con precio" value={String(totalWithPrice)} icon="wallet" tone="good" />
        <Stat
          label="Por confirmar"
          value={String(estimated)}
          icon="alert"
          tone={estimated > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="relative mb-3">
        <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar ingrediente…"
          className={cn(inputClass, 'pl-10')}
          aria-label="Buscar ingredientes"
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={category === 'todas'} onClick={() => setCategory('todas')}>
          Todos
        </Chip>
        {usedCategories.map((item) => (
          <Chip
            key={item.id}
            active={category === item.id}
            onClick={() => setCategory(category === item.id ? 'todas' : item.id)}
          >
            {item.label}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="box"
          title={ingredients.length === 0 ? 'Aún no hay ingredientes' : 'No encontramos ingredientes'}
          description={
            ingredients.length === 0
              ? 'Agrega cada ingrediente con el precio y el tamaño del paquete que compras. Con eso calculamos el costo de tus recetas.'
              : 'Prueba con otra búsqueda o cambia la categoría.'
          }
          action={
            <Button onClick={openNew}>
              <Icon name="plus" className="h-4 w-4" /> Nuevo ingrediente
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((ingredient) => {
            return (
              <button
                key={ingredient.id}
                type="button"
                onClick={() => openEdit(ingredient)}
                className="w-full rounded-2xl border border-sand/70 bg-white/85 p-3.5 text-left shadow-[0_1px_2px_rgba(46,27,16,0.04)] transition active:scale-[0.995]"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate font-display text-[15px] font-semibold">{ingredient.name}</h3>
                      {ingredient.free && <Badge tone="neutral">sin costo</Badge>}
                      {ingredient.priceEstimated && <Badge tone="warn">referencia</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink/45">
                      {ingredientCategoryLabel(ingredient.category)} · {pricePerBaseLabel(ingredient)}
                    </p>
                  </div>
                  <Icon name="chevronRight" className="mt-1 h-4 w-4 shrink-0 text-ink/25" />
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-cream-deep/50 px-3 py-2">
                  <p className="text-[11.5px] text-ink/50">
                    Paquete: {formatCookQty(ingredient.packQty)}{' '}
                    {unitLabel(ingredient.packUnit, ingredient)}
                  </p>
                  <p className="text-[12.5px] font-semibold">
                    {ingredient.free ? 'Sin costo' : ingredient.packPrice > 0 ? money(ingredient.packPrice) : 'Sin precio'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Link to="/compras">
          <Button variant="secondary" block>
            <Icon name="cart" className="h-4 w-4" /> Actualizar precio con factura
          </Button>
        </Link>
      </div>

      {state.batches.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Tandas recientes</SectionTitle>
          <div className="space-y-1.5">
            {state.batches.slice(0, 5).map((batch) => (
              <div
                key={batch.id}
                className="flex items-center gap-3 rounded-2xl border border-sand/60 bg-white/60 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-butter/50 text-[#7a4515]">
                  <Icon name="flame" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">{batch.recipeName}</p>
                  <p className="text-[10.5px] text-ink/45">
                    {formatDateShort(batch.date)} · {formatCookQty(batch.units)} unidades ·{' '}
                    {money(batch.totalCost)} de costo
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <IngredientSheet
        draft={draft}
        isNew={isNew}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={remove}
      />
    </div>
  )
}

function IngredientSheet({
  draft,
  isNew,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Ingredient | null
  isNew: boolean
  onChange: (draft: Ingredient) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}) {
  if (!draft) return null

  const update = (patch: Partial<Ingredient>) => onChange({ ...draft, ...patch })
  const base = toBase(draft.packQty, draft.packUnit, draft)
  const perBase = base && base > 0 ? draft.packPrice / base : 0
  const packOptions = packUnitsFor(draft.baseUnit)

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Nuevo ingrediente' : 'Editar ingrediente'}
      subtitle="Precio, paquete y equivalencias"
      footer={
        <div className={cn('grid gap-2', isNew ? 'grid-cols-1' : 'grid-cols-[1fr,1.6fr]')}>
          {!isNew && (
            <Button variant="danger" onClick={onDelete}>
              <Icon name="trash" className="h-4 w-4" /> Eliminar
            </Button>
          )}
          <Button onClick={onSave}>
            <Icon name="check" className="h-4 w-4" /> Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre" htmlFor="ing-name">
          <TextInput
            id="ing-name"
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Ej.: Mantequilla sin sal"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Select
              value={draft.category}
              onChange={(event) => update({ category: event.target.value as IngredientCategory })}
            >
              {INGREDIENT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Se mide en" hint="Unidad base de la receta">
            <Select
              value={draft.baseUnit}
              onChange={(event) => {
                const baseUnit = event.target.value as BaseUnit
                const packUnit = baseUnit === 'unit' ? 'unidad' : baseUnit
                update({ baseUnit, packUnit, packQty: baseUnit === 'unit' ? 1 : 1000 })
              }}
            >
              <option value="g">Gramos</option>
              <option value="ml">Mililitros</option>
              <option value="unit">Unidades</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-2xl border border-sand/70 bg-white/60 p-3">
          <p className="mb-2 text-[12px] font-semibold text-ink/65">Precio de referencia</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pagué" htmlFor="pack-price">
              <MoneyInput
                id="pack-price"
                value={draft.packPrice}
                onChange={(value) => update({ packPrice: value })}
              />
            </Field>
            <div>
              <Field label="Por esta cantidad" htmlFor="pack-qty">
                <div className="grid grid-cols-[1fr,72px] gap-2">
                  <QtyInput
                    id="pack-qty"
                    value={draft.packQty}
                    onChange={(value) => update({ packQty: value })}
                  />
                  <Select
                    value={draft.packUnit}
                    onChange={(event) =>
                      update({ packUnit: event.target.value as Ingredient['packUnit'] })
                    }
                    className="px-2"
                    aria-label="Unidad del paquete"
                  >
                    {packOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-cream-deep/60 px-3 py-2 text-[12px]">
            <span className="text-ink/50">Costo por {baseUnitName(draft.baseUnit)}</span>
            <span className="font-semibold">
              {draft.free
                ? 'Sin costo'
                : perBase > 0
                  ? draft.baseUnit === 'unit'
                    ? `${money(perBase)} / u`
                    : `${money(perBase * 1000)} / ${draft.baseUnit === 'g' ? 'kg' : 'L'}`
                  : '—'}
            </span>
          </div>
          {base === null && !draft.free && (
            <p className="mt-1.5 text-[11px] font-medium text-berry">
              La unidad del paquete no se puede convertir a {baseUnitName(draft.baseUnit)}.
            </p>
          )}
          <div className="mt-2">
            <Toggle
              checked={Boolean(draft.free)}
              onChange={(checked) => update({ free: checked })}
              label="No suma al costo"
              hint="Agua, hielo u otros ingredientes gratuitos."
            />
          </div>
        </div>

        {draft.baseUnit === 'g' && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="g por taza" htmlFor="g-cup">
              <QtyInput
                id="g-cup"
                value={draft.gramsPerCup ?? 0}
                onChange={(value) => update({ gramsPerCup: value || undefined })}
                className="py-2 text-[14px]"
              />
            </Field>
            <Field label="g por cda" htmlFor="g-tbsp">
              <QtyInput
                id="g-tbsp"
                value={draft.gramsPerTbsp ?? 0}
                onChange={(value) => update({ gramsPerTbsp: value || undefined })}
                className="py-2 text-[14px]"
              />
            </Field>
            <Field label="g por cdta" htmlFor="g-tsp">
              <QtyInput
                id="g-tsp"
                value={draft.gramsPerTsp ?? 0}
                onChange={(value) => update({ gramsPerTsp: value || undefined })}
                className="py-2 text-[14px]"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Merma al usar" htmlFor="waste" hint="Cáscaras, recortes…">
            <QtyInput
              id="waste"
              value={draft.wastePct}
              onChange={(value) => update({ wastePct: value })}
              suffix="%"
            />
          </Field>
          <Field label="Proveedor" htmlFor="supplier">
            <TextInput
              id="supplier"
              value={draft.supplier ?? ''}
              onChange={(event) => update({ supplier: event.target.value })}
              placeholder="Super, feria…"
            />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink/65">Unidades propias</span>
            <button
              type="button"
              className="text-[11.5px] font-semibold text-terra"
              onClick={() =>
                update({
                  customUnits: [
                    ...draft.customUnits,
                    { id: uid('cu-'), label: '', baseQty: 1 },
                  ],
                })
              }
            >
              + Agregar
            </button>
          </div>
          <p className="mb-2 text-[11px] leading-snug text-ink/45">
            Para escribir la receta como en casa: barra = 115 g, docena = 12 u, taza = {trim(draft.gramsPerCup ?? 200)} g.
          </p>
          <div className="space-y-2">
            {draft.customUnits.map((unit, index) => (
              <div key={unit.id} className="flex items-center gap-2">
                <TextInput
                  value={unit.label}
                  onChange={(event) =>
                    update({
                      customUnits: draft.customUnits.map((u, i) =>
                        i === index ? { ...u, label: event.target.value } : u,
                      ),
                    })
                  }
                  placeholder="Nombre (barra)"
                  className="py-2 text-[14px]"
                />
                <QtyInput
                  value={unit.baseQty}
                  onChange={(value) =>
                    update({
                      customUnits: draft.customUnits.map((u, i) =>
                        i === index ? { ...u, baseQty: value } : u,
                      ),
                    })
                  }
                  className="w-24 py-2 text-[14px]"
                />
                <span className="text-[11px] text-ink/40">{baseUnitName(draft.baseUnit)}</span>
                <button
                  type="button"
                  onClick={() =>
                    update({ customUnits: draft.customUnits.filter((u) => u.id !== unit.id) })
                  }
                  aria-label="Quitar unidad"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-berry/70"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            ))}
            {draft.customUnits.length === 0 && (
              <p className="rounded-xl bg-cream-deep/50 px-3 py-2 text-[11.5px] text-ink/40">
                Sin unidades propias. Puedes seguir usando gramos, tazas y cucharadas.
              </p>
            )}
          </div>
        </div>

        <Field label="Notas" htmlFor="ing-notes">
          <TextInput
            id="ing-notes"
            value={draft.notes ?? ''}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="Marca preferida, dónde lo compras…"
          />
        </Field>

        <InfoNote>
          El precio y el paquete se actualizan automáticamente cuando registras una compra en{' '}
          <b>Compras</b> o una tanda en la receta.
        </InfoNote>
      </div>
    </Sheet>
  )
}

function packUnitsFor(baseUnit: BaseUnit) {
  if (baseUnit === 'unit') {
    return [{ value: 'unidad', label: 'u' }]
  }
  if (baseUnit === 'ml') {
    return STANDARD_UNITS.filter((unit) => ['ml', 'l', 'taza', 'cda', 'cdta'].includes(unit.key)).map(
      (unit) => ({ value: unit.key, label: unit.label }),
    )
  }
  return STANDARD_UNITS.filter((unit) =>
    ['g', 'kg', 'oz', 'lb', 'taza', 'cda', 'cdta'].includes(unit.key),
  ).map((unit) => ({ value: unit.key, label: unit.label }))
}
