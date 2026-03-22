// GMIS — Placeholder Pages
import { useNavigate } from 'react-router-dom'

const PlaceholderPage = ({ title, description, emoji = '🚧' }: { title: string; description: string; emoji?: string }) => {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:24, textAlign:'center', fontFamily:"'DM Sans',system-ui,sans-serif", background:'#03071a', color:'#e8eeff' }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'linear-gradient(135deg,#2d6cff,#4f3ef8)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:28, color:'#fff', boxShadow:'0 8px 28px rgba(45,108,255,0.35)' }}>G</div>
      <div style={{ fontSize:48 }}>{emoji}</div>
      <div>
        <h1 style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:22, fontWeight:800, marginBottom:8, color:'#e8eeff' }}>{title}</h1>
        <p style={{ fontSize:14, color:'#7a8bbf', maxWidth:400, lineHeight:1.7 }}>{description}</p>
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={()=>navigate(-1)} style={{ padding:'9px 20px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'#7a8bbf', cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',system-ui" }}>← Go back</button>
        <button onClick={()=>navigate('/')} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2d6cff,#4f3ef8)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:"'DM Sans',system-ui" }}>Home</button>
      </div>
    </div>
  )
}

export function OrgRegistration()   { return <PlaceholderPage title="Register Institution"  description="Organisation registration form — coming soon." emoji="🏫"/> }
export function PlatformAdmin()     { return <PlaceholderPage title="Platform Admin"         description="DAMS Technologies master admin panel." emoji="⚙️"/> }
export function StudentDashboard()  { return <PlaceholderPage title="Student Dashboard"      description="Place Dashboard.tsx in src/pages/tenant/student/ to activate." emoji="🎓"/> }
export function StudentResults()    { return <PlaceholderPage title="My Results"             description="Place Results.tsx in src/pages/tenant/student/ to activate." emoji="📊"/> }
export function StudentTimetable()  { return <PlaceholderPage title="Timetable"              description="Place Timetable.tsx in src/pages/tenant/student/ to activate." emoji="📅"/> }
export function StudentPayments()   { return <PlaceholderPage title="Fee Payments"           description="Place Payments.tsx in src/pages/tenant/student/ to activate." emoji="💳"/> }
export function LecturerDashboard() { return <PlaceholderPage title="Lecturer Portal"        description="Place Dashboard.tsx in src/pages/tenant/lecturer/ to activate." emoji="👨‍🏫"/> }

export default PlaceholderPage