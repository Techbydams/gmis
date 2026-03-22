// ============================================================
// GMIS — Main App Router
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { ThemeProvider } from './context/ThemeContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { AuthProvider, useAuth } from './context/AuthContext'

// ── REAL pages (built) ────────────────────────────────────
import Landing from './pages/platform/Landing'
import FindInstitution from './pages/platform/FindInstitution'

import OrgRegistration from './pages/platform/OrgRegistration.tsx'
import PlatformAdmin from './pages/platform/PlatformAdmin.tsx'
// ── PLACEHOLDER pages (will be replaced one by one) ───────
import {
  SchoolLogin,
  StudentSignup,
  StudentDashboard,
  StudentResults,
  StudentTimetable,
  StudentPayments,
  AdminDashboard,
  LecturerDashboard,
} from './pages/Placeholders'

// ── Helper pages ──────────────────────────────────────────
import TenantError from './pages/tenant/TenantError'
import TenantLoading from './pages/tenant/TenantLoading'
import { Spinner } from './components/ui'

// ── PROTECTED ROUTE ───────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── ROUTER ────────────────────────────────────────────────
const AppRouter = () => {
  const { isMainPlatform, loading, error } = useTenant()

  if (loading) return <TenantLoading />
  if (error) return <TenantError message={error} />

  // ── Platform routes (gmis.com) ──
  if (isMainPlatform) {
    return (
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/find"     element={<FindInstitution />} />
        <Route path="/register" element={<OrgRegistration />} />
        <Route path="/admin"    element={<PlatformAdmin />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // ── Tenant routes (estam.gmis.com) ──
  return (
    <Routes>
      <Route path="/"          element={<SchoolLogin />} />
      <Route path="/login"     element={<SchoolLogin />} />
      <Route path="/signup"    element={<StudentSignup />} />
      <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/results"   element={<ProtectedRoute><StudentResults /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><StudentTimetable /></ProtectedRoute>} />
      <Route path="/payments"  element={<ProtectedRoute><StudentPayments /></ProtectedRoute>} />
      <Route path="/admin"     element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/lecturer"  element={<ProtectedRoute><LecturerDashboard /></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

// ── ROOT ──────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <TenantProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-slate-50 dark:bg-[#03071a] text-slate-800 dark:text-slate-200 transition-colors duration-300">
              <AppRouter />
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { borderRadius: '12px', fontSize: '13px' },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </TenantProvider>
    </ThemeProvider>
  )
}