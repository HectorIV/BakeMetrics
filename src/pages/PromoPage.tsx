import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../store/store'
import { computeRecipeCost, money } from '../lib/cost'
import { buildCaption } from '../lib/caption'
import { renderPromo, sharePromo, TEMPLATE_INFO, type PromoTemplate } from '../lib/promo'
import { downloadBlob, slugify } from '../lib/image'
import {
  Button,
  Card,
  EmptyState,
  Field,
  ImagePicker,
  InfoNote,
  MoneyInput,
  SectionTitle,
  Segmented,
  Select,
  Toggle,
  TextArea,
  cn,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { toast } from '../lib/toast'

export function PromoPage() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const { recipes, ingredients, settings } = state

  const initialId = params.get('recipe')
  const [recipeId, setRecipeId] = useState(
    (initialId && recipes.some((r) => r.id === initialId) ? initialId : recipes[0]?.id) ?? '',
  )
  const recipe = recipes.find((r) => r.id === recipeId)
  const cost = useMemo(
    () => (recipe ? computeRecipeCost(recipe, ingredients, settings) : null),
    [recipe, ingredients, settings],
  )

  const [template, setTemplate] = useState<PromoTemplate>('square')
  const [price, setPrice] = useState(cost?.finalPrice ?? 0)
  const [showPrice, setShowPrice] = useState(true)
  const [showIngredients, setShowIngredients] = useState(true)
  const [photo, setPhoto] = useState<string | null>(recipe?.imageDataUrl ?? null)
  const [preview, setPreview] = useState<string>('')
  const [caption, setCaption] = useState('')
  const [captionDirty, setCaptionDirty] = useState(false)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!recipe) return
    setPrice(computeRecipeCost(recipe, ingredients, settings).finalPrice)
    setPhoto(recipe.imageDataUrl ?? null)
    setCaption(buildCaption(recipe, settings, ingredients, computeRecipeCost(recipe, ingredients, settings).finalPrice))
    setCaptionDirty(false)
    // Solo cuando cambia la receta elegida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId])

  useEffect(() => {
    if (!recipe || !cost) return
    let cancelled = false
    setRendering(true)
    const timer = window.setTimeout(async () => {
      try {
        const canvas = await renderPromo({
          recipe,
          ingredients,
          cost,
          settings,
          template,
          price,
          showPrice,
          showIngredients,
          photo,
        })
        if (cancelled) return
        canvasRef.current = canvas
        setPreview(canvas.toDataURL('image/jpeg', 0.92))
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'No pudimos crear la imagen', 'error')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [recipe, cost, ingredients, settings, template, price, showPrice, showIngredients, photo])

  useEffect(() => {
    if (!captionDirty && recipe && cost) {
      setCaption(buildCaption(recipe, settings, ingredients, price))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price])

  if (recipes.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Promo" title="Arte para redes" />
        <EmptyState
          icon="sparkles"
          title="Primero crea una receta"
          description="Con una receta lista podemos armar imágenes de 1080 × 1080 y 1080 × 1920 con tu marca, precio e ingredientes."
          action={
            <Link to="/recetas/nueva">
              <Button>Crear receta</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (!recipe || !cost) {
    return (
      <EmptyState
        icon="sparkles"
        title="Elige una receta"
        action={
          <Select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        }
      />
    )
  }

  const filename = `${slugify(recipe.name)}-${template}.png`

  const handleShare = async () => {
    if (!canvasRef.current) return
    try {
      const result = await sharePromo(canvasRef.current, filename, caption)
      toast(result === 'shared' ? 'Imagen lista para compartir' : 'Imagen descargada', 'success')
    } catch {
      toast('No pudimos compartir la imagen', 'error')
    }
  }

  const handleDownload = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      toast('No pudimos generar la imagen', 'error')
      return
    }
    downloadBlob(blob, filename)
    toast('PNG descargado', 'success')
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      toast('Texto copiado', 'success')
    } catch {
      toast('No pudimos copiar el texto', 'error')
    }
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        eyebrow="Promo"
        title="Arte para redes"
        subtitle="Imágenes listas para Instagram, Facebook y WhatsApp."
      />

      <Card className="space-y-3">
        <Field label="Receta">
          <Select
            value={recipeId}
            onChange={(event) => {
              const nextId = event.target.value
              setRecipeId(nextId)
              const next = recipes.find((r) => r.id === nextId)
              if (next) {
                const nextCost = computeRecipeCost(next, ingredients, settings)
                setPrice(nextCost.finalPrice)
                setPhoto(next.imageDataUrl ?? null)
                setCaption(buildCaption(next, settings, ingredients, nextCost.finalPrice))
                setCaptionDirty(false)
              }
              setParams({ recipe: nextId }, { replace: true })
            }}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        <Segmented
          options={[
            { value: 'square', label: 'Post' },
            { value: 'story', label: 'Historia' },
            { value: 'card', label: 'Receta' },
          ]}
          value={template}
          onChange={setTemplate}
        />
        <p className="text-center text-[11px] text-ink/45">
          {TEMPLATE_INFO[template].hint}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Precio en la imagen"
            hint={`Sugerido: ${money(cost.finalPrice)}`}
          >
            <MoneyInput value={price} onChange={setPrice} />
          </Field>
          <Field label="Tamaño" hint={TEMPLATE_INFO[template].label}>
            <div className="flex h-[42px] items-center gap-2 rounded-2xl bg-cream-deep/60 px-3 text-[12px] text-ink/55">
              <Icon name="image" className="h-4 w-4" />
              {TEMPLATE_INFO[template].width} × {TEMPLATE_INFO[template].height}
            </div>
          </Field>
        </div>

        <Toggle
          checked={showPrice}
          onChange={setShowPrice}
          label="Mostrar precio"
          hint="Puedes ocultarlo si prefieres que te escriban por el precio."
        />
        <Toggle
          checked={showIngredients}
          onChange={setShowIngredients}
          label="Incluir ingredientes"
          hint="Disponible en la historia y en la tarjeta de receta."
        />

        <ImagePicker
          label="Foto para la promo (opcional)"
          value={photo ?? undefined}
          onChange={(value) => setPhoto(value ?? null)}
          hint="Si no subes una, se dibuja una ilustración del producto."
        />
        {recipe.imageDataUrl && photo !== recipe.imageDataUrl && (
          <button
            type="button"
            onClick={() => setPhoto(recipe.imageDataUrl ?? null)}
            className="text-[11.5px] font-semibold text-terra"
          >
            Usar la foto guardada en la receta
          </button>
        )}

        {cost.missingPrices.length > 0 && (
          <InfoNote tone="warn" icon="alert">
            {cost.missingPrices.length === 1
              ? 'Falta el precio de 1 ingrediente. Revísalo antes de publicar.'
              : `Faltan precios de ${cost.missingPrices.length} ingredientes. Revísalos antes de publicar.`}
          </InfoNote>
        )}
      </Card>

      {/* Vista previa */}
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle className="mb-0">Vista previa</SectionTitle>
          {rendering && <span className="text-[10.5px] font-medium text-ink/40">Generando…</span>}
        </div>
        <div
          className={cn(
            'relative mx-auto overflow-hidden rounded-2xl bg-cream-deep',
            template === 'story' ? 'max-w-[270px]' : template === 'card' ? 'max-w-[320px]' : 'max-w-[340px]',
          )}
        >
          {preview ? (
            <img src={preview} alt="Vista previa de la promoción" className="block h-auto w-full" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-ink/30">
              <Icon name="sparkles" className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => void handleShare()}>
            <Icon name="share" className="h-4 w-4" /> Compartir
          </Button>
          <Button variant="secondary" onClick={() => void handleDownload()}>
            <Icon name="download" className="h-4 w-4" /> Descargar
          </Button>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-ink/35">
          PNG de {TEMPLATE_INFO[template].width} × {TEMPLATE_INFO[template].height} px.
          {typeof navigator !== 'undefined' && 'share' in navigator
            ? ' En el celular puedes enviarla directo a Instagram o WhatsApp.'
            : ''}
        </p>
      </Card>

      {/* Texto */}
      <Card className="space-y-2.5">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => {
                setCaption(buildCaption(recipe, settings, ingredients, price))
                setCaptionDirty(false)
                toast('Texto regenerado')
              }}
              className="text-[11px] font-semibold text-terra"
            >
              Regenerar
            </button>
          }
        >
          Texto para publicar
        </SectionTitle>
        <TextArea
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value)
            setCaptionDirty(true)
          }}
          rows={10}
          className="text-[13px] leading-relaxed"
        />
        <Button variant="soft" block onClick={() => void copyCaption()}>
          <Icon name="copy" className="h-4 w-4" /> Copiar texto
        </Button>
        <p className="text-[10.5px] leading-snug text-ink/40">
          El texto incluye ingredientes y etiquetas. Edítalo antes de publicar: agrega horarios de
          entrega, zonas o promociones.
        </p>
      </Card>

      <InfoNote icon="image">
        <b>Medidas listas:</b> el post cuadrado va al feed, la historia es vertical para stories y
        la tarjeta de receta muestra ingredientes y horneado como tus publicaciones anteriores.
      </InfoNote>
    </div>
  )
}
