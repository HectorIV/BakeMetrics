import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/store'
import type { Ingredient, PackagingItem, Recipe, RecipeLine } from '../types'
import { RECIPE_CATEGORIES } from '../lib/labels'
import { computeRecipeCost, lineCost, money, moneyPrecise, percent } from '../lib/cost'
import { STANDARD_UNITS, baseUnitName, formatBase, formatCookQty, trim } from '../lib/units'
import {
  Button,
  Card,
  Field,
  ImagePicker,
  InfoNote,
  MoneyInput,
  QtyInput,
  SectionTitle,
  Segmented,
  Select,
  Slider,
  TextArea,
  TextInput,
  Toggle,
  inputClass,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { toast } from '../lib/toast'
import { todayISO, uid } from '../lib/id'

export function RecipeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, upsertRecipe, deleteRecipe } = useApp()
  const editing = Boolean(id)
  const existing = state.recipes.find((recipe) => recipe.id === id)

  const [draft, setDraft] = useState<Recipe>(() =>
    existing ? { ...existing } : newRecipe(state.settings.itbmsDefault),
  )
  const [tagText, setTagText] = useState(() => (existing?.tags ?? []).join(', '))

  const ingredients = useMemo(
    () => [...state.ingredients].filter((i) => !i.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [state.ingredients],
  )

  const cost = useMemo(
    () => computeRecipeCost(draft, state.ingredients, state.settings, 1),
    [draft, state.ingredients, state.settings],
  )

  if (editing && !existing) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-xl font-semibold">No encontramos esa receta</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Volver al recetario
        </Button>
      </div>
    )
  }

  const update = (patch: Partial<Recipe>) => setDraft((current) => ({ ...current, ...patch }))

  const updateLine = (lineId: string, patch: Partial<RecipeLine>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }))

  const addLine = () => {
    const first = ingredients[0]
    if (!first) {
      toast('Primero agrega ingredientes con su precio', 'error')
      return
    }
    updateLineAdder(first)
  }

  const updateLineAdder = (ingredient: Ingredient) => {
    const unit = ingredient.baseUnit === 'g' ? 'g' : ingredient.baseUnit === 'ml' ? 'ml' : 'unidad'
    setDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { id: uid('line-'), ingredientId: ingredient.id, qty: 1, unit },
      ],
    }))
  }

  const addStep = () =>
    setDraft((current) => ({
      ...current,
      steps: [...current.steps, { id: uid('step-'), text: '' }],
    }))

  const addPackaging = () =>
    setDraft((current) => ({
      ...current,
      packagingItems: [
        ...(current.packagingItems ?? []),
        { id: uid('pack-'), name: '', packPrice: 0, coversUnits: 1 },
      ],
    }))

  const updatePackaging = (itemId: string, patch: Partial<PackagingItem>) =>
    setDraft((current) => ({
      ...current,
      packagingItems: (current.packagingItems ?? []).map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }))

  const removePackaging = (itemId: string) =>
    setDraft((current) => ({
      ...current,
      packagingItems: (current.packagingItems ?? []).filter((item) => item.id !== itemId),
    }))

  const save = () => {
    if (!draft.name.trim()) {
      toast('Ponle un nombre a la receta', 'error')
      return
    }
    if (!draft.yieldQty || draft.yieldQty <= 0) {
      toast('Indica cuántas unidades rinde', 'error')
      return
    }
    if (draft.lines.length === 0) {
      toast('Agrega al menos un ingrediente', 'error')
      return
    }
    const tags = tagText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const recipe: Recipe = {
      ...draft,
      name: draft.name.trim(),
      yieldLabel: draft.yieldLabel.trim() || 'unidades',
      tags,
      steps: draft.steps.filter((step) => step.text.trim()),
      updatedAt: todayISO(),
    }
    upsertRecipe(recipe)
    toast(editing ? 'Receta actualizada' : 'Receta creada', 'success')
    navigate(`/recetas/${recipe.id}`, { replace: true })
  }

  const remove = () => {
    if (!existing) return
    if (
      window.confirm(
        `¿Eliminar "${existing.name}"? Esta acción no se puede deshacer. Las horneadas registradas se conservan.`,
      )
    ) {
      deleteRecipe(existing.id)
      toast('Receta eliminada')
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        back
        eyebrow={editing ? 'Editar' : 'Nueva'}
        title={editing ? 'Editar receta' : 'Nueva receta'}
        subtitle="Los costos se calculan mientras escribes."
        actions={
          <Button size="sm" onClick={save}>
            <Icon name="check" className="h-4 w-4" /> Guardar
          </Button>
        }
      />

      {/* Datos básicos */}
      <Card className="space-y-3">
        <SectionTitle>Datos básicos</SectionTitle>
        <Field label="Nombre de la receta" htmlFor="recipe-name">
          <TextInput
            id="recipe-name"
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Ej.: Galletas de avena con chocolate"
          />
        </Field>

        <Field label="Descripción corta" htmlFor="recipe-description">
          <TextArea
            id="recipe-description"
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="Qué la hace especial, textura, sabor…"
            rows={2}
            className="min-h-16"
          />
        </Field>

        <Field label="Categoría">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
            {RECIPE_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => update({ category: category.id })}
                className={
                  draft.category === category.id
                    ? 'shrink-0 rounded-full bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white'
                    : 'shrink-0 rounded-full border border-sand bg-white px-3.5 py-2 text-[12.5px] font-semibold text-cocoa'
                }
              >
                {category.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Etiquetas" hint="Sepáralas con comas: saludable, sin azúcar, temporada…">
          <TextInput
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="chocolate, clásica, más vendida"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rinde" htmlFor="recipe-yield">
            <QtyInput
              id="recipe-yield"
              value={draft.yieldQty}
              onChange={(value) => update({ yieldQty: value })}
            />
          </Field>
          <Field label="Unidad de rendimiento" htmlFor="recipe-yield-label">
            <TextInput
              id="recipe-yield-label"
              value={draft.yieldLabel}
              onChange={(event) => update({ yieldLabel: event.target.value })}
              placeholder="galletas, muffins, porciones…"
            />
          </Field>
        </div>

        <Field
          label="Peso por unidad (g)"
          htmlFor="recipe-piece"
          hint={
            cost.weightUnits
              ? `Con el peso de la mezcla alcanzaría para ~${cost.weightUnits} unidades.`
              : 'Opcional. Se usa para sugerir cuántas unidades salen de la mezcla.'
          }
        >
          <QtyInput
            id="recipe-piece"
            value={draft.pieceGrams ?? 0}
            onChange={(value) => update({ pieceGrams: value || undefined })}
            suffix="g"
          />
        </Field>

        <ImagePicker
          label="Foto del producto"
          value={draft.imageDataUrl}
          onChange={(value) => update({ imageDataUrl: value })}
          hint="Se usa en el recetario y en las imágenes de promoción."
        />

        <Toggle
          checked={draft.favorite}
          onChange={(checked) => update({ favorite: checked })}
          label="Marcar como favorita"
          hint="Aparece primero en tu recetario."
        />
      </Card>

      {/* Ingredientes */}
      <Card className="space-y-3">
        <SectionTitle
          action={
            <Link to="/inventario" className="text-[11px] font-semibold text-terra">
              Ingredientes
            </Link>
          }
        >
          Ingredientes
        </SectionTitle>

        {ingredients.length === 0 && (
          <InfoNote tone="warn">
            No tienes ingredientes todavía. Ve a <b>Ingredientes</b> para crear el primero con su
            precio y unidad de compra.
          </InfoNote>
        )}

        <div className="space-y-2">
          {draft.lines.map((line, index) => {
            const ingredient = state.ingredients.find((i) => i.id === line.ingredientId)
            const detail = ingredient ? lineCost(line, state.ingredients, 1) : null
            const units = unitOptions(ingredient)
            return (
              <div key={line.id} className="rounded-2xl border border-sand/70 bg-white/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-butter/60 text-[10.5px] font-bold text-[#7a4515]">
                    {index + 1}
                  </span>
                  <Select
                    value={line.ingredientId}
                    onChange={(event) => {
                      const next = state.ingredients.find((i) => i.id === event.target.value)
                      if (!next) return
                      const unit = next.baseUnit === 'g' ? 'g' : next.baseUnit === 'ml' ? 'ml' : 'unidad'
                      updateLine(line.id, { ingredientId: next.id, unit })
                    }}
                    className="py-2 text-[14px]"
                    aria-label="Ingrediente"
                  >
                    {ingredients.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        lines: current.lines.filter((l) => l.id !== line.id),
                      }))
                    }
                    aria-label="Quitar ingrediente"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-berry/70"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-[1fr,1.15fr] gap-2">
                  <QtyInput
                    value={line.qty}
                    onChange={(value) => updateLine(line.id, { qty: value })}
                    aria-label="Cantidad"
                  />
                  <Select
                    value={line.unit}
                    onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                    className="py-2 text-[13.5px]"
                    aria-label="Unidad"
                  >
                    {units}
                  </Select>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <TextInput
                    value={line.note ?? ''}
                    onChange={(event) => updateLine(line.id, { note: event.target.value })}
                    placeholder="Nota: 1 taza, opcional…"
                    className="border-transparent bg-transparent px-1 py-1 text-[12px] focus:border-sand focus:ring-0"
                  />
                  <span className="shrink-0 text-[11px] font-semibold text-cocoa/70">
                    {detail
                      ? detail.baseQty !== null
                        ? `${moneyPrecise(detail.cost)} · ${formatBase(detail.baseQty, ingredient!.baseUnit)}`
                        : 'Unidad no compatible'
                      : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <Button variant="secondary" block onClick={addLine} disabled={ingredients.length === 0}>
          <Icon name="plus" className="h-4 w-4" /> Agregar ingrediente
        </Button>

        <div className="flex items-center justify-between rounded-2xl bg-cream-deep/60 px-3 py-2 text-[12px]">
          <span className="text-ink/50">Costo de ingredientes</span>
          <span className="font-semibold">{money(cost.ingredientsCost)}</span>
        </div>
      </Card>

      {/* Pasos */}
      <Card className="space-y-2.5">
        <SectionTitle action={<span className="text-[11px] text-ink/40">{draft.steps.length} pasos</span>}>
          Elaboración
        </SectionTitle>

        {draft.steps.map((step, index) => (
          <div key={step.id} className="rounded-2xl border border-sand/70 bg-white/60 p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-butter/60 text-[10.5px] font-bold text-[#7a4515]">
                {index + 1}
              </span>
              <textarea
                value={step.text}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.map((s) =>
                      s.id === step.id ? { ...s, text: event.target.value } : s,
                    ),
                  }))
                }
                placeholder="Describe el paso…"
                rows={2}
                className={`${inputClass} min-h-16 py-2 text-[14px]`}
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.filter((s) => s.id !== step.id),
                  }))
                }
                aria-label="Quitar paso"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-berry/70"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-8">
              <span className="text-[11px] text-ink/45">Tiempo</span>
              <div className="w-24">
                <QtyInput
                  value={step.minutes ?? 0}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      steps: current.steps.map((s) =>
                        s.id === step.id ? { ...s, minutes: value || undefined } : s,
                      ),
                    }))
                  }
                  suffix="min"
                  className="py-1.5 text-[13px]"
                />
              </div>
            </div>
          </div>
        ))}

        <Button variant="secondary" block onClick={addStep}>
          <Icon name="plus" className="h-4 w-4" /> Agregar paso
        </Button>
      </Card>

      {/* Horneado */}
      <Card className="space-y-3">
        <SectionTitle>Horneado</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Temperatura" htmlFor="bake-temp">
            <QtyInput
              id="bake-temp"
              value={draft.bake.tempC ?? 0}
              onChange={(value) => update({ bake: { ...draft.bake, tempC: value || undefined } })}
              suffix="°C"
            />
          </Field>
          <Field label="Tiempo" htmlFor="bake-minutes">
            <QtyInput
              id="bake-minutes"
              value={draft.bake.minutes ?? 0}
              onChange={(value) => update({ bake: { ...draft.bake, minutes: value || undefined } })}
              suffix="min"
            />
          </Field>
          <Field label="Refrigerar" htmlFor="bake-chill">
            <QtyInput
              id="bake-chill"
              value={draft.bake.chillMinutes ?? 0}
              onChange={(value) =>
                update({ bake: { ...draft.bake, chillMinutes: value || undefined } })
              }
              suffix="min"
            />
          </Field>
          <Field label="Reposo" htmlFor="bake-rest">
            <QtyInput
              id="bake-rest"
              value={draft.bake.restMinutes ?? 0}
              onChange={(value) =>
                update({ bake: { ...draft.bake, restMinutes: value || undefined } })
              }
              suffix="min"
            />
          </Field>
        </div>
        <Field label="Notas de horneado" htmlFor="bake-notes">
          <TextInput
            id="bake-notes"
            value={draft.bake.notes ?? ''}
            onChange={(event) => update({ bake: { ...draft.bake, notes: event.target.value } })}
            placeholder="Horno precalentado, rejilla del medio…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preparación" htmlFor="prep-minutes">
            <QtyInput
              id="prep-minutes"
              value={draft.prepMinutes}
              onChange={(value) => update({ prepMinutes: value })}
              suffix="min"
            />
          </Field>
          <Field label="Mano de obra" htmlFor="labor-minutes">
            <QtyInput
              id="labor-minutes"
              value={draft.laborMinutes}
              onChange={(value) => update({ laborMinutes: value })}
              suffix="min"
            />
          </Field>
        </div>
        <Field label="Notas de la receta" htmlFor="recipe-notes">
          <TextInput
            id="recipe-notes"
            value={draft.notes ?? ''}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="Sustituciones, secretos, observaciones…"
          />
        </Field>
      </Card>

      {/* Costos y precio */}
      <Card className="space-y-3">
        <SectionTitle>Costos y precio</SectionTitle>

        <div className="rounded-2xl border border-sand/70 bg-white/60 p-3">
          <p className="text-[12.5px] font-semibold">Empaques de esta receta</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink/45">
            Papel de muffin, envase plástico, caja de cartón, etiqueta… Anota el precio del
            paquete y para cuántas unidades alcanza.
          </p>

          <div className="mt-2 space-y-2">
            {(draft.packagingItems ?? []).map((item) => {
              const perUnit = item.coversUnits > 0 ? item.packPrice / item.coversUnits : 0
              return (
                <div key={item.id} className="rounded-xl border border-sand/60 bg-white/70 p-2">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={item.name}
                      onChange={(event) => updatePackaging(item.id, { name: event.target.value })}
                      placeholder="Ej. Papel de muffin"
                      aria-label="Nombre del empaque"
                      className="py-2 text-[13.5px]"
                    />
                    <button
                      type="button"
                      onClick={() => removePackaging(item.id)}
                      aria-label="Quitar empaque"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-berry/70"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-[1fr,1fr,auto] items-end gap-2">
                    <Field label="Precio del paquete">
                      <MoneyInput
                        value={item.packPrice}
                        onChange={(value) => updatePackaging(item.id, { packPrice: value })}
                        aria-label="Precio del paquete"
                      />
                    </Field>
                    <Field label="Rinde (unidades)">
                      <QtyInput
                        value={item.coversUnits}
                        onChange={(value) => updatePackaging(item.id, { coversUnits: value })}
                        aria-label="Unidades que cubre el paquete"
                      />
                    </Field>
                    <div className="pb-2.5 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">C/u</p>
                      <p className="text-[13px] font-semibold tabular-nums">{moneyPrecise(perUnit)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={addPackaging}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sand py-2 text-[12.5px] font-semibold text-cocoa"
          >
            <Icon name="plus" className="h-4 w-4" /> Agregar empaque
          </button>

          {(draft.packagingItems ?? []).length === 0 && (
            <p className="mt-2 text-[11px] leading-snug text-ink/45">
              Sin empaques detallados se usará {
                money(draft.packagingPerUnit ?? state.settings.packagingPerUnit)
              } por unidad.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gas / extras por tanda" htmlFor="extra">
            <MoneyInput
              id="extra"
              value={draft.extraCostPerBatch}
              onChange={(value) => update({ extraCostPerBatch: value })}
            />
          </Field>
          <Field label="Merma de la tanda" htmlFor="merma" hint="Pérdidas por pruebas, quema o recortes.">
            <QtyInput
              id="merma"
              value={draft.mermaPct}
              onChange={(value) => update({ mermaPct: value })}
              suffix="%"
            />
          </Field>
          <Field label="Tarifa de mano de obra" htmlFor="labor-rate" hint="Si la dejas igual a Ajustes, usa la global.">
            <MoneyInput
              id="labor-rate"
              value={draft.laborRate ?? state.settings.laborRatePerHour}
              onChange={(value) => update({ laborRate: value })}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-sand/70 bg-white/60 p-3">
          <Slider
            label="Margen de ganancia"
            value={draft.marginPct ?? state.settings.defaultMarginPct}
            min={10}
            max={85}
            step={1}
            suffix="%"
            onChange={(value) => update({ marginPct: value })}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-ink/45">
            Es el porcentaje del precio (sin ITBMS) que te queda como ganancia. Un margen de 60%
            significa que de cada $10 vendidos, $6 son ganancia y $4 cubren costos.
          </p>
        </div>

        <Field label="Modo de precio">
          <Segmented
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'manual', label: 'Precio fijo' },
            ]}
            value={draft.priceMode}
            onChange={(value) => update({ priceMode: value })}
          />
        </Field>

        {draft.priceMode === 'manual' && (
          <Field
            label="Precio de venta al cliente"
            hint={`Con ITBMS incluido. El costo por unidad es ${money(cost.costPerUnit)}.`}
          >
            <MoneyInput
              value={draft.manualPrice ?? 0}
              onChange={(value) => update({ manualPrice: value })}
            />
          </Field>
        )}

        <Toggle
          checked={draft.itbms}
          onChange={(checked) => update({ itbms: checked })}
          label={`Cobrar ITBMS (${state.settings.itbmsRate}%)`}
          hint="En Panamá aplica a productos gravados. Si aún no estás registrado, puedes desactivarlo."
        />

        <div className="rounded-3xl bg-ink p-4 text-cream">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-butter/80">
            Resultado con esta configuración
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Costo/u</p>
              <p className="font-display text-[19px] font-semibold leading-tight">
                {money(cost.costPerUnit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Precio</p>
              <p className="font-display text-[19px] font-semibold leading-tight">
                {money(cost.finalPrice)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cream/50">Ganancia</p>
              <p className="font-display text-[19px] font-semibold leading-tight text-butter">
                {money(cost.profitPerUnit)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-cream/60">
            Margen real {percent(cost.marginRealPct, 1)} · {formatCookQty(draft.yieldQty)}{' '}
            {draft.yieldLabel || 'unidades'} por tanda · {money(cost.totalCost)} de costo total
          </p>
          {cost.missingPrices.length > 0 && (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-butter">
              <Icon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />
              {cost.missingPrices.length === 1
                ? 'Falta el precio de 1 ingrediente; el cálculo está incompleto.'
                : `Faltan precios de ${cost.missingPrices.length} ingredientes; el cálculo está incompleto.`}
            </p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2 pb-2">
        <Button size="lg" block onClick={save}>
          <Icon name="check" className="h-4 w-4" /> {editing ? 'Guardar cambios' : 'Crear receta'}
        </Button>
        {editing && (
          <Button variant="danger" block onClick={remove}>
            <Icon name="trash" className="h-4 w-4" /> Eliminar receta
          </Button>
        )}
        <p className="text-center text-[10.5px] text-ink/35">
          {draft.pieceGrams
            ? `Cada unidad pesa ≈ ${trim(draft.pieceGrams)} g (${baseUnitName('g')}).`
            : 'Tip: define el peso por unidad para calcular cuántas salen de la mezcla.'}
        </p>
      </div>
    </div>
  )
}

function newRecipe(itbmsDefault: boolean): Recipe {
  const now = todayISO()
  return {
    id: uid('rec-'),
    name: '',
    description: '',
    category: 'galletas',
    tags: [],
    yieldQty: 12,
    yieldLabel: 'galletas',
    pieceGrams: 30,
    lines: [],
    steps: [],
    bake: { tempC: 180, minutes: 18 },
    prepMinutes: 15,
    laborMinutes: 30,
    extraCostPerBatch: 0.35,
    mermaPct: 2,
    priceMode: 'auto',
    itbms: itbmsDefault,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  }
}

function unitOptions(ingredient?: Ingredient) {
  if (!ingredient) {
    return STANDARD_UNITS.map((unit) => (
      <option key={unit.key} value={unit.key}>
        {unit.label}
      </option>
    ))
  }
  const custom = ingredient.customUnits ?? []
  return (
    <>
      {STANDARD_UNITS.map((unit) => (
        <option key={unit.key} value={unit.key}>
          {unit.label}
        </option>
      ))}
      {custom.map((unit) => (
        <option key={`cu:${unit.id}`} value={`cu:${unit.id}`}>
          {unit.label} ({trim(unit.baseQty)} {baseUnitName(ingredient.baseUnit)})
        </option>
      ))}
    </>
  )
}
