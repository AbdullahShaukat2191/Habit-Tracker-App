'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CheckSquare, FolderOpen, Target, Settings, Heart, Wallet, Timer } from 'lucide-react'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import React from 'react'

const NAV_ITEMS = [
  { href: '/',           icon: LayoutGrid,  label: 'Habit Scorecard' },
  { href: '/tasks',      icon: CheckSquare, label: 'Current Tasks' },
  { href: '/wishlist',   icon: Heart,       label: 'Wish List' },
  { href: '/timer',      icon: Timer,       label: 'Timer' },
  { href: '/finance',    icon: Wallet,      label: 'Finance' },
  { href: '/projects',   icon: FolderOpen,  label: 'Projects' },
  { href: '/goals',      icon: Target,      label: 'Long-Term Goals' },
]

type NavLinkProps = {
  href: string
  icon: React.ElementType
  label: string
  isActive: boolean
}

function NavLink({ href, icon: Icon, label, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative"
      style={{
        color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
        backgroundColor: isActive ? 'rgba(109, 40, 217, 0.25)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        paddingLeft: isActive ? '10px' : '12px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(109, 40, 217, 0.15)'
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--sidebar-text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--sidebar-text-muted)'
        }
      }}
    >
      <Icon size={16} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const rawPathname = usePathname()
  const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/$/, '')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(format(new Date(), 'EEEE, MMMM d'))
  }, [])

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 240,
        background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* App header */}
      <div className="px-6 pt-5 pb-4">
        <h1
          className="font-semibold tracking-tight"
          style={{ color: 'var(--sidebar-text)', fontSize: 18 }}
        >
          Habit Tracker
          <span
            className="block mt-1 h-0.5 rounded-full w-8"
            style={{ background: 'var(--accent)' }}
          />
        </h1>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <NavLink key={href} href={href} icon={Icon} label={label} isActive={pathname === href} />
        ))}
      </nav>

      {/* Settings + date footer */}
      <div className="px-3 pb-5 flex flex-col gap-0.5">
        <NavLink href="/settings" icon={Settings} label="Settings" isActive={pathname === '/settings'} />

        {dateStr && (
          <p
            className="px-3 pt-3 text-xs"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            {dateStr}
          </p>
        )}
      </div>
    </aside>
  )
}
