import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/store'
import {
  batchPlan,
  computeRecipeCost,
  money,
  moneyPrecise,
  percent,
} from '../lib/cost'
import { formatBase, formatCookQty, toBase, trim, unitLabel } from '../lib/units'
import { CATEGORY_GRADIENTS, recipeCategoryLabel } from '../lib/labels'
import {
  Badge,
  Button,
  Card,
  IconButton,
  InfoNote,
  QtyInput,
  SectionTitle,
  cn,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { TandaSheet } from '../components/TandaSheet'
import { toast } from '../lib/toast'
import { formatDateShort } from '../lib/id'
import type { Ingredient } from '../types'

export function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, upsertRecipe, toggleShopping } = useApp()
  const recipe = state.recipes.find((r) => r.id === id)

  const [factor, setFactor] = useState(1)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [tandaOpen, setTandaOpen] = useState(false)
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({})

  const baseCost = useMemo(
    () => (recipe ? computeRecipeCost(recipe, state.ingredients, state.settings, 1) : null),
    [recipe, state.ingredients, state.settings],
  )
  const cost = useMemo(
    () => (recipe ? computeRecipeCost(recipe, state.ingredients, state.settings, factor) : null),
    [recipe, state.ingredients, state.settings, factor],
  )
  const shoppingItems = useMemo(() => {
    if (!recipe) return []
    const ids = [...new Set(recipe.lines.map((line) => line.ingredientId))]
    return ids
      .map((ingredientId) => {
        const ingredient = state.ingredients.find((item) => item.id === ingredientId)
        if (!ingredient) return null
        const neededBase = recipe.lines
          .filter((line) => line.ingredientId === ingredientId)
          .reduce(
            (sum, line) => sum + (toBase(line.qty * factor, line.unit, ingredient) ?? 0),
            0,
          )
        const packBase = toBase(ingredient.packQty, ingredient.packUnit, ingredient)
        const packs =
          packBase && packBase > 0 ? Math.max(1, Math.ceil(neededBase / packBase)) : 1
        return { ingredient, neededBase, packs }
      })
      .filter(
        (item): item is { ingredient: Ingredient; neededBase: number; packs: number } =>
          item !== null,
      )
  }, [recipe, state.ingredients, factor])

  if (!recipe || !cost || !baseCost) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-xl font-semibold">Receta no encontrada</p>
        <p className="mt-1 text-sm text-ink/50">Quizá la eliminaste o el enlace está roto.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Volver al recetario
        </Button>
      </div>
    )
  }

  const plan = batchPlan(recipe, recipe.yieldQty * factor)
  const stepDoneCount = recipe.steps.filter((s) => doneSteps[s.id]).length
  const gradient = CATEGORY_GRADIENTS[recipe.category]
  const hasEstimatedPrices = cost.lines.some((l) => l.ingredient?.priceEstimated)
  const recentBatches = state.batches.filter((batch) => batch.recipeId === recipe.id).slice(0, 5)
  const checkedCount = shoppingItems.filter(
    (item) => state.shoppingChecks[`${recipe.id}:${item.ingredient.id}`],
  ).length

  const clearRecipeChecks = () => {
    for (const item of shoppingItems) {
      const key = `${recipe.id}:${item.ingredient.id}`
      if (state.shoppingChecks[key]) toggleShopping(key)
    }
  }

  const copyShoppingList = async () => {
    const text = shoppingItems
      .map(
        (item) =>
          `• ${item.ingredient.name}: ${formatBase(item.neededBase, item.ingredient.baseUnit)} (${item.packs} ${
            item.packs === 1 ? 'paquete' : 'paquetes'
          })`,
      )
      .join('\n')
    try {
      await navigator.clipboard.writeText(
        `Lista para ${recipe.name} (${formatCookQty(cost.units)} ${recipe.yieldLabel}):\n${text}`,
      )
      toast('Lista copiada', 'success')
    } catch {
      toast('No pudimos copiar. Selecciona el texto manualmente.', 'error')
    }
  }

  return (
    <div className="space-y-3.5">
      {/* Portada */}
      <section className="relative overflow-hidden rounded-[30px] border border-sand/60 shadow-soft">
        <div
          className="relative flex min-h-[230px] flex-col justify-end"
          style={{ background: gradient }}
        >
          {recipe.imageDataUrl && (
            <img
              src={recipe.imageDataUrl}
              alt={recipe.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/10" />
          <div className="relative flex items-start justify-between p-3">
            <IconButton
              icon="chevronLeft"
              label="Volver"
              className="border-white/30 bg-white/90"
              onClick={() => navigate(-1)}
            />
            <div className="flex gap-2">
              <IconButton
                icon="star"
                label="Favorita"
                filled={recipe.favorite}
                className={cn(
                  'border-white/30',
                  recipe.favorite ? 'bg-butter text-[#8a4b14]' : 'bg-white/90',
                )}
                onClick={() =>
                  upsertRecipe({
                    ...recipe,
                    favorite: !recipe.favorite,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
              <IconButton
                icon="pencil"
                label="Editar receta"
                className="border-white/30 bg-white/90"
                onClick={() => navigate(`/recetas/${recipe.id}/editar`)}
              />
            </div>
          </div>
          <div className="relative px-4 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-butter">
              {recipeCategoryLabel(recipe.category)}
            </p>
            <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-white">
              {recipe.name}
            </h1>
            <p className="mt-1 text-[12.5px] text-white/75">
              Rinde {formatCookQty(recipe.yieldQty)} {recipe.yieldLabel}
              {recipe.pieceGrams ? ` · ${recipe.pieceGrams} g c/u` : ''}
              {recipe.prepMinutes ? ` · ${recipe.prepMinutes + recipe.laborMinutes} min` : ''}
            </p>
            {recipe.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-medium text-white/90 backdrop-blur"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(cost.missingPrices.length > 0 || cost.missingConversions.length > 0) && (
        <InfoNote tone="warn" icon="alert">
          {cost.missingPrices.length > 0 && (
            <p>
              Sin precio: {cost.missingPrices.join(', ')}. El costo está incompleto.{' '}
              <Link to="/inventario" className="font-semibold underline">
                Poner precios
              </Link>
            </p>
          )}
          {cost.missingConversions.length > 0 && (
            <p>
              Revisa la unidad de: {cost.missingConversions.join(', ')}. No pudimos convertirla a
              la unidad base del ingrediente.
            </p>
          )}
        </InfoNote>
      )}

      {/* Precio y costos */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
              Precio de venta
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-[36px] font-semibold leading-none">
                {money(cost.finalPrice)}
              </span>
              <span className="text-[12px] text-ink/40">c/u</span>
            </div>
            <p className="mt-1 text-[11.5px] text-ink/45">
              {recipe.itbms
                ? `Incluye ITBMS ${percent(state.settings.itbmsRate)} (${money(cost.itbmsAmount)})`
                : 'Sin ITBMS'}
              {recipe.priceMode === 'manual' ? ' · precio manual' : ''}
            </p>
            {hasEstimatedPrices && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-caramel/15 px-2 py-0.5 text-[10px] font-semibold text-[#8a4b14]">
                <Icon name="info" className="h-3 w-3" /> precios de referencia
              </p>
            )}
          </div>
          <div className="text-right">
            <Badge tone={cost.marginRealPct >= 55 ? 'good' : cost.marginRealPct >= 30 ? 'warn' : 'bad'}>
              {percent(cost.marginRealPct, 1)} margen
            </Badge>
            <p className="mt-1.5 text-[11px] text-ink/40">Markup {percent(cost.markupPct)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-sand/70 rounded-2xl bg-cream-deep/60 py-2.5 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Costo</p>
            <p className="mt-0.5 text-[15px] font-semibold">{money(cost.costPerUnit)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Ganancia</p>
            <p className="mt-0.5 text-[15px] font-semibold text-sage">{money(cost.profitPerUnit)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Por tanda</p>
            <p className="mt-0.5 text-[15px] font-semibold">{money(cost.totalProfit)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="mt-3 flex w-full items-center justify-between text-[12.5px] font-semibold text-cocoa"
        >
          Ver desglose del costo
          <Icon name="chevronDown" className={cn('h-4 w-4 transition', showBreakdown && 'rotate-180')} />
        </button>

        {showBreakdown && (
          <div className="mt-2 space-y-1.5 rounded-2xl bg-cream-deep/50 p-3 text-[12.5px]">
            <Row label="Ingredientes" value={money(cost.ingredientsCost)} />
            {cost.mermaCost > 0 && <Row label={`Merma (${recipe.mermaPct}%)`} value={money(cost.mermaCost)} />}
            <Row label={`Mano de obra (${recipe.laborMinutes} min)`} value={money(cost.laborCost)} />
            <Row label="Empaque" value={money(cost.packagingCost)} />
            {cost.packagingLines.length > 0 && (
              <ul className="space-y-1 border-l border-sand pl-2.5 text-[11.5px] text-ink/50">
                {cost.packagingLines.map(({ item, perUnit }) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums">{moneyPrecise(perUnit)}/u</span>
                  </li>
                ))}
              </ul>
            )}
            {cost.extraCost > 0 && <Row label="Gas / extras" value={money(cost.extraCost)} />}
            <Row label={`Gastos indirectos (${state.settings.overheadPct}%)`} value={money(cost.overhead)} />
            <div className="my-1 border-t border-sand" />
            <Row label="Costo total de la tanda" value={money(cost.totalCost)} strong />
            <Row label="Costo por unidad" value={moneyPrecise(cost.costPerUnit)} />
            <Row label="Precio sin ITBMS" value={money(cost.pricePreTax)} />
            <Row label="ITBMS" value={money(cost.itbmsAmount)} />
            <Row label="Precio al cliente" value={money(cost.finalPrice)} strong />
          </div>
        )}
      </Card>

      {/* Escalado */}
      <Card>
        <SectionTitle
          action={
            recipe.pieceGrams && baseCost.totalWeightG > 0 ? (
              <span className="text-[10.5px] text-ink/40">
                ≈ {Math.round(baseCost.totalWeightG)} g de mezcla
              </span>
            ) : undefined
          }
        >
          Escalar la receta
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          {[0.5, 1, 2, 3].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setFactor(preset)}
              className={cn(
                'min-w-[52px] rounded-xl border px-3 py-2 text-[13px] font-semibold transition',
                Math.abs(factor - preset) < 0.001
                  ? 'border-terra bg-terra text-white'
                  : 'border-sand bg-white text-cocoa',
              )}
            >
              {preset}×
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-ink/50">Quiero</span>
            <div className="w-[86px]">
              <QtyInput
                value={Math.round(recipe.yieldQty * factor * 100) / 100}
                onChange={(value) => setFactor(value / recipe.yieldQty)}
                aria-label={`Unidades de ${recipe.yieldLabel}`}
              />
            </div>
            <span className="text-[12px] font-medium text-ink/50">{recipe.yieldLabel}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-cream-deep/60 p-3 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Unidades</p>
            <p className="font-display text-[20px] font-semibold leading-tight">{formatCookQty(cost.units)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Costo total</p>
            <p className="font-display text-[20px] font-semibold leading-tight">{money(cost.totalCost)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">Ingreso</p>
            <p className="font-display text-[20px] font-semibold leading-tight">{money(cost.totalRevenue)}</p>
          </div>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink/45">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {plan.wholeBatches > 1
              ? `Son ${plan.wholeBatches} tandas completas (${formatCookQty(plan.wholeUnits)} ${recipe.yieldLabel}${
                  plan.leftoverUnits > 0.01 ? `, ${formatCookQty(plan.leftoverUnits)} extra` : ''
                }).`
              : 'Una sola tanda.'}{' '}
            Labor y gas se escalan junto con la receta.
          </span>
        </p>

        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink/45">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            La lista de compra y el costo se ajustan a esta cantidad. Registra lo que pagaste en
            “Registrar tanda”.
          </span>
        </p>
      </Card>

      {/* Ingredientes */}
      <Card>
        <SectionTitle action={<span className="text-[11px] text-ink/40">{money(cost.ingredientsCost)} en ingredientes</span>}>
          Ingredientes · {recipe.yieldLabel}
        </SectionTitle>
        <ul className="divide-y divide-sand/50">
          {cost.lines.map(({ line, ingredient, cost: lineTotal, baseQty }) => (
            <li key={line.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{ingredient?.name ?? 'Ingrediente eliminado'}</p>
                <p className="text-[11px] text-ink/45">
                  {ingredient
                    ? [
                        formatQty(line.qty * factor, line.unit, ingredient),
                        baseQty !== null && isVolumetricUnit(line.unit)
                          ? formatBase(baseQty, ingredient.baseUnit)
                          : null,
                        baseQty === null ? 'unidad inválida' : null,
                        ingredient.free ? 'sin costo' : null,
                        line.note || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Revisa esta línea'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12.5px] font-semibold">
                  {ingredient?.free ? '—' : moneyPrecise(lineTotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {cost.lines.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-ink/40">Esta receta no tiene ingredientes todavía.</p>
        )}
      </Card>

      {/* Empaques */}
      <Card>
        <SectionTitle
          action={<span className="text-[11px] text-ink/40">{money(cost.packagingCost)} por tanda</span>}
        >
          Empaques
        </SectionTitle>
        {cost.packagingLines.length > 0 ? (
          <>
            <ul className="divide-y divide-sand/50">
              {cost.packagingLines.map(({ item, perUnit, total }) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                    <p className="text-[11px] text-ink/45">
                      {money(item.packPrice)} rinde {formatCookQty(item.coversUnits)}{' '}
                      {item.coversUnits === 1 ? 'unidad' : 'unidades'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12.5px] font-semibold">{moneyPrecise(perUnit)} c/u</p>
                    <p className="text-[10.5px] text-ink/40">{money(total)} por tanda</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-ink/45">
              Precios de ejemplo: ajústalos con lo que pagas en cada paquete desde Editar receta.
            </p>
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-ink/50">
            Sin empaques detallados. Se usa el costo por unidad de Ajustes:{' '}
            <strong className="text-ink/70">
              {money(cost.packagingCost / Math.max(cost.units, 1))}
            </strong>
            {' '}por unidad. Puedes detallar los empaques desde Editar receta.
          </p>
        )}
      </Card>

      {/* Lista de compra */}
      <Card>
        <SectionTitle
          action={
            <div className="flex items-center gap-1.5">
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={clearRecipeChecks}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-ink/45"
                >
                  Desmarcar
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyShoppingList()}
                className="flex items-center gap-1 rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-cocoa"
              >
                <Icon name="copy" className="h-3 w-3" /> Copiar
              </button>
            </div>
          }
        >
          Lista de compra
        </SectionTitle>
        <p className="text-[11.5px] leading-snug text-ink/45">
          Para {formatCookQty(cost.units)} {recipe.yieldLabel}.{' '}
          {checkedCount > 0
            ? `${checkedCount} de ${shoppingItems.length} ya en casa.`
            : 'Marca lo que ya tienes en casa.'}
        </p>
        <ul className="mt-1 divide-y divide-sand/50">
          {shoppingItems.map((item) => {
            const key = `${recipe.id}:${item.ingredient.id}`
            const checked = Boolean(state.shoppingChecks[key])
            return (
              <li key={item.ingredient.id}>
                <label className="flex cursor-pointer items-start gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleShopping(key)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-terra"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-[13.5px] font-medium',
                        checked && 'text-ink/40 line-through',
                      )}
                    >
                      {item.ingredient.name}
                    </span>
                    <span className="block text-[11px] text-ink/45">
                      Necesitas {formatBase(item.neededBase, item.ingredient.baseUnit)} ·{' '}
                      {item.packs} {item.packs === 1 ? 'paquete' : 'paquetes'} de{' '}
                      {formatCookQty(item.ingredient.packQty)}{' '}
                      {unitLabel(item.ingredient.packUnit, item.ingredient)}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {shoppingItems.length === 0 && (
          <p className="py-3 text-center text-[12px] text-ink/40">
            Agrega ingredientes a la receta para generar la lista.
          </p>
        )}
      </Card>

      {/* Tandas registradas */}
      {recentBatches.length > 0 && (
        <Card>
          <SectionTitle
            action={
              <span className="text-[11px] text-ink/40">
                {recentBatches.length} registrada{recentBatches.length === 1 ? '' : 's'}
              </span>
            }
          >
            Tandas registradas
          </SectionTitle>
          <ul className="divide-y divide-sand/50">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-medium">
                    {formatDateShort(batch.date)} · {formatCookQty(batch.units)} {recipe.yieldLabel}
                  </p>
                  <p className="shrink-0 text-[12.5px] font-semibold">{money(batch.totalCost)}</p>
                </div>
                <p className="text-[11px] leading-snug text-ink/45">
                  Costo {money(batch.totalCost / Math.max(batch.units, 1))} c/u · Venta{' '}
                  {money(batch.pricePerUnit)}
                  {batch.spent ? ` · Pagaste ${money(batch.spent)}` : ''}
                  {batch.notes ? ` · ${batch.notes}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Pasos */}
      {recipe.steps.length > 0 && (
        <Card>
          <SectionTitle
            action={
              <span className="text-[11px] text-ink/40">
                {stepDoneCount}/{recipe.steps.length} listos
              </span>
            }
          >
            Paso a paso
          </SectionTitle>
          <ol className="space-y-1">
            {recipe.steps.map((step, index) => {
              const done = Boolean(doneSteps[step.id])
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setDoneSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl px-1 py-2 text-left transition',
                      done && 'opacity-45',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        done ? 'bg-sage text-white' : 'bg-butter/70 text-[#7a4515]',
                      )}
                    >
                      {done ? <Icon name="check" className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="flex-1">
                      <span className={cn('block text-[13px] leading-relaxed', done && 'line-through')}>
                        {step.text}
                      </span>
                      {step.minutes ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-ink/40">
                          <Icon name="clock" className="h-3 w-3" /> {step.minutes} min
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </Card>
      )}

      {/* Horneado */}
      <Card>
        <SectionTitle>Horneado</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {recipe.bake.tempC ? <BakeChip icon="thermometer" text={`${recipe.bake.tempC} °C`} /> : null}
          {recipe.bake.minutes ? <BakeChip icon="clock" text={`${recipe.bake.minutes} min`} /> : null}
          {recipe.bake.chillMinutes ? <BakeChip icon="flask" text={`Frío ${recipe.bake.chillMinutes} min`} /> : null}
          {recipe.bake.restMinutes ? <BakeChip icon="clock" text={`Reposo ${recipe.bake.restMinutes} min`} /> : null}
          {recipe.bake.tempC ? (
            <BakeChip icon="flame" text={`${Math.round((recipe.bake.tempC * 9) / 5 + 32)} °F`} />
          ) : null}
        </div>
        {recipe.bake.notes && (
          <p className="mt-2 text-[12px] leading-relaxed text-ink/55">{recipe.bake.notes}</p>
        )}
        {recipe.notes && (
          <p className="mt-2 rounded-xl bg-cream-deep/60 px-3 py-2 text-[12px] leading-relaxed text-ink/60">
            {recipe.notes}
          </p>
        )}
      </Card>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => setTandaOpen(true)}>
          <Icon name="flame" className="h-4 w-4" /> Registrar tanda
        </Button>
        <Link to={`/promo?recipe=${recipe.id}`}>
          <Button size="lg" variant="secondary" block>
            <Icon name="sparkles" className="h-4 w-4" /> Crear promo
          </Button>
        </Link>
      </div>

      <p className="pb-2 text-center text-[10.5px] text-ink/35">
        Actualizada {new Date(recipe.updatedAt).toLocaleDateString('es-PA', { day: 'numeric', month: 'long' })}
      </p>

      <TandaSheet
        open={tandaOpen}
        onClose={() => setTandaOpen(false)}
        recipe={recipe}
        units={cost.units}
      />
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-ink/55', strong && 'font-semibold text-ink')}>{label}</span>
      <span className={cn('tabular-nums', strong && 'font-semibold')}>{value}</span>
    </div>
  )
}

function BakeChip({ icon, text }: { icon: 'thermometer' | 'clock' | 'flame' | 'flask'; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1.5 text-[11.5px] font-semibold text-cocoa">
      <Icon name={icon} className="h-3.5 w-3.5" /> {text}
    </span>
  )
}

function formatQty(qty: number, unit: string, ingredient: Ingredient) {
  if (['g', 'ml', 'oz', 'lb', 'kg', 'l'].includes(unit)) {
    return `${trim(qty, qty < 10 ? 2 : 1)} ${unitLabel(unit, ingredient)}`
  }
  return `${formatCookQty(qty)} ${unitLabel(unit, ingredient)}`
}

/** Unidades de volumen o propias: conviene mostrar también la equivalencia base. */
function isVolumetricUnit(unit: string) {
  return unit === 'taza' || unit === 'cda' || unit === 'cdta' || unit.startsWith('cu:')
}
