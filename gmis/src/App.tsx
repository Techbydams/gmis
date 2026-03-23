// ============================================================
// GMIS — Main App Router
// FIXED: Provider tree order, role detection, import cleanup
// ============================================================

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'

import { ThemeProvider }             from './context/ThemeContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { AuthProvider, useAuth }     from './context/AuthContext'

// Platform pages
import Landing         from './pages/platform/Landing'
import FindInstitution from './pages/platform/FindInstitution'
import OrgRegistration from './pages/platform/OrgRegistration'
import PlatformAdmin   from './pages/platform/PlatformAdmin'

// Tenant auth pages
import SchoolLogin   from './pages/tenant/SchoolLogin'
import StudentSignup from './pages/tenant/StudentSignup'
import SetupAccount  from './pages/tenant/SetupAccount'

// Helper pages
import TenantError   from './pages/tenant/TenantError'
import TenantLoading from './pages/tenant/TenantLoading'

// Real pages
import StudentDashboard         from './pages/tenant/student/Dashboard'
import StudentResults           from './pages/tenant/student/Results'
import StudentTimetable         from './pages/tenant/student/Timetable'
import StudentPayments          from './pages/tenant/student/Payments'
import CourseRegistration       from './pages/tenant/student/CourseRegistration'
import ParentPortal             from './pages/tenant/parent/Portal'
import AdminDashboard   from './pages/tenant/admin/Dashboard'
import AdminTimetable from './pages/tenant/admin/Timetable'
import LecturerPortal   from './pages/tenant/lecturer/Dashboard'
import StudentVoting   from './pages/tenant/student/Voting'
import StudentClearance from './pages/tenant/student/Clearance'
import StudentChat from './pages/tenant/student/Chat'
import StudentGPA from './pages/tenant/student/GPACalculator'
import AdminLogin from './pages/tenant/AdminLogin'
import StudentSocial      from './pages/tenant/student/Social'
import StudentCalendar    from './pages/tenant/student/Calender'
import StudentSettings    from './pages/tenant/student/Settings'
import AdminElections from './pages/tenant/admin/Elections'

// Placeholders for pages not yet built
import {
  StudentAI,
  AdminIDCards,
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

  if (!user) {
  // Admin routes get their own login page, not the student portal
  if (allowedRoles?.length === 1 && allowedRoles[0] === 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  return <Navigate to="/login" replace />
}

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin')    return <Navigate to="/admin" replace />
    if (user.role === 'lecturer') return <Navigate to="/lecturer" replace />
    if (user.role === 'parent')   return <Navigate to="/parent" replace />
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// ── AUTO REDIRECT AFTER LOGIN ─────────────────────────────
// Watches user.role AFTER auth resolves and navigates once
const RoleRedirect = () => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !user) return
    // Only redirect from root /login — let other routes stay
    if (window.location.pathname === '/login' || window.location.pathname === '/') {
      if (user.role === 'admin')    navigate('/admin', { replace: true })
      else if (user.role === 'lecturer') navigate('/lecturer', { replace: true })
      else if (user.role === 'parent')   navigate('/parent', { replace: true })
      else navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  return null
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
    <>
      <RoleRedirect />
      <Routes>
        {/* Public */}
        <Route path="/"       element={<SchoolLogin />} />
        <Route path="/login"  element={<SchoolLogin />} />
        <Route path="/signup" element={<StudentSignup />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Account setup — admin first-time + lecturer invite activation */}
        <Route path="/setup"  element={<SetupAccount />} />

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
        <Route path="/courses" element={
          <ProtectedRoute allowedRoles={['student']}>
            <CourseRegistration />
          </ProtectedRoute>
        } />
        <Route path="/voting" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentVoting />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentChat />
          </ProtectedRoute>
        } />
        <Route path="/social" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentSocial />
          </ProtectedRoute>
        } />
        <Route path="/gpa" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentGPA />
          </ProtectedRoute>
        } />
        <Route path="/clearance" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentClearance />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentCalendar />
          </ProtectedRoute>
        } />
        <Route path="/ai" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentAI />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentSettings />
          </ProtectedRoute>
        } />

        {/* Admin routes — all handled by AdminDashboard with active tab prop */}
        <Route path="/admin"           element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="approvals" /></ProtectedRoute>} />
        <Route path="/admin/students"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="students" /></ProtectedRoute>} />
        <Route path="/admin/courses"   element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="courses" /></ProtectedRoute>} />
        <Route path="/admin/results"   element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="results" /></ProtectedRoute>} />
        <Route path="/admin/fees"      element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="fees" /></ProtectedRoute>} />
        <Route path="/admin/news"      element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="news" /></ProtectedRoute>} />
        <Route path="/admin/paystack"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="paystack" /></ProtectedRoute>} />
        <Route path="/admin/settings"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="settings" /></ProtectedRoute>} />
        <Route path="/admin/timetable" element={<ProtectedRoute allowedRoles={['admin']}><AdminTimetable /></ProtectedRoute>} />
        <Route path="/admin/idcards"   element={<ProtectedRoute allowedRoles={['admin']}><AdminIDCards /></ProtectedRoute>} />
        <Route path="/admin/elections" element={<ProtectedRoute allowedRoles={['admin']}><AdminElections /></ProtectedRoute>} />
        <Route path="/admin/academic"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard initialTab="academic" /></ProtectedRoute>} />

        {/* Lecturer routes */}
        <Route path="/lecturer"            element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerPortal /></ProtectedRoute>} />
        <Route path="/lecturer/students"   element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerPortal initialTab="students" /></ProtectedRoute>} />
        <Route path="/lecturer/results"    element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerPortal initialTab="results" /></ProtectedRoute>} />
        <Route path="/lecturer/attendance" element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerPortal initialTab="attendance" /></ProtectedRoute>} />
        <Route path="/lecturer/handouts"   element={<ProtectedRoute allowedRoles={['lecturer']}><LecturerPortal initialTab="handouts" /></ProtectedRoute>} />

        {/* Parent routes */}
        <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentPortal /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

// ── ROOT ──────────────────────────────────────────────────
// FIXED: BrowserRouter is now outermost so useNavigate works everywhere
// Order: BrowserRouter → ThemeProvider → TenantProvider → AuthProvider
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider>
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
          </AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}