// ============================================================
// GMIS — Placeholder Pages
// FIXED: Added all missing exports that App.tsx requires
// ============================================================
import { useNavigate } from 'react-router-dom'

const PlaceholderPage = ({
  title,
  description,
  emoji = '🚧',
}: {
  title: string
  description: string
  emoji?: string
}) => {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24,
      textAlign: 'center', fontFamily: "'DM Sans',system-ui,sans-serif",
      background: '#03071a', color: '#e8eeff',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 28, color: '#fff',
        boxShadow: '0 8px 28px rgba(45,108,255,0.35)',
        fontFamily: "'Syne',system-ui,sans-serif",
      }}>G</div>
      <div style={{ fontSize: 48 }}>{emoji}</div>
      <div>
        <h1 style={{
          fontFamily: "'Syne',system-ui,sans-serif",
          fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#e8eeff',
        }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#7a8bbf', maxWidth: 400, lineHeight: 1.7 }}>
          {description}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '9px 20px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: '#7a8bbf',
            cursor: 'pointer', fontSize: 13,
            fontFamily: "'DM Sans',system-ui",
          }}
        >← Go back</button>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '9px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans',system-ui",
          }}
        >Home</button>
      </div>
    </div>
  )
}

// ── PLATFORM PAGES ─────────────────────────────────────────
export function OrgRegistrationPlaceholder() {
  return <PlaceholderPage title="Register Institution" description="Organisation registration form — coming soon." emoji="🏫" />
}
export function PlatformAdminPlaceholder() {
  return <PlaceholderPage title="Platform Admin" description="DAMS Technologies master admin panel." emoji="⚙️" />
}

// ── STUDENT PAGES ──────────────────────────────────────────
export function StudentCourses() {
  return <PlaceholderPage title="Course Registration" description="Register for your semester courses." emoji="📝" />
}
export function StudentVoting() {
  return <PlaceholderPage title="Voting & Elections" description="Participate in SUG and departmental elections." emoji="🗳️" />
}
export function StudentChat() {
  return <PlaceholderPage title="Chat" description="Message your classmates and lecturers." emoji="💬" />
}
export function StudentSocial() {
  return <PlaceholderPage title="Social Feed" description="See what's happening on campus." emoji="📸" />
}
export function StudentGPA() {
  return <PlaceholderPage title="GPA Calculator" description="Simulate your semester GPA before results drop." emoji="🧮" />
}
export function StudentClearance() {
  return <PlaceholderPage title="Clearance" description="Track your end-of-year clearance status." emoji="🧾" />
}
export function StudentCalendar() {
  return <PlaceholderPage title="Academic Calendar" description="Key dates, exams, deadlines and holidays." emoji="📆" />
}
export function StudentAI() {
  return <PlaceholderPage title="AI Assistant" description="Your Claude-powered academic assistant." emoji="🤖" />
}
export function StudentSettings() {
  return <PlaceholderPage title="Settings" description="Manage your account and preferences." emoji="⚙️" />
}

// ── ADMIN PAGES ────────────────────────────────────────────
export function AdminTimetable() {
  return <PlaceholderPage title="Timetable Management" description="Create and manage class timetables." emoji="📅" />
}
export function AdminIDCards() {
  return <PlaceholderPage title="ID Card Generation" description="Generate and print student ID cards." emoji="🪪" />
}
export function AdminElections() {
  return <PlaceholderPage title="Elections" description="Manage SUG elections and voting." emoji="🗳️" />
}

export default PlaceholderPage