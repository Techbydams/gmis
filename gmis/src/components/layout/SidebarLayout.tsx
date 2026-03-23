// ============================================================
// GMIS — Sidebar Layout
// FIXED:
//   - Sidebar moved outside SidebarLayout — was remounting on every render
//   - Desktop sidebar visibility fixed (was using purged Tailwind class)
//   - Mobile overlay backdrop and z-index corrected
//   - Navigation links now use proper paths
//   - Active state highlights correctly
// ============================================================

import { useState, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'

interface NavItem {
  id:     string
  label:  string
  icon:   string
  path:   string
  badge?: string
}

const STUDENT_NAV: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',           icon: '🏠', path: '/dashboard' },
  { id: 'results',    label: 'Results',              icon: '📊', path: '/results' },
  { id: 'timetable',  label: 'Timetable',            icon: '📅', path: '/timetable' },
  { id: 'payments',   label: 'Payments',             icon: '💳', path: '/payments' },
  { id: 'courses',    label: 'Course Registration',  icon: '📝', path: '/courses' },
  { id: 'voting',     label: 'Voting',               icon: '🗳️', path: '/voting' },
  { id: 'chat',       label: 'Chat',                 icon: '💬', path: '/chat' },
  { id: 'social',     label: 'Social Feed',          icon: '📸', path: '/social' },
  { id: 'gpa',        label: 'GPA Calculator',       icon: '🧮', path: '/gpa' },
  { id: 'clearance',  label: 'Clearance',            icon: '🧾', path: '/clearance' },
  { id: 'calendar',   label: 'Academic Calendar',    icon: '📆', path: '/calendar' },
  { id: 'ai',         label: 'AI Assistant',         icon: '🤖', path: '/ai' },
  { id: 'settings',   label: 'Settings',             icon: '⚙️', path: '/settings' },
]

const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',            icon: '🏠', path: '/admin' },
  { id: 'approvals',  label: 'Student Approvals',    icon: '⏳', path: '/admin/approvals' },
  { id: 'students',   label: 'All Students',         icon: '👨‍🎓', path: '/admin/students' },
  { id: 'academic',   label: 'Academic Setup',       icon: '🏛️', path: '/admin/academic' },
  { id: 'courses',    label: 'Courses',              icon: '📚', path: '/admin/courses' },
  { id: 'results',    label: 'Results',              icon: '📊', path: '/admin/results' },
  { id: 'timetable',  label: 'Timetable',            icon: '📅', path: '/admin/timetable' },
  { id: 'idcards',    label: 'ID Cards',             icon: '🪪', path: '/admin/idcards' },
  { id: 'fees',       label: 'Fee Structure',        icon: '💳', path: '/admin/fees' },
  { id: 'elections',  label: 'Elections',            icon: '🗳️', path: '/admin/elections' },
  { id: 'news',       label: 'News & Updates',       icon: '📰', path: '/admin/news' },
  { id: 'paystack',   label: 'Paystack Config',      icon: '💰', path: '/admin/paystack' },
  { id: 'settings',   label: 'Portal Settings',      icon: '⚙️', path: '/admin/settings' },
]

const LECTURER_NAV: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',            icon: '🏠', path: '/lecturer' },
  { id: 'students',   label: 'My Students',          icon: '👨‍🎓', path: '/lecturer/students' },
  { id: 'results',    label: 'Upload Results',       icon: '📊', path: '/lecturer/results' },
  { id: 'attendance', label: 'QR Attendance',        icon: '📱', path: '/lecturer/attendance' },
  { id: 'handouts',   label: 'Handout Payments',     icon: '💳', path: '/lecturer/handouts' },
]

// Divider labels for admin sidebar sections
const ADMIN_DIVIDERS: Record<string, string> = {
  academic:  'Academic',
  idcards:   'Operations',
  paystack:  'Configuration',
}

// ── SIDEBAR (extracted — no longer nested inside SidebarLayout) ──
interface SidebarProps {
  navItems:   NavItem[]
  activeId:   string
  role:       'student' | 'admin' | 'lecturer'
  onNavigate: (path: string) => void
  onClose?:   () => void
}

function Sidebar({ navItems, activeId, role, onNavigate, onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const { tenant, slug }  = useTenant()
  const navigate          = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{
      width: 225, height: '100%',
      background: 'rgba(3,7,26,0.97)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(30px)',
      overflowY: 'auto', flexShrink: 0,
      minHeight: '100vh',
    }}>
      {/* Brand */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0,
            boxShadow: '0 4px 14px rgba(45,108,255,.35)',
            fontFamily: "'Syne',system-ui",
          }}>G</div>
          <div>
            <div style={{
              fontFamily: "'Syne',system-ui", fontWeight: 700,
              fontSize: 14, color: '#e8eeff', lineHeight: 1.2,
            }}>
              {tenant?.name || slug}
            </div>
            <div style={{ fontSize: 10, color: '#3d4f7a' }}>{slug}.gmis.com</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          background: role === 'admin'
            ? 'rgba(240,180,41,0.15)'
            : role === 'lecturer'
            ? 'rgba(16,185,129,0.15)'
            : 'rgba(45,108,255,0.15)',
          color: role === 'admin' ? '#f0b429' : role === 'lecturer' ? '#4ade80' : '#60a5fa',
          padding: '3px 10px', borderRadius: 100,
        }}>
          {role === 'admin' ? '⚙ Administrator' : role === 'lecturer' ? '👨‍🏫 Lecturer' : '👨‍🎓 Student'}
        </span>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive = activeId === item.id
          return (
            <div key={item.id}>
              {/* Section dividers for admin nav */}
              {role === 'admin' && ADMIN_DIVIDERS[item.id] && (
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 1.5, color: '#2d3a5a', padding: '12px 16px 4px',
                }}>
                  {ADMIN_DIVIDERS[item.id]}
                </div>
              )}
              <div
                onClick={() => {
                  onNavigate(item.path)
                  onClose?.()
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', fontSize: 13,
                  color:      isActive ? '#60a5fa' : '#7a8bbf',
                  background: isActive ? 'rgba(45,108,255,0.1)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  borderRight: isActive ? '3px solid #2d6cff' : '3px solid transparent',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: 'rgba(251,191,36,.2)', color: '#fbbf24',
                    padding: '1px 7px', borderRadius: 100,
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* User info + sign out */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: 12, color: '#e8eeff', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.email}
            </div>
            <div style={{ fontSize: 10, color: '#3d4f7a', textTransform: 'capitalize' }}>
              {role}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '7px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 9, color: '#f87171', fontSize: 12,
            cursor: 'pointer', fontFamily: "'DM Sans',system-ui",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── SIDEBAR LAYOUT ────────────────────────────────────────
interface Props {
  children: ReactNode
  active?:  string
  role?:    'student' | 'admin' | 'lecturer'
}

export default function SidebarLayout({ children, active, role = 'student' }: Props) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { tenant, slug } = useTenant()
  const [mobOpen, setMobOpen] = useState(false)

  // Derive active item from current URL path if not explicitly passed
  const activeId = active || (() => {
    const path = location.pathname
    const allNav = role === 'admin' ? ADMIN_NAV : role === 'lecturer' ? LECTURER_NAV : STUDENT_NAV
    const match = allNav.find(item => item.path === path)
    return match?.id || (role === 'admin' ? 'dashboard' : role === 'lecturer' ? 'dashboard' : 'dashboard')
  })()

  const navItems = role === 'admin' ? ADMIN_NAV : role === 'lecturer' ? LECTURER_NAV : STUDENT_NAV

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#03071a',
      fontFamily: "'DM Sans',system-ui,sans-serif",
    }}>

      {/* Desktop sidebar — visible on screens ≥ 769px via inline media query */}
      <div style={{ display: 'flex' }} id="gmis-desktop-sidebar">
        <Sidebar
          navItems={navItems}
          activeId={activeId}
          role={role}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Mobile overlay backdrop */}
      {mobOpen && (
        <div
          onClick={() => setMobOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 198,
          }}
        />
      )}

      {/* Mobile drawer */}
      {mobOpen && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0,
          zIndex: 199, display: 'flex',
        }}>
          <Sidebar
            navItems={navItems}
            activeId={activeId}
            role={role}
            onNavigate={handleNavigate}
            onClose={() => setMobOpen(false)}
          />
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', minWidth: 0 }}>
        {/* Mobile top bar */}
        <div style={{
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(3,7,26,0.95)',
          position: 'sticky', top: 0, zIndex: 50,
        }} id="gmis-mobile-topbar">
          <button
            onClick={() => setMobOpen(true)}
            style={{
              background: 'none', border: 'none',
              color: '#e8eeff', fontSize: 20,
              cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
            }}
          >☰</button>
          <span style={{
            fontFamily: "'Syne',system-ui", fontWeight: 700,
            color: '#e8eeff', fontSize: 15,
          }}>
            {tenant?.name || slug}
          </span>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#3d4f7a' }}>
            {slug}.gmis.com
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: 'clamp(14px,3vw,26px)' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Desktop: show sidebar, hide mobile topbar */
        @media (min-width: 769px) {
          #gmis-mobile-topbar { display: none !important; }
        }

        /* Mobile: hide desktop sidebar */
        @media (max-width: 768px) {
          #gmis-desktop-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}