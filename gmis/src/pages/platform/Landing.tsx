// ============================================================
// GMIS — Landing Page (gmis.app)
// UPDATED:
//   - Removed all Nigeria-specific language
//   - Rebranded as international academic platform
//   - Region detection for currency display
//   - Pricing shown in USD as default, auto-converts by region
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui'
import { useTheme } from '../../context/ThemeContext'

// ── REGION DETECTION ─────────────────────────────────────
// Detects user's region from browser locale and timezone
// to show appropriate currency. No external API needed.
function detectRegion(): { currency: string; symbol: string; locale: string } {
  try {
    const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const lang     = navigator.language || 'en'

    // Africa / Middle East timezones → Nigerian Naira display context
    if (tz.startsWith('Africa/Lagos') || tz.startsWith('Africa/Abuja')) {
      return { currency: 'NGN', symbol: '₦', locale: 'en-NG' }
    }
    // Other African timezones → show USD but note local pricing available
    if (tz.startsWith('Africa/')) {
      return { currency: 'USD', symbol: '$', locale: 'en-US' }
    }
    // UK
    if (lang.startsWith('en-GB') || tz.startsWith('Europe/London')) {
      return { currency: 'GBP', symbol: '£', locale: 'en-GB' }
    }
    // Eurozone
    if (tz.startsWith('Europe/') && !tz.startsWith('Europe/London')) {
      return { currency: 'EUR', symbol: '€', locale: 'en-EU' }
    }
    // Default USD
    return { currency: 'USD', symbol: '$', locale: 'en-US' }
  } catch {
    return { currency: 'USD', symbol: '$', locale: 'en-US' }
  }
}

// Approximate pricing per currency (in whole units)
const PRICES_BY_CURRENCY: Record<string, number[][]> = {
  // [monthly, quarterly, biannual, yearly] per plan [starter, pro, enterprise]
  USD: [[29, 69, 149], [75, 179, 389], [140, 330, 720], [220, 520, 1100]],
  GBP: [[23, 55, 119], [59, 139, 309], [109, 259, 569], [175, 410, 870]],
  EUR: [[27, 65, 139], [70, 169, 359], [129, 309, 669], [205, 480, 1020]],
  NGN: [[15000, 35000, 80000], [40000, 95000, 210000], [75000, 175000, 390000], [120000, 300000, 750000]],
}

function formatPrice(amount: number, symbol: string, currency: string): string {
  if (currency === 'NGN') return `${symbol}${amount.toLocaleString('en-NG')}`
  return `${symbol}${amount.toLocaleString('en-US')}`
}

const BILLING_LABELS = ['Monthly', 'Quarterly', 'Biannual', 'Yearly']
const BILLING_SAVINGS = ['', '11% off', '17% off', '33% off']

// ── FEATURES ─────────────────────────────────────────────
const FEATURES = [
  ['📊', 'Results Management', 'Upload via student ID. Admin approves. Students view instantly.'],
  ['📅', 'Smart Timetable',     'Class and exam timetables per department. Assign venues and lecturers.'],
  ['💳', 'Fee Payments',        'Institutions link their own payment gateway. GMIS takes zero cut.'],
  ['📱', 'QR Attendance',       'Time-limited QR per class. Anti-cheat: device fingerprint + location.'],
  ['🗳️', 'Voting System',       'Full student elections — candidates, manifestos, live vote count.'],
  ['💬', 'Chat + Social',       'Direct messaging, group chats, and an institution-wide social feed.'],
  ['🤖', 'AI Assistant',        'AI-powered academic help built directly into the student portal.'],
  ['🧮', 'GPA Calculator',      'Interactive GPA simulator — plan grades before results are published.'],
  ['🧾', 'Clearance System',    'Digital end-of-year clearance: library, fees, accommodation and more.'],
  ['👨‍👩‍👦', 'Parent Portal',       'Parents link via student ID and track results, fees and attendance.'],
  ['📆', 'Academic Calendar',   'Key dates — exams, registration deadlines, holidays — all in one view.'],
  ['🪪', 'ID Card Generation',  'Institution uploads template. System auto-fills student data. Print in bulk.'],
]

const FAQS = [
  ['How does the subdomain system work?', 'Each institution gets their own URL — e.g. yourschool.gmis.app. This is configured automatically via wildcard DNS when your institution is approved. No extra technical setup needed on your end.'],
  ['Does GMIS take a cut from student payments?', 'No. GMIS takes zero cut from student transactions. Institutions link their own payment gateway and all fee payments go 100% directly to the institution.'],
  ['How is each institution\'s data isolated?', 'Every institution gets its own dedicated database. There is zero shared data between institutions — authentication, files, and records are fully separate.'],
  ['Can students self-register?', 'Yes. Students register on their institution\'s portal using their student ID. The admin reviews and approves each account before portal access is granted.'],
  ['How do parents link to their child\'s account?', 'During student registration, a parent email is optionally collected. The parent receives an invite, creates a GMIS account, and links via the student\'s ID number.'],
  ['What happens if an institution misses a payment?', 'The system auto-detects overdue subscriptions and locks the portal automatically. Only the platform admin can manually unlock it.'],
  ['Is GMIS only for certain countries?', 'No. GMIS is designed for higher education institutions globally. Pricing is available in multiple currencies and the platform is localised by region.'],
  ['Can we migrate our existing student data?', 'Yes. We provide CSV import tools for bulk student, lecturer, and course data. Our setup team assists with migration during onboarding.'],
]

export default function Landing() {
  const navigate = useNavigate()
  const { dark, toggleTheme } = useTheme()
  const [billingIdx, setBillingIdx] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [region, setRegion] = useState(detectRegion())

  useEffect(() => {
    setRegion(detectRegion())
  }, [])

  const prices = PRICES_BY_CURRENCY[region.currency] || PRICES_BY_CURRENCY.USD

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-navy-950/90 backdrop-blur-xl border-b border-black/8 dark:border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base font-display shadow-lg shadow-blue-600/30">G</div>
            <div>
              <span className="font-display font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight">GMIS</span>
              <span className="ml-2 text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md font-semibold">by DAMS Tech</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ', 'Contact'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{l}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              {dark ? '☀️' : '🌙'}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/find')}>Find my institution</Button>
            <Button size="sm" onClick={() => navigate('/register')}>Get started</Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden min-h-[88vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 dark:from-blue-950/20 to-transparent pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/10 dark:bg-blue-600/8 blur-[100px] -top-48 -right-24 pointer-events-none" style={{ animation: 'float 12s ease-in-out infinite' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-indigo-500/8 dark:bg-indigo-600/6 blur-[80px] -bottom-32 -left-16 pointer-events-none" style={{ animation: 'float 10s ease-in-out infinite reverse' }} />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#2d6cff 1px,transparent 1px),linear-gradient(90deg,#2d6cff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-black/8 dark:border-white/10 px-4 py-1.5 rounded-full mb-8 animate-fade-up">
            <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation: 'pulseDot 2s infinite' }} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Now live — GRASP Management Information System</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">by DAMS Technologies</span>
          </div>

          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl text-slate-900 dark:text-white leading-[1.05] tracking-[-2px] mb-6 animate-fade-up animation-delay-100">
            The modern academic portal<br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              for every institution
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light animate-fade-up animation-delay-200">
            Each institution gets its own isolated portal, subdomain, and database. Students, lecturers, admins, and parents — all in one secure, modern platform. Deployed globally.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-16 animate-fade-up animation-delay-300">
            <Button size="lg" onClick={() => navigate('/find')}>Find your institution →</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/register')}>Register your institution</Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-up animation-delay-400">
            {[
              ['14+', 'Student features'],
              ['9',   'Admin tools'],
              ['100%', 'Data isolated per school'],
              [formatPrice(prices[0][0], region.symbol, region.currency), 'Starting price/mo'],
            ].map(([n, l]) => (
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
            <h2 className="font-display font-black text-4xl text-slate-800 dark:text-slate-100">From gmis.app to your institution portal in seconds</h2>
          </div>
          <div className="flex items-stretch justify-center gap-0 flex-wrap md:flex-nowrap">
            {[
              ['01', '🌐', 'Visit gmis.app',     'The gateway for all institutions on the platform.'],
              ['02', '🔍', 'Find your school',    'Type your institution name. System resolves the subdomain.'],
              ['03', '🔀', 'Auto-redirect',       'Sent to yourschool.gmis.app — fully isolated portal.'],
              ['04', '🔐', 'Sign in',             'Students use their ID number. Staff use email.'],
              ['05', '🎓', 'Full portal access',  'Results, payments, voting, chat, AI — everything.'],
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
            {/* Region indicator */}
            <p className="text-xs text-slate-400 mt-2">
              Showing prices in <strong>{region.currency}</strong> · Detected from your region ·{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setRegion({ currency: 'USD', symbol: '$', locale: 'en-US' })}>Switch to USD</button>
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="flex bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-black/8 dark:border-white/10 rounded-xl p-1">
              {BILLING_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setBillingIdx(i)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${billingIdx === i ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {label}
                  {BILLING_SAVINGS[i] && (
                    <span className={`ml-1 text-[10px] ${billingIdx === i ? 'text-blue-100' : 'text-green-500'}`}>
                      {BILLING_SAVINGS[i]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter', idx: 0, students: '300', lec: '20',
                features: ['All student features', 'Admin dashboard', 'QR attendance', 'Results & timetable', 'Payment integration'],
              },
              {
                name: 'Pro', idx: 1, students: '2,000', lec: '100', popular: true,
                features: ['Everything in Starter', 'AI Academic Assistant', 'Voting & elections', 'Internal chat + social feed', 'ID card generation'],
              },
              {
                name: 'Enterprise', idx: 2, students: 'Unlimited', lec: 'Unlimited',
                features: ['Everything in Pro', 'Parent portal', 'Clearance system', 'GPA calculator', 'Priority support & SLA'],
              },
            ].map(p => (
              <Card key={p.name} className={`relative ${p.popular ? 'border-2 border-blue-500 shadow-[0_0_40px_rgba(45,108,255,0.2)]' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="font-display font-black text-lg text-slate-800 dark:text-slate-200 mb-1">{p.name}</div>
                <div className="text-xs text-slate-400 mb-4">Up to {p.students} students · {p.lec} staff</div>
                <div className="font-display font-black text-3xl text-slate-900 dark:text-white mb-1">
                  {formatPrice(prices[billingIdx][p.idx], region.symbol, region.currency)}
                </div>
                <div className="text-xs text-slate-400 mb-5">
                  per {billingIdx === 0 ? 'month' : billingIdx === 1 ? '3 months' : billingIdx === 2 ? '6 months' : 'year'}
                </div>
                <div className="space-y-2 mb-6">
                  {p.features.map(f => (
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

          <p className="text-center text-xs text-slate-400 mt-8">
            All prices exclude applicable local taxes. Custom enterprise pricing available for large institutions and consortiums. <button className="text-blue-600 hover:underline" onClick={() => navigate('/register')}>Contact us →</button>
          </p>
        </div>
      </section>

      {/* ── GLOBAL TRUST SECTION ── */}
      <section className="py-16 bg-white/50 dark:bg-white/2">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xs font-bold uppercase tracking-[3px] text-slate-400 mb-4">Built for the world</div>
          <h2 className="font-display font-black text-3xl text-slate-800 dark:text-slate-100 mb-4">
            One platform. Every institution.
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10">
            GMIS is designed to work for universities, polytechnics, colleges and vocational institutions anywhere in the world. Whether you have 200 students or 20,000, the platform scales with you.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ['🌍', 'Global deployment',    'Works in any country'],
              ['🌐', 'Multi-currency',        'Pricing in your currency'],
              ['🔒', 'Data sovereignty',      'Your data stays yours'],
              ['🚀', '48hr onboarding',       'Live in under 2 days'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="flex flex-col items-center gap-2">
                <div className="text-3xl">{icon}</div>
                <div className="font-display font-bold text-sm text-slate-800 dark:text-slate-200">{title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>
              </div>
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
            <Button variant="ghost" size="lg" onClick={() => navigate('/find')} className="border-white/20 text-white/80 hover:bg-white/10">Find my institution</Button>
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
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                GRASP Management Information System — the all-in-one academic portal for higher education institutions worldwide.
              </p>
              <p className="text-xs text-slate-500">A product of <span className="text-amber-400 font-semibold">DAMS Technologies</span></p>
            </div>
            {[
              ['Product', ['Features', 'Pricing', 'Security', 'Changelog', 'Roadmap']],
              ['Company', ['About DAMS Tech', 'Blog', 'Careers', 'Contact', 'Partners']],
              ['Support', ['Help centre', 'FAQ', 'Setup guide', 'Privacy policy', 'Terms of service']],
            ].map(([head, links]) => (
              <div key={head as string}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{head}</div>
                {(links as string[]).map(l => (
                  <div key={l} className="text-sm text-slate-600 hover:text-slate-400 mb-2 cursor-pointer transition-colors">{l}</div>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600">
            <span>© {new Date().getFullYear()} GMIS — A product of DAMS Technologies. All rights reserved.</span>
            <span>Serving institutions globally 🌍</span>
          </div>
        </div>
      </footer>
    </div>
  )
}