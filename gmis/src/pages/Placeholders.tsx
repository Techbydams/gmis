// ============================================================
// GMIS — Placeholder Pages
// Only pages NOT YET BUILT use these.
//
// Real pages (no longer placeholders):
//   StudentVoting    → /pages/tenant/student/Voting.tsx
//   StudentChat      → /pages/tenant/student/Chat.tsx
//   StudentGPA       → /pages/tenant/student/GPACalculator.tsx
//   StudentClearance → /pages/tenant/student/Clearance.tsx
//   StudentSocial    → /pages/tenant/student/Social.tsx
//   StudentCalendar  → /pages/tenant/student/Calendar.tsx
//   StudentSettings  → /pages/tenant/student/Settings.tsx
// ============================================================
import { useNavigate } from 'react-router-dom'

const PlaceholderPage = ({
  title,
  description,
  emoji = '🚧',
  roadmap,
}: {
  title: string
  description: string
  emoji?: string
  roadmap?: string[]
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
      {roadmap && roadmap.length > 0 && (
        <div style={{
          padding: '14px 20px', background: 'rgba(45,108,255,0.08)',
          border: '1px solid rgba(45,108,255,0.2)', borderRadius: 14,
          maxWidth: 360, textAlign: 'left',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', marginBottom: 8 }}>
            Planned features
          </div>
          {roadmap.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 4 }}>
              · {f}
            </div>
          ))}
        </div>
      )}
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
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '9px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans',system-ui",
          }}
        >Dashboard</button>
      </div>
    </div>
  )
}

// ── AI ASSISTANT — not yet built ──────────────────────────
export function StudentAI() {
  return (
    <PlaceholderPage
      title="AI Academic Assistant"
      description="Your Claude-powered academic assistant is coming soon. It will help you understand course material, check your results, and answer academic questions."
      emoji="🤖"
      roadmap={[
        'Chat with Claude about your courses',
        'Get help understanding results and GPA',
        'Study tips and academic guidance',
        'Summarise lecture notes',
      ]}
    />
  )
}

// ── ADMIN PLACEHOLDERS ─────────────────────────────────────
export function AdminTimetable() {
  return (
    <PlaceholderPage
      title="Timetable Management"
      description="Build and manage class timetables per department. Assign venues and times to course slots."
      emoji="📅"
      roadmap={[
        'Weekly grid timetable builder',
        'Per-department and per-level views',
        'Venue and lecturer assignment',
        'Export to PDF',
      ]}
    />
  )
}

export function AdminIDCards() {
  return (
    <PlaceholderPage
      title="ID Card Generation"
      description="Generate and print student ID cards in bulk. Upload your card template and the system fills in student data."
      emoji="🪪"
      roadmap={[
        'Custom card template upload',
        'Bulk generation by department',
        'Payment verification before printing',
        'PDF export for printing',
      ]}
    />
  )
}

export function AdminElections() {
  return (
    <PlaceholderPage
      title="Election Management"
      description="Create and manage SUG elections. Add candidates, set voting periods, and view live results."
      emoji="🗳️"
      roadmap={[
        'Create elections with positions',
        'Add and manage candidates',
        'Open/close voting periods',
        'Live vote count dashboard',
      ]}
    />
  )
}

export default PlaceholderPage