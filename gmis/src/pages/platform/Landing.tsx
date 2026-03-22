// ============================================================
// GMIS — Landing Page (gmis.com)
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Badge } from '../../components/ui'
import { useTheme } from '../../context/ThemeContext'
import { formatNaira } from '../../lib/helpers'

const PRICES = {
  monthly:   [15000, 35000, 80000],
  quarterly: [40000, 95000, 210000],
  biannual:  [75000, 175000, 390000],
  yearly:    [120000, 300000, 750000],
}
const SAVES = { monthly: '', quarterly: '11% off', biannual: '17% off', yearly: '33% off' }

const FEATURES = [
  ['📊', 'Results Management', 'Upload via matric no. Admin releases. Students view instantly.'],
  ['📅', 'Smart Timetable', 'Class & exam timetables per dept. Admin assigns venues & lecturers.'],
  ['💳', 'Fee Payments', 'Schools link own Paystack API. GMIS takes zero cut from students.'],
  ['📱', 'QR Attendance', 'Time-limited QR per class. Anti-cheat: device fingerprint + GPS.'],
  ['🗳️', 'Voting System', 'Full SUG elections — candidates, manifestos, live vote count.'],
  ['💬', 'Chat + Social', 'WhatsApp-style DMs, group chats, and Instagram-like school feed.'],
  ['🤖', 'AI Assistant', 'Claude-powered academic help built directly into the student portal.'],
  ['🧮', 'GPA Calculator', 'Interactive GPA simulator — plan grades before results drop.'],
  ['🧾', 'Clearance System', 'Digital end-of-year clearance: library, fees, hostel, lab, sports.'],
  ['👨‍👩‍👦', 'Parent Portal', 'Parents link via matric number and track results, fees & attendance.'],
  ['📆', 'Academic Calendar', 'Key dates — exams, registration deadlines, holidays — all in one view.'],
  ['🪪', 'ID Card Generation', 'School uploads template. System auto-fills student data. Print in bulk.'],
]

const FAQS = [
  ['How does the wildcard subdomain work?', 'Each school gets their own URL — e.g. estam.gmis.com. This is configured automatically via wildcard DNS when your institution is approved. No extra setup needed.'],
  ['Does GMIS take a cut from student payments?', 'No. GMIS takes zero cut from student transactions. Schools link their own Paystack API keys and all fee payments go 100% directly to the school.'],
  ['How is each school\'s data isolated?', 'Every institution gets its own dedicated Supabase database project. There is zero shared data between schools — auth, files, and records are all fully separate.'],
  ['Can students self-register?', 'Yes. Students register on their school\'s portal using their matric number. The admin reviews and approves each account before portal access is granted.'],
  ['How do parents link to their ward?', 'During student signup, a parent email is collected. The parent receives an invite, creates a GMIS parent account, and links via the ward\'s matric number.'],
  ['What happens if a school misses payment?', 'The system auto-detects overdue payments and locks the organization\'s portal automatically. Only the platform admin (DAMS Technologies) can manually unlock it.'],
]

export default function Landing() {
  const navigate = useNavigate()
  const { dark, toggleTheme } = useTheme()
  const [plan, setPlan] = useState<keyof typeof PRICES>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-navy-950/90 backdrop-blur-xl border-b border-black/8 dark:border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base font-display shadow-lg shadow-blue-600/30">G</div>
            <div>
              <span className="font-display font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight">GMIS</span>
              <span className="ml-2 text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md font-semibold">by DAMS Tech</span>
            </div>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ', 'Contact'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{l}</a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              {dark ? '☀️' : '🌙'}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/find')}>Find my school</Button>
            <Button size="sm" onClick={() => navigate('/register')}>Register institution</Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden min-h-[88vh] flex items-center justify-center">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 dark:from-blue-950/20 to-transparent pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/10 dark:bg-blue-600/8 blur-[100px] -top-48 -right-24 pointer-events-none" style={{ animation: 'float 12s ease-in-out infinite' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-indigo-500/8 dark:bg-indigo-600/6 blur-[80px] -bottom-32 -left-16 pointer-events-none" style={{ animation: 'float 10s ease-in-out infinite reverse' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#2d6cff 1px,transparent 1px),linear-gradient(90deg,#2d6cff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-black/8 dark:border-white/10 px-4 py-1.5 rounded-full mb-8 animate-fade-up">
            <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation: 'pulseDot 2s infinite' }} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Now live — GRASP Management Information System</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">by DAMS Technologies</span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white leading-[1.05] tracking-[-2px] mb-6 animate-fade-up animation-delay-100">
            The academic portal<br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              for every Nigerian school
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light animate-fade-up animation-delay-200">
            Each institution gets its own isolated portal, subdomain, and database. Students, lecturers, admins, and parents — all in one secure, modern platform.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-16 animate-fade-up animation-delay-300">
            <Button size="lg" onClick={() => navigate('/find')}>Find your institution →</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/register')}>Register your school</Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-up animation-delay-400">
            {[['14', 'Student features'], ['9', 'Admin tools'], ['100%', 'Data isolated'], ['₦15K', 'Starting price/mo']].map(([n, l]) => (
              <div key={l} className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-black/8 dark:border-white/10 rounded-2xl p-4">
                <div className="font-display font-black text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{n}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="features" className="py-24 bg-slate-100/50 dark:bg-navy-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="text-xs font-bold uppercase tracking-[3px] text-slate-400 mb-3">How it works</div>
            <h2 className="font-display font-black text-4xl text-slate-800 dark:text-slate-100">From gmis.com to your school portal in seconds</h2>
          </div>
          <div className="flex items-stretch justify-center gap-0 flex-wrap md:flex-nowrap">
            {[
              ['01', '🌐', 'Visit gmis.com', 'The gateway for all institutions on the platform.'],
              ['02', '🔍', 'Find your school', 'Type your school name. System resolves the slug.'],
              ['03', '🔀', 'Auto-redirect', 'Sent to schoolname.gmis.com — fully isolated portal.'],
              ['04', '🔐', 'Sign in', 'Students use matric number. Staff use email.'],
              ['05', '🎓', 'Full portal access', 'Results, payments, voting, chat, AI — everything.'],
            ].map(([num, icon, title, desc], i) => (
              <div key={num} className="flex-1 min-w-[150px] max-w-[200px] flex flex-col items-center text-center px-3 relative">
                {i < 4 && <div className="absolute right-0 top-7 text-slate-300 dark:text-slate-600 text-xl hidden md:block">→</div>}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl mb-3 shadow-lg shadow-blue-600/25">{icon}</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-widest">STEP {num}</div>
                <div className="font-display font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">{title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[3px] text-slate-400 mb-3">Features</div>
            <h2 className="font-display font-black text-4xl text-slate-800 dark:text-slate-100">Everything your institution needs</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3">14 student features · 9 admin tools · 4 lecturer modules · Parent portal</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map(([icon, title, desc]) => (
              <Card key={title} hover className="p-5">
                <div className="text-2xl mb-3">{icon}</div>
                <div className="font-display font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">{title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-slate-100/50 dark:bg-navy-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-[3px] text-slate-400 mb-3">Pricing</div>
            <h2 className="font-display font-black text-4xl text-slate-800 dark:text-slate-100">Simple, transparent pricing</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3">One subscription covers your entire institution. Students pay fees directly to you.</p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="flex bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-black/8 dark:border-white/10 rounded-xl p-1">
              {(Object.keys(PRICES) as Array<keyof typeof PRICES>).map((b) => (
                <button key={b} onClick={() => setPlan(b)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${plan === b ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                  {SAVES[b] && <span className={`ml-1 text-[10px] ${plan === b ? 'text-blue-100' : 'text-green-500'}`}>{SAVES[b]}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Starter', idx: 0, students: '300', lec: '20', features: ['All student features', 'Admin dashboard', 'QR attendance', 'Results & timetable', 'Fee payment integration'] },
              { name: 'Pro', idx: 1, students: '2,000', lec: '100', popular: true, features: ['Everything in Starter', 'AI Academic Assistant', 'Voting & elections', 'Internal chat + social feed', 'ID card generation'] },
              { name: 'Enterprise', idx: 2, students: 'Unlimited', lec: 'Unlimited', features: ['Everything in Pro', 'Parent portal', 'Clearance system', 'GPA calculator', 'Priority support'] },
            ].map((p) => (
              <Card key={p.name} className={`relative ${p.popular ? 'border-2 border-blue-500 shadow-[0_0_40px_rgba(45,108,255,0.2)]' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>
                )}
                <div className="font-display font-black text-lg text-slate-800 dark:text-slate-200 mb-1">{p.name}</div>
                <div className="text-xs text-slate-400 mb-4">Up to {p.students} students · {p.lec} lecturers</div>
                <div className="font-display font-black text-3xl text-slate-900 dark:text-white mb-1">
                  <span className="text-lg">₦</span>{PRICES[plan][p.idx].toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mb-5">per {plan === 'monthly' ? 'month' : plan === 'quarterly' ? '3 months' : plan === 'biannual' ? '6 months' : 'year'}</div>
                <div className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="text-green-500 font-bold">✓</span>{f}
                    </div>
                  ))}
                </div>
                <Button variant={p.popular ? 'primary' : 'secondary'} full onClick={() => navigate('/register')}>
                  Get started →
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[3px] text-slate-400 mb-3">FAQ</div>
            <h2 className="font-display font-black text-4xl text-slate-800 dark:text-slate-100">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(([q, a], i) => (
              <Card key={i} className="cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{q}</span>
                  <span className={`text-blue-600 text-xl flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </div>
                {openFaq === i && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-4 pt-4 border-t border-black/8 dark:border-white/8">
                    {a}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(45,108,255,0.15),transparent)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display font-black text-4xl sm:text-5xl text-white mb-4 tracking-tight">Ready to go digital?</h2>
          <p className="text-blue-200/70 text-lg mb-8">Register your institution today. Go live in 48 hours.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button variant="gold" size="lg" onClick={() => navigate('/register')}>Register institution →</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/find')} className="border-white/20 text-white/80 hover:bg-white/10">Find my school</Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black font-display">G</div>
                <span className="font-display font-black text-lg text-white">GMIS</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">GRASP Management Information System — the all-in-one academic portal for Nigerian higher institutions.</p>
              <p className="text-xs text-slate-500">A product of <span className="text-amber-400 font-semibold">DAMS Technologies</span></p>
            </div>
            {[
              ['Product', ['Features', 'Pricing', 'Security', 'Changelog']],
              ['Company', ['About DAMS Tech', 'Blog', 'Careers', 'Contact']],
              ['Support', ['Help center', 'FAQ', 'Setup guide', 'Privacy policy']],
            ].map(([head, links]) => (
              <div key={head as string}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{head}</div>
                {(links as string[]).map((l) => <div key={l} className="text-sm text-slate-600 hover:text-slate-400 mb-2 cursor-pointer transition-colors">{l}</div>)}
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600">
            <span>© 2025 GMIS — A product of DAMS Technologies. All rights reserved.</span>
            <span>Built for Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
