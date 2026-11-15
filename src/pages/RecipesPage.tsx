import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/store'
import { computeRecipeCost, ingredientValue, money, percent, pricePerBase } from '../lib/cost'
import { formatCookQty } from '../lib/units'
import { CATEGORY_GRADIENTS, RECIPE_CATEGORIES, recipeCategoryLabel } from '../lib/labels'
import { Badge, Card, Chip, EmptyState, IconButton, Stat, cn, inputClass } from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import type { RecipeCategory } from '../types'

export function RecipesPage() {
  const { state, upsertRecipe } = useApp()
  const navigate = useNavigate()
  const { recipes, ingredients, settings } = state
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'todas' | RecipeCategory>('todas')
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const costs = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, computeRecipeCost(recipe, ingredients, settings)])),
    [recipes, ingredients, settings],
  )

  const lowStock = ingredients.filter((i) => !i.archived && i.stock <= i.minStock && i.minStock > 0)
  const restockCost = lowStock.reduce(
    (sum, i) => sum + Math.max(0, i.minStock - i.stock) * pricePerBase(i),
    0,
  )

  const averageMargin = useMemo(() => {
    const values = recipes
      .map((r) => costs.get(r.id)?.marginRealPct ?? 0)
      .filter((value) => value > 0)
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }, [recipes, costs])

  const inventoryValue = ingredients.reduce((sum, i) => sum + ingredientValue(i), 0)
  const estimatedCount = ingredients.filter((i) => i.priceEstimated).length

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return recipes
      .filter((recipe) => {
        if (category !== 'todas' && recipe.category !== category) return false
        if (onlyFavorites && !recipe.favorite) return false
        if (!search) return true
        return (
          recipe.name.toLowerCase().includes(search) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(search))
        )
      })
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }, [recipes, query, category, onlyFavorites])

  const usedCategories = RECIPE_CATEGORIES.filter((c) => recipes.some((r) => r.category === c.id))

  return (
    <div>
      <PageHeader
        eyebrow={settings.businessName}
        title="Mi recetario"
        subtitle={
          recipes.length > 0
            ? `${recipes.length} ${recipes.length === 1 ? 'receta' : 'recetas'} · ${percent(averageMargin)} de margen promedio`
            : 'Agrega tu primera receta para empezar a calcular costos.'
        }
        actions={
          <IconButton
            icon="plus"
            label="Nueva receta"
            className="border-terra bg-terra text-white"
            onClick={() => navigate('/recetas/nueva')}
          />
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Recetas" value={String(recipes.length)} icon="book" />
        <Stat
          label="Inventario"
          value={money(inventoryValue)}
          icon="box"
          hint={`${ingredients.length} ingredientes`}
        />
        <Stat
          label="Por reponer"
          value={String(lowStock.length)}
          icon="alert"
          tone={lowStock.length > 0 ? 'warn' : 'good'}
          hint={lowStock.length > 0 ? money(restockCost) : 'Todo al día'}
        />
      </div>

      {lowStock.length > 0 && (
        <Link to="/inventario" className="mb-3 block">
          <div className="flex items-center gap-3 rounded-2xl border border-caramel/30 bg-butter/40 px-3.5 py-3">
            <Icon name="alert" className="h-5 w-5 shrink-0 text-terra" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#7a4515]">
                {lowStock.length} {lowStock.length === 1 ? 'ingrediente' : 'ingredientes'} por reponer
              </p>
              <p className="truncate text-[11.5px] text-[#7a4515]/70">
                {lowStock.slice(0, 3).map((i) => i.name).join(' · ')}
              </p>
            </div>
            <Icon name="chevronRight" className="h-4 w-4 text-[#7a4515]/60" />
          </div>
        </Link>
      )}

      {estimatedCount > 0 && (
        <Link to="/compras" className="mb-4 block">
          <div className="flex items-center gap-3 rounded-2xl border border-sand bg-white/60 px-3.5 py-3">
            <Icon name="info" className="h-5 w-5 shrink-0 text-cocoa/60" />
            <p className="flex-1 text-[12px] leading-snug text-ink/60">
              <span className="font-semibold text-ink/80">
                {estimatedCount === 1 ? '1 precio es de referencia.' : `${estimatedCount} precios son de referencia.`}
              </span>{' '}
              Regístralos con tus facturas para que los costos sean reales.
            </p>
            <Icon name="chevronRight" className="h-4 w-4 text-ink/30" />
          </div>
        </Link>
      )}

      <div className="relative mb-3">
        <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar receta, ingrediente o etiqueta…"
          className={cn(inputClass, 'pl-10')}
          aria-label="Buscar recetas"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-sand/60 text-ink/50"
            aria-label="Limpiar búsqueda"
          >
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={category === 'todas' && !onlyFavorites} onClick={() => { setCategory('todas'); setOnlyFavorites(false) }}>
          Todas
        </Chip>
        <Chip active={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}>
          <span className="flex items-center gap-1">
            <Icon name="star" className="h-3.5 w-3.5" filled={onlyFavorites} /> Favoritas
          </span>
        </Chip>
        {usedCategories.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? 'todas' : c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="book"
          title={recipes.length === 0 ? 'Tu recetario está vacío' : 'No encontramos recetas'}
          description={
            recipes.length === 0
              ? 'Empieza con una de tus recetas de galletas, muffins o pizza. El app calculará el costo por unidad y el precio de venta.'
              : 'Prueba con otra búsqueda o quita los filtros.'
          }
          action={
            recipes.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/recetas/nueva')}
                className="rounded-full bg-terra px-5 py-2.5 text-sm font-semibold text-white"
              >
                Crear mi primera receta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setQuery(''); setCategory('todas'); setOnlyFavorites(false) }}
                className="rounded-full border border-sand bg-white px-5 py-2.5 text-sm font-semibold"
              >
                Limpiar filtros
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((recipe) => {
            const cost = costs.get(recipe.id)!
            const gradient = CATEGORY_GRADIENTS[recipe.category]
            return (
              <Card key={recipe.id} className="relative overflow-hidden p-0">
                <Link to={`/recetas/${recipe.id}`} className="flex gap-3 p-3">
                  <div
                    className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                    style={{ background: gradient }}
                  >
                    {recipe.imageDataUrl ? (
                      <img src={recipe.imageDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon name="sparkles" className="h-7 w-7 text-white/85" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-start justify-between gap-1 pr-9">
                      <h3 className="font-display text-[17px] font-semibold leading-tight">{recipe.name}</h3>
                      <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink/35">
                        {recipeCategoryLabel(recipe.category)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink/45">
                      Rinde {formatCookQty(recipe.yieldQty)} {recipe.yieldLabel}
                      {recipe.pieceGrams ? ` · ${recipe.pieceGrams} g c/u` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-display text-[21px] font-semibold leading-none">
                        {money(cost.finalPrice)}
                      </span>
                      <span className="text-[10.5px] text-ink/40">c/u</span>
                      <Badge tone={cost.marginRealPct >= 55 ? 'good' : 'warn'}>
                        {percent(cost.marginRealPct)} margen
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-ink/45">
                      Costo {money(cost.costPerUnit)} · Ganancia {money(cost.profitPerUnit)}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => upsertRecipe({ ...recipe, favorite: !recipe.favorite, updatedAt: new Date().toISOString() })}
                  aria-label={recipe.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                  className={cn(
                    'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition',
                    recipe.favorite ? 'bg-butter text-[#8a4b14]' : 'bg-sand/40 text-ink/30',
                  )}
                >
                  <Icon name="star" className="h-4 w-4" filled={recipe.favorite} />
                </button>
                {cost.missingPrices.length > 0 && (
                  <div className="flex items-center gap-1.5 border-t border-sand/50 bg-cream-deep/60 px-3 py-1.5 text-[10.5px] font-medium text-[#8a4b14]">
                    <Icon name="alert" className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {cost.missingPrices.length === 1
                        ? 'Falta 1 precio'
                        : `Faltan ${cost.missingPrices.length} precios`}
                      : {cost.missingPrices.slice(0, 2).join(', ')}
                    </span>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {recipes.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/recetas/nueva')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-terra/40 bg-white/50 py-3.5 text-[13px] font-semibold text-terra"
        >
          <Icon name="plus" className="h-4 w-4" /> Nueva receta
        </button>
      )}
    </div>
  )
}
