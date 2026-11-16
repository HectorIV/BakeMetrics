import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/store'
import type { Rounding, Settings } from '../types'
import {
  Button,
  Card,
  Field,
  ImagePicker,
  InfoNote,
  MoneyInput,
  QtyInput,
  SectionTitle,
  Select,
  TextInput,
  Toggle,
  cn,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { downloadBlob } from '../lib/image'
import { toast } from '../lib/toast'
import { money } from '../lib/cost'

const VERSION = '1.0.0'

const THEME_COLORS = ['#8B4513', '#B9542C', '#6B3F25', '#5F7F63', '#A63D5C', '#2F4858', '#8A6A43']
const ACCENT_COLORS = ['#E8A87C', '#F4D6A8', '#D98E4A', '#A8C0A0', '#D9A5B3', '#C9D6E3', '#E7B37A']

const ROUNDING_OPTIONS: { value: Rounding; label: string }[] = [
  { value: 'none', label: 'Sin redondeo' },
  { value: '0.05', label: 'Al 5¢' },
  { value: '0.10', label: 'A los 10¢' },
  { value: '0.25', label: 'A los 25¢' },
  { value: '0.50', label: 'A los 50¢' },
  { value: '1', label: 'Al dólar' },
]

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function SettingsPage() {
  const { state, updateSettings, exportJson, importState, resetDemo, wipeData } = useApp()
  const { settings } = state
  const importRef = useRef<HTMLInputElement>(null)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [storageKb, setStorageKb] = useState(0)

  useEffect(() => {
    setStorageKb(new Blob([exportJson()]).size / 1024)
  }, [state, exportJson])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const update = (patch: Partial<Settings>) => updateSettings(patch)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    downloadBlob(blob, `bakemetrics-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Respaldo descargado', 'success')
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const result = importState(text)
    if (result.ok) {
      toast('Respaldo restaurado', 'success')
    } else {
      toast(result.error ?? 'No pudimos importar el archivo', 'error')
    }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === 'accepted') toast('App instalada', 'success')
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        eyebrow="Ajustes"
        title="Tu negocio"
        subtitle="Marca, costos y respaldo. Todo se guarda automáticamente."
      />

      {/* Marca */}
      <Card className="space-y-3">
        <SectionTitle>Marca</SectionTitle>

        <div
          className="rounded-2xl p-4 transition"
          style={{ backgroundColor: settings.themeColor }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: settings.accentColor }}
          >
            {settings.businessName || 'Tu negocio'}
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-tight text-white">
            {settings.tagline || 'Repostería casera hecha con amor'}
          </p>
          <span
            className="mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ backgroundColor: settings.accentColor, color: '#2E1B10' }}
          >
            {money(1.25)} c/u
          </span>
        </div>

        <Field label="Nombre del negocio" htmlFor="business-name">
          <TextInput
            id="business-name"
            value={settings.businessName}
            onChange={(event) => update({ businessName: event.target.value })}
            placeholder="Ej.: Dulces de la Casa"
          />
        </Field>

        <Field label="Frase corta" htmlFor="tagline">
          <TextInput
            id="tagline"
            value={settings.tagline}
            onChange={(event) => update({ tagline: event.target.value })}
            placeholder="Repostería casera hecha con amor"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Instagram" htmlFor="instagram">
            <TextInput
              id="instagram"
              value={settings.instagram}
              onChange={(event) => update({ instagram: event.target.value })}
              placeholder="@tunegocio"
            />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <TextInput
              id="whatsapp"
              value={settings.whatsapp}
              onChange={(event) => update({ whatsapp: event.target.value })}
              placeholder="+507 6000-0000"
            />
          </Field>
        </div>

        <Field label="Ciudad" htmlFor="city">
          <TextInput
            id="city"
            value={settings.city}
            onChange={(event) => update({ city: event.target.value })}
            placeholder="Panamá"
          />
        </Field>

        <ImagePicker
          label="Logo (opcional)"
          value={settings.logoDataUrl}
          onChange={(value) => update({ logoDataUrl: value })}
          hint="PNG con fondo transparente se ve mejor."
          transparent
        />

        <ColorPicker
          label="Color principal"
          colors={THEME_COLORS}
          value={settings.themeColor}
          onChange={(color) => update({ themeColor: color })}
        />
        <ColorPicker
          label="Color de acento"
          colors={ACCENT_COLORS}
          value={settings.accentColor}
          onChange={(color) => update({ accentColor: color })}
        />
      </Card>

      {/* Costos */}
      <Card className="space-y-3">
        <SectionTitle>Costos por defecto</SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mano de obra por hora" htmlFor="labor-rate" hint="Lo que vale tu tiempo.">
            <MoneyInput
              id="labor-rate"
              value={settings.laborRatePerHour}
              onChange={(value) => update({ laborRatePerHour: value })}
            />
          </Field>
          <Field
            label="Empaque por unidad (por defecto)"
            htmlFor="packaging-default"
            hint="Solo se usa cuando la receta no tiene empaques detallados."
          >
            <MoneyInput
              id="packaging-default"
              value={settings.packagingPerUnit}
              onChange={(value) => update({ packagingPerUnit: value })}
            />
          </Field>
          <Field label="Gastos indirectos" htmlFor="overhead" hint="Gas, luz, agua, transporte.">
            <QtyInput
              id="overhead"
              value={settings.overheadPct}
              onChange={(value) => update({ overheadPct: value })}
              suffix="%"
            />
          </Field>
          <Field label="Margen deseado" htmlFor="default-margin" hint="Para recetas nuevas.">
            <QtyInput
              id="default-margin"
              value={settings.defaultMarginPct}
              onChange={(value) => update({ defaultMarginPct: value })}
              suffix="%"
            />
          </Field>
        </div>

        <Field label="Redondeo del precio final" htmlFor="rounding">
          <Select
            id="rounding"
            value={settings.rounding}
            onChange={(event) => update({ rounding: event.target.value as Rounding })}
          >
            {ROUNDING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-[1fr,1.4fr] gap-3">
          <Field label="Tasa de ITBMS" htmlFor="itbms-rate">
            <QtyInput
              id="itbms-rate"
              value={settings.itbmsRate}
              onChange={(value) => update({ itbmsRate: value })}
              suffix="%"
            />
          </Field>
          <div className="flex items-end">
            <Toggle
              checked={settings.itbmsDefault}
              onChange={(checked) => update({ itbmsDefault: checked })}
              label="ITBMS por defecto"
              hint="En recetas nuevas."
            />
          </div>
        </div>

        <InfoNote>
          <b>ITBMS en Panamá:</b> la tasa general es 7%. Aplica a productos gravados; algunos
          alimentos de la canasta básica están exentos. Si estás registrado, el precio al cliente
          debe incluirlo. Confirma tu caso con un contador.
        </InfoNote>
      </Card>

      {/* Respaldo */}
      <Card className="space-y-3">
        <SectionTitle
          action={<span className="text-[10.5px] text-ink/40">{storageKb.toFixed(0)} KB</span>}
        >
          Respaldo de datos
        </SectionTitle>

        <InfoNote icon="info">
          Tus recetas viven solo en este dispositivo. Si borras los datos del navegador o cambias de
          teléfono, se pierden. Descarga un respaldo de vez en cuando.
        </InfoNote>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleExport}>
            <Icon name="download" className="h-4 w-4" /> Exportar
          </Button>
          <Button variant="secondary" onClick={() => importRef.current?.click()}>
            <Icon name="upload" className="h-4 w-4" /> Importar
          </Button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void handleImport(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <div className="flex items-center justify-between rounded-2xl bg-cream-deep/60 px-3 py-2.5 text-[12px]">
          <span className="text-ink/50">
            {state.recipes.length} recetas · {state.ingredients.length} ingredientes ·{' '}
            {state.purchases.length} compras
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  'Esto reemplaza tus datos actuales con las 6 recetas de ejemplo. ¿Continuar?',
                )
              ) {
                resetDemo()
                toast('Datos de ejemplo restaurados', 'success')
              }
            }}
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Datos de ejemplo
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  '¿Borrar todas tus recetas, ingredientes, compras y horneadas? Tu marca y configuración se conservan. Esta acción no se puede deshacer.',
                )
              ) {
                wipeData()
                toast('Datos eliminados')
              }
            }}
          >
            <Icon name="trash" className="h-3.5 w-3.5" /> Borrar datos
          </Button>
        </div>
      </Card>

      {/* Instalar */}
      <Card className="space-y-3">
        <SectionTitle>Instalar en el celular</SectionTitle>
        {isStandalone ? (
          <InfoNote tone="good" icon="check">
            Ya estás usando BakeMetrics como app instalada.
          </InfoNote>
        ) : (
          <>
            {installEvent && (
              <Button block onClick={() => void install()}>
                <Icon name="download" className="h-4 w-4" /> Instalar app
              </Button>
            )}
            <div className="space-y-2 text-[12.5px] leading-relaxed text-ink/60">
              <p className="flex gap-2">
                <span className="font-bold text-terra">iPhone</span> Abre la página en Safari →
                Compartir → “Añadir a pantalla de inicio”.
              </p>
              <p className="flex gap-2">
                <span className="font-bold text-terra">Android</span> Menú del navegador →
                “Instalar app” o “Añadir a pantalla principal”.
              </p>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-2">
        <SectionTitle>Acerca de</SectionTitle>
        <p className="text-[12px] leading-relaxed text-ink/55">
          <b>BakeMetrics</b> versión {VERSION}. Hecho para repostería casera en Panamá. Los costos se
          calculan con el último precio registrado de cada ingrediente, más mano de obra, empaque,
          merma y gastos indirectos.
        </p>
        <p className="text-[11.5px] leading-relaxed text-ink/40">
          Los precios iniciales son de referencia: verifícalos con tus facturas para que tus
          márgenes sean reales. No hay servidores ni cuentas; nada sale de tu teléfono.
        </p>
      </Card>

      <p className="pb-2 text-center text-[10.5px] text-ink/30">
        Haz respaldos seguido · {settings.city || 'Panamá'}
      </p>
    </div>
  )
}

function ColorPicker({
  label,
  colors,
  value,
  onChange,
}: {
  label: string
  colors: string[]
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-semibold text-ink/65">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
            className={cn(
              'h-8 w-8 rounded-full border-2 transition',
              value.toLowerCase() === color.toLowerCase()
                ? 'border-ink/70 ring-2 ring-ink/15'
                : 'border-white/70',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
        <label className="ml-1 flex h-8 items-center gap-1.5 rounded-full border border-sand bg-white px-2.5 text-[11px] font-semibold text-cocoa">
          Otro
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Color personalizado"
          />
        </label>
      </div>
    </div>
  )
}
