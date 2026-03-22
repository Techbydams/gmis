// ============================================================
// GMIS — Placeholder Pages (no external imports needed)
// These will be replaced one by one as we build each screen
// ============================================================

import { useNavigate } from 'react-router-dom'

const PlaceholderPage = ({ title, description }: { title: string; description: string }) => {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: 24,
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      background: '#03071a',
      color: '#e8eeff',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 28, color: '#fff',
      }}>G</div>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#7a8bbf', maxWidth: 400 }}>{description}</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
        >← Go back</button>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >Home</button>
      </div>
    </div>
  )
}



export function SchoolLogin() {
  return <PlaceholderPage title="School Login" description="estam.gmis.com — student/staff login — coming in next session." />
}

export function StudentSignup() {
  return <PlaceholderPage title="Student Sign Up" description="Student self-registration — coming in next session." />
}

export function StudentDashboard() {
  return <PlaceholderPage title="Student Dashboard" description="Full student portal — coming in Phase 2." />
}

export function StudentResults() {
  return <PlaceholderPage title="My Results" description="Academic results viewer — coming in Phase 2." />
}

export function StudentTimetable() {
  return <PlaceholderPage title="Timetable" description="Weekly class timetable — coming in Phase 2." />
}

export function StudentPayments() {
  return <PlaceholderPage title="Fee Payments" description="Paystack fee payment — coming in Phase 3." />
}

export function AdminDashboard() {
  return <PlaceholderPage title="Admin Dashboard" description="School administration panel — coming in Phase 4." />
}

export function LecturerDashboard() {
  return <PlaceholderPage title="Lecturer Portal" description="Result upload and QR attendance — coming in Phase 4." />
}

export default PlaceholderPage