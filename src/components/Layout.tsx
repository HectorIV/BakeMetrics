import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Toaster, cn } from './ui'
import type { ReactNode } from 'react'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Recetas', icon: 'book' },
  { to: '/inventario', label: 'Inventario', icon: 'box' },
  { to: '/compras', label: 'Compras', icon: 'cart' },
  { to: '/promo', label: 'Promo', icon: 'sparkles' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

export function Layout() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-4 pb-nav pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Outlet />
      </div>
      <BottomNav />
      <Toaster />
    </div>
  )
}

function BottomNav() {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-sand/80 bg-cream/92 backdrop-blur-xl">
      <div className="safe-bottom mx-auto flex w-full max-w-xl items-stretch justify-between px-2 pt-1.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10.5px] font-semibold transition',
                isActive ? 'text-terra' : 'text-ink/40',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition',
                    isActive && 'bg-butter/70',
                  )}
                >
                  <Icon name={item.icon} className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.1 : 1.8} />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back = false,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  back?: boolean
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 flex items-start gap-3">
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sand bg-white/70 text-cocoa"
        >
          <Icon name="chevronLeft" className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-terra/80">{eyebrow}</p>
        )}
        <h1 className="font-display text-[27px] font-semibold leading-[1.1] tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-snug text-ink/50">{subtitle}</p>}
      </div>
      {actions && <div className="mt-1 flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function FloatingAdd({ label, to }: { label: string; to: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-terra text-white shadow-lift transition active:scale-95"
      aria-label={label}
    >
      <Icon name="plus" className="h-6 w-6" strokeWidth={2.2} />
    </button>
  )
}
