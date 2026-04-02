// ============================================================
// GMIS — Reusable UI Components
// ============================================================

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

// -- PAGE HEADER --
interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export const PageHeader = ({ title, subtitle, action }: PageHeaderProps) => (
  <div className="flex items-start justify-between mb-6 gap-4">
    <div>
      <h1 className="text-xl font-black text-slate-100 font-display">{title}</h1>
      {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
)

// ── BUTTON ────────────────────────────────────────────────
interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}

export const Button = ({
  children, variant = 'primary', size = 'md', full,
  loading, onClick, type = 'button', disabled, className = ''
}: ButtonProps) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5',
    secondary: 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-black/10 dark:border-white/15 hover:bg-white dark:hover:bg-white/10',
    ghost: 'bg-transparent text-slate-500 dark:text-slate-400 border border-black/12 dark:border-white/14 hover:bg-black/5 dark:hover:bg-white/8',
    danger: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/50',
    success: 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50',
    gold: 'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 shadow-lg shadow-amber-400/30 hover:-translate-y-0.5',
  }
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-lg',
    md: 'text-sm px-5 py-2.5 rounded-xl',
    lg: 'text-base px-7 py-3.5 rounded-xl',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold font-sans
        transition-all duration-150 active:scale-[0.97] cursor-pointer
        disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
        backdrop-blur-sm
        ${variants[variant]}
        ${sizes[size]}
        ${full ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

// ── INPUT ─────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = ({ label, error, hint, className = '', ...props }: InputProps) => (
  <div className="mb-3.5">
    {label && (
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
    )}
    <input
      className={`
        w-full px-4 py-2.5 bg-white/80 dark:bg-white/5 
        border ${error ? 'border-red-400 dark:border-red-600' : 'border-black/12 dark:border-white/14'}
        rounded-xl text-sm text-slate-800 dark:text-slate-200
        placeholder-slate-400 dark:placeholder-slate-500
        focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15
        transition-all duration-200 backdrop-blur-sm
        ${className}
      `}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
)

// ── SELECT ────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export const Select = ({ label, error, children, className = '', ...props }: SelectProps) => (
  <div className="mb-3.5">
    {label && (
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
    )}
    <select
      className={`
        w-full px-4 py-2.5 bg-white/80 dark:bg-white/5
        border ${error ? 'border-red-400' : 'border-black/12 dark:border-white/14'}
        rounded-xl text-sm text-slate-800 dark:text-slate-200
        focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15
        transition-all duration-200 backdrop-blur-sm cursor-pointer
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
)

// ── CARD ──────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  onClick?: () => void
  padding?: string
}

export const Card = ({ children, className = '', hover, glow, onClick, padding = 'p-5' }: CardProps) => (
  <div
    onClick={onClick}
    className={`
      bg-white/80 dark:bg-white/5 backdrop-blur-xl
      border border-black/8 dark:border-white/10
      rounded-2xl ${padding}
      transition-all duration-200
      ${hover ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''}
      ${glow ? 'shadow-[0_0_40px_rgba(45,108,255,0.12)]' : ''}
      ${className}
    `}
  >
    {children}
  </div>
)

// ── BADGE ─────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode
  color?: 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'indigo' | 'gold'
}

export const Badge = ({ children, color = 'gray' }: BadgeProps) => {
  const colors = {
    green:  'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400',
    blue:   'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400',
    amber:  'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400',
    red:    'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400',
    gray:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',
    gold:   'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[color]}`}>
      {children}
    </span>
  )
}

// ── TOGGLE ────────────────────────────────────────────────
interface ToggleProps {
  on: boolean
  onChange: () => void
}

export const Toggle = ({ on, onChange }: ToggleProps) => (
  <div
    onClick={onChange}
    className={`
      relative w-12 h-7 rounded-full cursor-pointer transition-all duration-300 flex-shrink-0
      ${on
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_14px_rgba(45,108,255,0.4)]'
        : 'bg-slate-200 dark:bg-slate-700'
      }
    `}
  >
    <div className={`
      absolute w-5 h-5 bg-white rounded-full top-1 transition-all duration-250 shadow-sm
      ${on ? 'left-6' : 'left-1'}
    `} />
  </div>
)

// ── AVATAR ────────────────────────────────────────────────
interface AvatarProps {
  initials: string
  size?: number
  src?: string
}

export const Avatar = ({ initials, size = 36, src }: AvatarProps) => (
  <div
    className="rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-[0_3px_14px_rgba(45,108,255,0.35)]"
    style={{ width: size, height: size, fontSize: size * 0.34 }}
  >
    {src ? <img src={src} alt={initials} className="w-full h-full rounded-full object-cover" /> : initials}
  </div>
)

// ── STAT CARD ─────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  icon?: string
  sub?: string
  color?: string
}

export const StatCard = ({ label, value, icon, sub, color }: StatCardProps) => (
  <div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-black/8 dark:border-white/10 rounded-2xl p-4 hover:-translate-y-1 transition-transform duration-200">
    {icon && <div className="text-2xl mb-2">{icon}</div>}
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{label}</div>
    <div className={`text-2xl font-black leading-none ${color || 'text-slate-800 dark:text-slate-100'}`}>{value}</div>
    {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</div>}
  </div>
)

// ── DIVIDER ───────────────────────────────────────────────
export const Divider = ({ className = '' }: { className?: string }) => (
  <div className={`h-px bg-black/8 dark:bg-white/8 my-4 ${className}`} />
)

// ── SPINNER ───────────────────────────────────────────────
export const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }
  return (
    <div className={`${sizes[size]} border-blue-600/30 border-t-blue-600 rounded-full animate-spin`} />
  )
}

// ── EMPTY STATE ───────────────────────────────────────────
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyState = ({ icon = '📭', title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-bold text-lg text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>}
    {action}
  </div>
)

// ── TABLE ─────────────────────────────────────────────────
interface TableProps {
  heads: string[]
  rows: ReactNode[][]
}

export const Table = ({ heads, rows }: TableProps) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse" style={{ minWidth: 400 }}>
      <thead>
        <tr>
          {heads.map((h) => (
            <th key={h} className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 py-2 border-b border-black/8 dark:border-white/8 whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/3 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-3 border-b border-black/5 dark:border-white/5 text-sm text-slate-700 dark:text-slate-300 align-middle">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && (
      <div className="text-center py-10 text-sm text-slate-400">No records found.</div>
    )}
  </div>
)

// ── ALERT ─────────────────────────────────────────────────
interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  children: ReactNode
}

export const Alert = ({ type = 'info', children }: AlertProps) => {
  const styles = {
    info:    'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
    success: 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
    error:   'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50',
  }
  const icons = { info: 'ℹ', success: '✓', warning: '⚠', error: '✕' }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${styles[type]}`}>
      <span className="font-bold flex-shrink-0">{icons[type]}</span>
      <div>{children}</div>
    </div>
  )
}