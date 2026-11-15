import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { subscribeToasts, toast, type ToastMessage } from '../lib/toast'
import { compressImage } from '../lib/image'
import { trim } from '../lib/units'

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-terra text-white shadow-soft hover:bg-[#a24725] active:scale-[0.985]',
  secondary: 'bg-white text-ink border border-sand shadow-[0_1px_0_rgba(46,27,16,0.04)] active:bg-cream-deep',
  soft: 'bg-butter/60 text-cocoa active:bg-butter',
  ghost: 'text-cocoa active:bg-sand/50',
  danger: 'bg-berry/10 text-berry active:bg-berry/20',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 py-1.5 text-[13px] gap-1.5',
  md: 'min-h-11 px-5 py-2.5 text-sm gap-2',
  lg: 'min-h-12 px-6 py-3 text-[15px] gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold transition disabled:pointer-events-none disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className,
  filled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName
  label: string
  filled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-cocoa transition active:scale-95',
        'border border-sand/80 bg-white/70',
        className,
      )}
      {...props}
    >
      <Icon name={icon} filled={filled} className="h-[18px] w-[18px]" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Contenedores                                                        */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-sand/70 bg-white/85 p-4 shadow-[0_1px_2px_rgba(46,27,16,0.04)] backdrop-blur',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-2 flex items-end justify-between gap-3 px-1', className)}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">{children}</h2>
      {action}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  icon?: IconName
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-sand/60 bg-white/70 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/45">
        {icon && <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div
        title={value}
        className={cn(
          'mt-1 truncate font-display text-[clamp(14px,4.2vw,22px)] font-semibold leading-none tabular-nums',
          tone === 'good' && 'text-sage',
          tone === 'warn' && 'text-terra',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-[11px] leading-tight text-ink/45">{hint}</div>}
    </div>
  )
}

type BadgeTone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sand/60 text-cocoa',
  good: 'bg-sage/15 text-sage',
  warn: 'bg-caramel/20 text-[#8a4b14]',
  bad: 'bg-berry/12 text-berry',
  accent: 'bg-butter/70 text-[#7a4515]',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition',
        active
          ? 'border-terra bg-terra text-white shadow-soft'
          : 'border-sand bg-white/70 text-cocoa active:bg-cream-deep',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  icon = 'book',
  title,
  description,
  action,
}: {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-sand bg-white/50 px-6 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-butter/50 text-cocoa">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink/55">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function InfoNote({
  children,
  tone = 'info',
  icon = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warn' | 'good'
  icon?: IconName
}) {
  const tones = {
    info: 'bg-butter/35 text-[#6b4517] border-butter/60',
    warn: 'bg-terra/8 text-[#8a3f1f] border-terra/20',
    good: 'bg-sage/10 text-sage border-sage/20',
  }
  return (
    <div className={cn('flex gap-2.5 rounded-2xl border px-3.5 py-3 text-[12.5px] leading-relaxed', tones[tone])}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */

export const inputClass =
  'w-full rounded-2xl border border-sand bg-white px-3.5 py-2.5 text-[16px] text-ink outline-none transition placeholder:text-ink/30 focus:border-caramel focus:ring-4 focus:ring-caramel/15 disabled:bg-cream-deep/60'

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label?: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  const labelClass = 'mb-1.5 block text-[12px] font-semibold text-ink/65'
  return (
    <div className={cn('block', className)}>
      {label &&
        (htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <span className={labelClass}>{label}</span>
        ))}
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-ink/45">{hint}</span>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-24 resize-y', props.className)} />
}

export function Select({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, 'appearance-none pr-9', className)}>
      {children}
    </select>
  )
}

/** Convierte "1/3", "1 1/2", "0,5" o "2" en número. */
export function parseQty(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!value) return null
  const mixed = value.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const denominator = Number(mixed[3])
    if (!denominator) return null
    return Number(mixed[1]) + Number(mixed[2]) / denominator
  }
  const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (!denominator) return null
    return Number(fraction[1]) / denominator
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatNumeric(value: number): string {
  if (!Number.isFinite(value)) return ''
  return String(Number(value.toFixed(3)))
}

export function QtyInput({
  value,
  onChange,
  className,
  suffix,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onChange: (value: number) => void
  suffix?: string
}) {
  const [text, setText] = useState(() => formatNumeric(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatNumeric(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const parsed = parseQty(raw)
    if (parsed !== null && parsed > 0) {
      onChange(parsed)
      return parsed
    }
    return null
  }

  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        inputMode="decimal"
        value={text}
        className={cn(inputClass, suffix && 'pr-12', className)}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const raw = event.target.value
          setText(raw)
          if (!raw.endsWith('/') && !raw.endsWith(' ')) commit(raw)
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = commit(text)
          setText(formatNumeric(parsed ?? value))
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-ink/45">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(() => (value ? value.toFixed(2) : ''))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value ? value.toFixed(2) : '')
  }, [value, focused])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-ink/45">
        $
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        value={text}
        className={cn(inputClass, 'pl-7', className)}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const raw = event.target.value
          setText(raw)
          const parsed = parseQty(raw)
          if (parsed !== null) onChange(Math.max(0, parsed))
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = parseQty(text)
          const next = parsed === null ? value : Math.max(0, parsed)
          onChange(next)
          setText(next ? next.toFixed(2) : '')
        }}
      />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-sand bg-white/70 p-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] leading-snug text-ink/50">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-terra' : 'bg-sand',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

export function Slider({  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffix,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label?: string
  suffix?: string
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-ink/65">
          <span>{label}</span>
          <span className="text-terra">
            {trim(value, 2)}
            {suffix}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sand accent-terra"
      />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: IconName }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-sand/50 p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] font-semibold transition',
            value === option.value
              ? 'bg-white text-ink shadow-[0_1px_4px_rgba(46,27,16,0.12)]'
              : 'text-ink/50',
          )}
        >
          {option.icon && <Icon name={option.icon} className="h-4 w-4" />}
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Hoja inferior (modal)                                               */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet safe-bottom relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border-t border-sand bg-cream px-5 pb-6 pt-3 shadow-lift"
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-3 mb-4 bg-cream/95 px-5 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-sand" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[12.5px] text-ink/50">{subtitle}</p>}
            </div>
            <IconButton icon="x" label="Cerrar" onClick={onClose} className="border-transparent bg-sand/50" />
          </div>
        </div>
        {children}
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Imágenes                                                            */
/* ------------------------------------------------------------------ */

export function ImagePicker({
  value,
  onChange,
  label = 'Foto',
  hint,
  className,
  transparent = false,
}: {
  value?: string
  onChange: (dataUrl: string | undefined) => void
  label?: string
  hint?: string
  className?: string
  transparent?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await compressImage(file, transparent ? 400 : 1400, 0.8, transparent)
      onChange(dataUrl)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No pudimos procesar la imagen', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink/65">{label}</span>
        {value && (
          <button
            type="button"
            className="text-[12px] font-semibold text-berry"
            onClick={() => onChange(undefined)}
          >
            Quitar
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="Vista previa"
            className={cn(
              'h-20 w-20 shrink-0 rounded-2xl border border-sand object-cover',
              transparent && 'bg-cream-deep',
            )}
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-sand bg-white/60 text-ink/30">
            <Icon name="image" className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Icon name="upload" className="h-4 w-4" />
            {busy ? 'Procesando…' : value ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {hint && <p className="mt-1.5 text-[11px] leading-snug text-ink/45">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(() => {
    return subscribeToasts((item) => {
      setItems((prev) => [...prev.slice(-2), item])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      }, 3400)
    })
  }, [])

  if (items.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'animate-toast flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-lift',
            item.tone === 'error'
              ? 'bg-berry text-white'
              : item.tone === 'success'
                ? 'bg-sage text-white'
                : 'bg-ink text-cream',
          )}
        >
          <Icon
            name={item.tone === 'error' ? 'alert' : item.tone === 'success' ? 'check' : 'info'}
            className="h-4 w-4 shrink-0"
          />
          {item.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
