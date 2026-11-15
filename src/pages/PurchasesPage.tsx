import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../store/store'
import type { Ingredient, ParsedReceiptItem, StandardUnit } from '../types'
import { money, moneyPrecise } from '../lib/cost'
import { STANDARD_UNITS, baseUnitName, formatBase, toBase, trim, unitLabel } from '../lib/units'
import { matchIngredient, scanInvoice } from '../lib/ocr'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoNote,
  MoneyInput,
  QtyInput,
  SectionTitle,
  Select,
  Sheet,
  Stat,
  TextInput,
  cn,
  inputClass,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { toast } from '../lib/toast'
import { formatDate, formatDateShort, uid } from '../lib/id'

export function PurchasesPage() {
  const { state, addPurchase, deletePurchase } = useApp()
  const [params] = useSearchParams()
  const initialId = params.get('ing') ?? state.ingredients[0]?.id ?? ''

  const sortedIngredients = useMemo(
    () => [...state.ingredients].filter((i) => !i.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [state.ingredients],
  )
  const initialIngredient = state.ingredients.find((i) => i.id === initialId)

  const [ingredientId, setIngredientId] = useState(initialId)
  const [qty, setQty] = useState(initialIngredient?.packQty ?? 1)
  const [unit, setUnit] = useState<string>(initialIngredient?.packUnit ?? 'g')
  const [total, setTotal] = useState(initialIngredient?.packPrice ?? 0)
  const [supplier, setSupplier] = useState(initialIngredient?.supplier ?? '')
  const [ocrOpen, setOcrOpen] = useState(false)

  const ingredient = sortedIngredients.find((i) => i.id === ingredientId)

  const chooseIngredient = (id: string) => {
    setIngredientId(id)
    const next = state.ingredients.find((i) => i.id === id)
    if (!next) return
    setQty(next.packQty)
    setUnit(next.packUnit)
    setTotal(next.packPrice)
    setSupplier(next.supplier ?? '')
  }

  useEffect(() => {
    if (!ingredient && sortedIngredients[0]) chooseIngredient(sortedIngredients[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedIngredients.length])

  const monthTotal = useMemo(() => {
    const now = new Date()
    return state.purchases
      .filter((purchase) => {
        const date = new Date(purchase.date)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      })
      .reduce((sum, purchase) => sum + purchase.total, 0)
  }, [state.purchases])

  const savePurchase = () => {
    if (!ingredient) {
      toast('Elige un ingrediente', 'error')
      return
    }
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      toast('Indica cuánto compraste', 'error')
      return
    }
    if (!total || total <= 0) {
      toast('Escribe el total pagado', 'error')
      return
    }
    addPurchase({
      id: uid('pur-'),
      date: new Date().toISOString(),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      qty,
      unit: unit as StandardUnit,
      total,
      supplier: supplier.trim() || undefined,
      source: 'manual',
    })
    toast(`Compra registrada · ${money(total)}`, 'success')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Compras"
        title="Precios y facturas"
        subtitle="Registra lo que pagaste y el inventario se actualiza solo."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setOcrOpen(true)}>
            <Icon name="camera" className="h-4 w-4" /> Escanear
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Este mes" value={money(monthTotal)} icon="wallet" />
        <Stat label="Compras" value={String(state.purchases.length)} icon="cart" />
        <Stat
          label="Última"
          value={state.purchases[0] ? formatDateShort(state.purchases[0].date) : '—'}
          icon="clock"
        />
      </div>

      {sortedIngredients.length === 0 ? (
        <EmptyState
          icon="basket"
          title="Primero crea tus ingredientes"
          description="Cada compra actualiza el precio de referencia de un ingrediente. Crea al menos uno en Inventario."
          action={
            <Link to="/inventario">
              <Button>Ir a Inventario</Button>
            </Link>
          }
        />
      ) : (
        <Card className="mb-4 space-y-3">
          <SectionTitle
            action={<span className="text-[10.5px] text-ink/40">Actualiza precio + stock</span>}
          >
            Nueva compra
          </SectionTitle>

          <Field label="Ingrediente" htmlFor="purchase-ingredient">
            <Select
              id="purchase-ingredient"
              value={ingredientId}
              onChange={(event) => chooseIngredient(event.target.value)}
            >
              {sortedIngredients.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad comprada" htmlFor="purchase-qty">
              <div className="grid grid-cols-[1fr,84px] gap-2">
                <QtyInput id="purchase-qty" value={qty} onChange={setQty} />
                <Select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className="px-2"
                  aria-label="Unidad de compra"
                >
                  {purchaseUnitsFor(ingredient).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Total pagado" htmlFor="purchase-total">
              <MoneyInput id="purchase-total" value={total} onChange={setTotal} />
            </Field>
          </div>

          <Field label="Proveedor (opcional)" htmlFor="purchase-supplier">
            <TextInput
              id="purchase-supplier"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              placeholder="Supermercado, feria, distribuidor…"
            />
          </Field>

          {ingredient && qty > 0 && total > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-cream-deep/70 px-3.5 py-2.5 text-[12px]">
              <span className="text-ink/50">
                Nuevo costo:{' '}
                {moneyPrecise(total / ((toBase(qty, unit, ingredient) ?? 0) || 1))} por{' '}
                {baseUnitName(ingredient.baseUnit)}
              </span>
              <Badge tone="good">
                +{formatBase(toBase(qty, unit, ingredient) ?? 0, ingredient.baseUnit)}
              </Badge>
            </div>
          )}

          <Button block onClick={savePurchase}>
            <Icon name="check" className="h-4 w-4" /> Guardar compra
          </Button>

          <p className="text-center text-[10.5px] leading-snug text-ink/35">
            Al guardar, este precio pasa a ser el costo de referencia del ingrediente y la cantidad
            se suma al inventario.
          </p>
        </Card>
      )}

      {state.purchases.length > 0 && (
        <div>
          <SectionTitle
            action={
              <span className="text-[10.5px] text-ink/40">{state.purchases.length} registros</span>
            }
          >
            Historial
          </SectionTitle>
          <div className="space-y-1.5">
            {state.purchases.slice(0, 60).map((purchase) => {
              const ing = state.ingredients.find((i) => i.id === purchase.ingredientId)
              return (
                <div
                  key={purchase.id}
                  className="flex items-center gap-3 rounded-2xl border border-sand/60 bg-white/60 px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-butter/50 text-[#7a4515]">
                    <Icon name="cart" className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">{purchase.ingredientName}</p>
                    <p className="text-[10.5px] text-ink/45">
                      {formatDate(purchase.date)} · {trim(purchase.qty)} {unitLabel(purchase.unit, ing)}
                      {purchase.supplier ? ` · ${purchase.supplier}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12.5px] font-semibold">{money(purchase.total)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            '¿Eliminar esta compra del historial? El inventario y el precio no se revierten.',
                          )
                        ) {
                          deletePurchase(purchase.id)
                        }
                      }}
                      className="text-[10px] font-semibold text-berry/70"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <OcrSheet
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        ingredients={sortedIngredients}
        onUse={(id, price) => {
          chooseIngredient(id)
          const ing = state.ingredients.find((i) => i.id === id)
          if (ing) {
            setQty(ing.packQty)
            setUnit(ing.packUnit)
          }
          setTotal(price)
          setOcrOpen(false)
          toast('Revisa la cantidad y confirma la compra', 'success')
        }}
      />

      <div className="mt-5">
        <InfoNote>
          <b>¿Cómo funcionan los precios?</b> Cada ingrediente guarda el costo de su paquete de
          referencia. El app lo convierte a gramos, mililitros o unidades para calcular cualquier
          receta. Si el paquete cambia de tamaño, registra la nueva compra y todo se recalcula.
        </InfoNote>
      </div>
    </div>
  )
}

function purchaseUnitsFor(ingredient?: Ingredient) {
  if (!ingredient) {
    return STANDARD_UNITS.map((standard) => ({ value: standard.key, label: standard.label }))
  }
  if (ingredient.baseUnit === 'unit') return [{ value: 'unidad', label: 'u' }]
  if (ingredient.baseUnit === 'ml') {
    return STANDARD_UNITS.filter((standard) =>
      ['ml', 'l', 'taza', 'cda', 'cdta'].includes(standard.key),
    ).map((standard) => ({ value: standard.key, label: standard.label }))
  }
  return STANDARD_UNITS.filter((standard) =>
    ['g', 'kg', 'oz', 'lb', 'taza', 'cda', 'cdta'].includes(standard.key),
  ).map((standard) => ({ value: standard.key, label: standard.label }))
}

function OcrSheet({
  open,
  onClose,
  ingredients,
  onUse,
}: {
  open: boolean
  onClose: () => void
  ingredients: Ingredient[]
  onUse: (ingredientId: string, price: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [rows, setRows] = useState<{ item: ParsedReceiptItem; ingredientId: string }[]>([])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setText('')
    setRows([])
    setProgress(0)
    setScanning(true)
    setStatus('Preparando el lector…')
    const url = URL.createObjectURL(file)
    setPreview(url)

    try {
      const result = await scanInvoice(file, (value, message) => {
        setProgress(value)
        setStatus(message)
      })
      setText(result.text)
      if (result.items.length === 0) {
        setError(
          'No pudimos detectar líneas con precio. La foto debe estar bien iluminada y recta. Puedes ingresar la compra manualmente.',
        )
      }
      setRows(
        result.items.map((item) => ({
          item,
          ingredientId: matchIngredient(item.name, ingredients)?.id ?? '',
        })),
      )
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? `No se pudo leer la factura: ${scanError.message}`
          : 'No se pudo leer la factura. Revisa tu conexión o ingresa la compra manualmente.',
      )
    } finally {
      setScanning(false)
      setStatus('')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Escanear factura"
      subtitle="El texto se lee en tu teléfono, sin subir la foto"
      footer={
        <Button variant="secondary" block onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        <InfoNote icon="camera">
          Toma la foto de frente, con buena luz y sin sombras. El lector reconoce los precios; tú
          confirmas a qué ingrediente pertenece cada línea.
        </InfoNote>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <Button block onClick={() => inputRef.current?.click()} disabled={scanning}>
          <Icon name="camera2" className="h-4 w-4" />
          {scanning ? 'Leyendo…' : preview ? 'Tomar otra foto' : 'Tomar foto o elegir imagen'}
        </Button>

        {preview && (
          <img
            src={preview}
            alt="Factura"
            className="max-h-44 w-full rounded-2xl border border-sand object-contain"
          />
        )}

        {scanning && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-terra transition-all"
                style={{ width: `${Math.max(4, progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[11.5px] text-ink/45">
              {status} {progress > 0 ? `· ${Math.round(progress * 100)}%` : ''}
            </p>
            <p className="mt-1 text-center text-[10.5px] text-ink/35">
              La primera vez descarga el idioma español (~10 MB).
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-berry/20 bg-berry/5 px-3.5 py-3 text-[12px] leading-relaxed text-berry">
            {error}
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold text-ink/65">
              {rows.length} líneas detectadas
            </p>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={`${row.item.name}-${index}`} className="rounded-2xl border border-sand bg-white/70 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{row.item.name}</p>
                    <p className="shrink-0 text-[13px] font-semibold">{money(row.item.price)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr,auto] gap-2">
                    <Select
                      value={row.ingredientId}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, ingredientId: event.target.value } : entry,
                          ),
                        )
                      }
                      className="py-1.5 text-[12.5px]"
                      aria-label="Ingrediente"
                    >
                      <option value="">— Asignar ingrediente —</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      disabled={!row.ingredientId}
                      onClick={() => onUse(row.ingredientId, row.item.price)}
                    >
                      Usar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {text && (
          <details className="rounded-2xl border border-sand bg-white/60 p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-cocoa">
              Ver texto detectado
            </summary>
            <pre className={cn(inputClass, 'mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]')}>
              {text}
            </pre>
          </details>
        )}

        {rows.length > 0 && (
          <p className="text-center text-[10.5px] leading-snug text-ink/35">
            Al tocar “Usar”, el precio se carga abajo. Confirma la cantidad del paquete antes de
            guardar. Si falta un ingrediente, créalo en Inventario.
          </p>
        )}
      </div>
    </Sheet>
  )
}
