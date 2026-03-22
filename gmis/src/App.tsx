// ============================================================
// GMIS — Main App Router (Clean — no broken imports)
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { ThemeProvider }             from './context/ThemeContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { AuthProvider, useAuth }     from './context/AuthContext'

// Platform pages
import Landing         from './pages/platform/Landing'
import FindInstitution from './pages/platform/FindInstitution'

// Tenant auth pages
import SchoolLogin   from './pages/tenant/SchoolLogin'
import StudentSignup from './pages/tenant/StudentSignup'

// Helper pages
import TenantError   from './pages/tenant/TenantError'
import TenantLoading from './pages/tenant/TenantLoading'

// ── STEP: Uncomment each import ONLY after you place the file ──
import StudentDashboard   from './pages/tenant/student/Dashboard'
// import StudentResults     from './pages/tenant/student/Results'
// import StudentTimetable   from './pages/tenant/student/Timetable'
// import StudentPayments    from './pages/tenant/student/Payments'
import AdminDashboard     from './pages/tenant/admin/Dashboard'
// import AdminAcademicSetup from './pages/tenant/admin/AcademicSetup'
// import LecturerDashboard  from './pages/tenant/lecturer/Dashboard'

// Placeholders for everything not yet built
import {
  OrgRegistration,
  PlatformAdmin,
  StudentResults,
  StudentTimetable,
  StudentPayments,
  LecturerDashboard,
} from './pages/Placeholders'

// ── PROTECTED ROUTE ───────────────────────────────────────
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles?: string[]
}) => {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#03071a',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(45,108,255,0.2)',
        borderTopColor: '#2d6cff',
        borderRadius: '50%',
        animation: 'spin .8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin')    return <Navigate to="/admin" replace />
    if (user.role === 'lecturer') return <Navigate to="/lecturer" replace />
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// ── ROUTER ────────────────────────────────────────────────
const AppRouter = () => {
  const { isMainPlatform, loading, error } = useTenant()

  if (loading) return <TenantLoading />
  if (error)   return <TenantError message={error} />

  // Platform routes (gmis.com)
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

  // Tenant routes (estam.gmis.com)
  return (
    <Routes>
      {/* Public */}
      <Route path="/"       element={<SchoolLogin />} />
      <Route path="/login"  element={<SchoolLogin />} />
      <Route path="/signup" element={<StudentSignup />} />

      {/* Student routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/results" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentResults />
        </ProtectedRoute>
      } />
      <Route path="/timetable" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentTimetable />
        </ProtectedRoute>
      } />
      <Route path="/payments" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StudentPayments />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin"           element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/students"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/courses"   element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/results"   element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/fees"      element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/news"      element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/paystack"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/settings"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/academic"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

      {/* Lecturer routes */}
      <Route path="/lecturer"            element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/lecturer/students"   element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/lecturer/results"    element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/lecturer/attendance" element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/lecturer/handouts"   element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
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
            <div style={{ minHeight: '100vh', background: '#03071a', color: '#e8eeff' }}>
              <AppRouter />
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontFamily: "'DM Sans', system-ui",
                },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </TenantProvider>
    </ThemeProvider>
  )
}