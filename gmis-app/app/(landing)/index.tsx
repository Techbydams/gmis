// ============================================================
// GMIS — Platform Landing Page  v2  (Luxury Redesign)
// Route: /(landing)  — only shown at gmis.app (no subdomain)
//
// Design System: Soft Tech · Liquid Glass · Bento Grid
// Typography:    Space Grotesk (headings) · DM Sans (body)
// Palette:       Deep Indigo #4f3ef8 · Brand Blue #2d6cff
//                Off-White #f8f9ff · Slate text #0f172a
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Platform, Text as RNText, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Text, Button } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight, shadows } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Google Fonts injection (web only) ─────────────────────
function usePremiumFonts() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = "gmis-premium-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id   = id;
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ── Mockup images ─────────────────────────────────────────
// After generating with /banana, place images at:
//   gmis-app/assets/mockups/phone-dashboard.png   (iPhone 15 Pro, 9:16)
//   gmis-app/assets/mockups/macbook-admin.png     (MacBook Pro, 16:9)
// Then uncomment the require() lines below — the drawn fallback
// will be replaced automatically.
const PHONE_MOCKUP_IMAGE: any = null;
// const PHONE_MOCKUP_IMAGE = require("../../assets/mockups/phone-dashboard.png");
const MACBOOK_MOCKUP_IMAGE: any = null;
// const MACBOOK_MOCKUP_IMAGE = require("../../assets/mockups/macbook-admin.png");

// ── Types ─────────────────────────────────────────────────
interface Feature {
  icon:  IconName;
  title: string;
  desc:  string;
  span?: 2 | 1;       // col span in bento grid
  accent?: boolean;   // use gradient card style
}

interface Persona {
  role:       string;
  icon:       IconName;
  color:      string;
  colorAlpha: string;
  headline:   string;
  features:   string[];
}

interface Plan {
  name:     string;
  monthly:  number;
  yearly:   number;
  cap:      string;
  color:    string;
  popular:  boolean;
  features: string[];
}

// ── Data ──────────────────────────────────────────────────
const FEATURES: Feature[] = [
  { icon: "nav-ai",         title: "AI Academic Assistant", accent: true, span: 2,
    desc: "Claude-powered 24/7 help — explains concepts, solves exam problems, reviews drafts. Every student's personal tutor." },
  { icon: "nav-results",    title: "Live Results",
    desc: "Grades the moment they're released. GPA, CGPA, honour class — all computed instantly." },
  { icon: "nav-payments",   title: "Zero-Cut Fees",
    desc: "Paystack per school. 100% of every payment goes directly to the institution." },
  { icon: "nav-attendance", title: "QR Attendance",
    desc: "Anti-cheat QR with device fingerprint + GPS. 15-minute countdown window." },
  { icon: "nav-voting",     title: "SUG Elections",       accent: true, span: 2,
    desc: "Tamper-proof digital voting. Nominations, campaigns, and live results — fully transparent." },
  { icon: "nav-chat",       title: "Campus Chat",
    desc: "WhatsApp-style course groups and DMs between students and lecturers." },
  { icon: "nav-timetable",  title: "Smart Timetable",
    desc: "NOW / UP NEXT live status. Auto-updated every 30 seconds." },
  { icon: "nav-clearance",  title: "Clearance System",
    desc: "Digital library, hostel, lab and fee clearance. No paper queues." },
  { icon: "nav-gpa",        title: "GPA Simulator",
    desc: "Try different scores before results drop. Plan your semester strategy." },
  { icon: "nav-social",     title: "Campus Social",       span: 2,
    desc: "Instagram + TikTok-style feed and reels. Keeps the campus community connected on one platform." },
  { icon: "nav-courses",    title: "Course Registration",
    desc: "Online course registration each semester. Admin controls the window." },
  { icon: "nav-calendar",   title: "Academic Calendar",
    desc: "School-wide events, deadlines and sessions — synced for everyone." },
];

const PERSONAS: Persona[] = [
  {
    role: "Students",      icon: "user-student",  color: brand.blue,    colorAlpha: brand.blueAlpha15,
    headline: "Your entire campus life, in one app.",
    features: [
      "Check results the moment they're released",
      "Pay fees securely via Paystack",
      "Register courses & track progress",
      "Get AI academic help 24/7",
      "Chat with classmates in course groups",
      "Vote in SUG elections from your phone",
    ],
  },
  {
    role: "Lecturers",     icon: "user-lecturer", color: brand.emerald,  colorAlpha: brand.emeraldAlpha15,
    headline: "Grading, attendance, and more — simplified.",
    features: [
      "Upload CA and exam scores by matric",
      "Generate QR codes for live attendance",
      "View all enrolled students per course",
      "Lock submitted results for accuracy",
      "Monitor handout payment status",
      "View timetable and venue info",
    ],
  },
  {
    role: "Administrators", icon: "user-admin",   color: brand.gold,     colorAlpha: brand.goldAlpha15,
    headline: "Full academic control from one dashboard.",
    features: [
      "Full setup: faculties, departments, courses",
      "Approve and manage student registrations",
      "Configure fee structure per level and session",
      "Release results after lecturer submission",
      "Generate and manage student ID cards",
      "Run SUG elections and manage candidates",
    ],
  },
  {
    role: "Parents",       icon: "user-parent",   color: brand.purple,   colorAlpha: brand.purpleAlpha15,
    headline: "Stay connected to your ward's journey.",
    features: [
      "Monitor results in real time",
      "View fee payment history",
      "Track attendance across all courses",
      "Receive automatic alerts on key events",
      "Access academic calendar and exam dates",
      "Link multiple wards to one account",
    ],
  },
];

const STEPS = [
  { n: "1", title: "Register your institution",  color: brand.blue,
    desc: "Submit your school's details. DAMS Technologies reviews and approves within 48 hours." },
  { n: "2", title: "Set up your portal",          color: brand.indigo,
    desc: "Configure faculties, departments, and courses. Your isolated Supabase DB is ready instantly." },
  { n: "3", title: "Onboard your students",       color: brand.purple,
    desc: "Self-register or bulk-import via CSV. Approve each registration with a single click." },
  { n: "4", title: "Go live",                     color: brand.emerald,
    desc: "Your portal is live at yourschool.gmis.app. Students log in with matric or email." },
];

const PLANS: Plan[] = [
  {
    name: "Starter", monthly: 15000, yearly: 11250, cap: "Up to 300 students",
    color: "#60a5fa", popular: false,
    features: [
      "All core student features",
      "Results & timetable management",
      "Fee payment integration",
      "Basic analytics dashboard",
      "Email support",
    ],
  },
  {
    name: "Pro", monthly: 35000, yearly: 26250, cap: "Up to 2,000 students",
    color: brand.blue, popular: true,
    features: [
      "Everything in Starter",
      "AI academic assistant",
      "QR attendance system",
      "Campus social feed & reels",
      "SUG election module",
      "Parent portal access",
      "Priority support",
    ],
  },
  {
    name: "Enterprise", monthly: 80000, yearly: 60000, cap: "Unlimited students",
    color: brand.gold, popular: false,
    features: [
      "Everything in Pro",
      "Unlimited student accounts",
      "Custom subdomain & branding",
      "ID card generation system",
      "Advanced analytics export",
      "Dedicated account manager",
      "SLA-backed uptime guarantee",
    ],
  },
];

const TESTIMONIALS = [
  { quote: "GMIS transformed how we manage student records. What took our registry days now takes minutes. The isolated database architecture was the deciding factor for us.",
    name: "Dr. Seun Adeyemi", role: "ICT Director", school: "Federal Polytechnic Ede" },
  { quote: "Our students love checking results and paying fees from their phones. Even parents call to praise the system. The QR attendance alone ended proxy attendance.",
    name: "Mrs. Folake Okonkwo", role: "Deputy Registrar", school: "Lagos State University of Education" },
  { quote: "We onboarded 1,400 students in under a week using the CSV import. The admin panel is clean and powerful. Best decision we made this academic session.",
    name: "Prof. Emmanuel Eze", role: "Director of Academic Planning", school: "Bells University of Technology" },
];

const FAQ_ITEMS = [
  ["How does the subdomain system work?",             "Each institution gets their own URL — e.g. yourschool.gmis.app. This is configured automatically via wildcard DNS when your institution is approved. No extra technical setup needed on your end."],
  ["Does GMIS take a cut from student payments?",     "No. GMIS takes zero cut from student transactions. Institutions link their own Paystack account and all fee payments go 100% directly to the institution."],
  ["How is each institution's data isolated?",         "Every institution gets its own dedicated Supabase database. There is zero shared data between institutions — authentication, files, and records are fully separate."],
  ["Can students self-register?",                      "Yes. Students register on their institution's portal using their student ID. The admin reviews and approves each account before portal access is granted."],
  ["How do parents link to their child's account?",    "During student registration, a parent email is optionally collected. The parent receives an invite, creates a GMIS account, and links via the student's matric number."],
  ["Is there a mobile app?",                           "Yes. GMIS is a cross-platform Expo app. Students and staff can use the native iOS or Android app, or access the web portal from any browser."],
  ["Can we migrate our existing student data?",        "Yes. We provide CSV import tools for bulk student, lecturer, and course data. Our onboarding team assists with migration during setup."],
  ["What happens if an institution misses a payment?", "The system auto-detects overdue subscriptions and locks the portal. Only the platform admin can manually unlock it after renewal."],
] as const;

// ── Phone Mockup (web decoration) ─────────────────────────
function PhoneMockup() {
  return (
    <View style={S.mockupOuter}>
      {/* Glow orb behind phone */}
      <View style={S.mockupGlow} />

      {PHONE_MOCKUP_IMAGE ? (
        /* AI-generated photorealistic mockup */
        <Image source={PHONE_MOCKUP_IMAGE} style={S.mockupImage} resizeMode="contain" />
      ) : (
        /* Drawn phone frame — fallback until AI mockup is generated */
        <View style={S.phoneFrame}>
          {/* Notch */}
          <View style={S.phoneNotch} />

          {/* Screen content */}
          <View style={S.phoneScreen}>
            {/* App header */}
            <View style={S.appHeader}>
              <View>
                <RNText style={S.appHeaderSub}>Good morning 👋</RNText>
                <RNText style={S.appHeaderName}>Amina Okafor</RNText>
              </View>
              <View style={S.appAvatar}>
                <RNText style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>AO</RNText>
              </View>
            </View>

            {/* GPA card */}
            <View style={S.gpaCard}>
              <RNText style={S.gpaLabel}>Current CGPA</RNText>
              <RNText style={S.gpaValue}>4.21</RNText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" }} />
                <RNText style={S.gpaTag}>Second Class Upper</RNText>
              </View>
            </View>

            {/* Quick stat row */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {[["6", "Courses"], ["87%", "Attend."], ["₦0", "Owing"]].map(([val, lbl]) => (
                <View key={lbl} style={S.statChip}>
                  <RNText style={S.statChipVal}>{val}</RNText>
                  <RNText style={S.statChipLbl}>{lbl}</RNText>
                </View>
              ))}
            </View>

            {/* Recent activity */}
            <View style={{ marginTop: 14 }}>
              <RNText style={S.activityTitle}>Recent Activity</RNText>
              {[
                { dot: "#4ade80", text: "ENG 301 result released" },
                { dot: "#60a5fa", text: "Fee payment confirmed" },
                { dot: brand.gold, text: "Timetable updated" },
              ].map(({ dot, text }) => (
                <View key={text} style={S.activityRow}>
                  <View style={[S.activityDot, { backgroundColor: dot }]} />
                  <RNText style={S.activityText}>{text}</RNText>
                </View>
              ))}
            </View>

            {/* Bottom nav bar */}
            <View style={S.phoneNav}>
              {["home", "results", "payments", "courses", "more"].map((n) => (
                <View key={n} style={S.phoneNavItem}>
                  <View style={[S.phoneNavDot, { backgroundColor: n === "home" ? brand.blue : "rgba(255,255,255,0.2)" }]} />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Floating stat badges */}
      <View style={[S.floatingBadge, { top: 60, right: -20 }]}>
        <RNText style={S.floatingBadgeNum}>4.5★</RNText>
        <RNText style={S.floatingBadgeSub}>App Rating</RNText>
      </View>
      <View style={[S.floatingBadge, { bottom: 100, left: -24 }]}>
        <RNText style={S.floatingBadgeNum}>48h</RNText>
        <RNText style={S.floatingBadgeSub}>Go-live time</RNText>
      </View>
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function LandingPage() {
  usePremiumFonts();

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [openFaq,       setOpenFaq]       = useState<number | null>(null);
  const [activePersona, setActivePersona] = useState(0);
  const [billing,       setBilling]       = useState<"monthly" | "yearly">("monthly");

  const isNarrow = width < 768;
  const isWide   = width >= 1100;

  // ── Derived colors ───────────────────────────────────
  const bg   = isDark ? "#03071a" : "#f8f9ff";
  const bg2  = isDark ? "#060b1e" : "#f0f2ff";
  const card = isDark ? "rgba(11,22,40,0.80)"  : "rgba(255,255,255,0.85)";
  const glassStyle = {
    backgroundColor:       card,
    backdropFilter:        "blur(20px)",
    WebkitBackdropFilter:  "blur(20px)",
    boxShadow:             isDark
      ? "0 4px 24px rgba(0,0,0,0.30)"
      : "0 4px 24px rgba(45,108,255,0.08)",
  } as any;
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)";

  // ── Heading font helper ───────────────────────────────
  const headFont = (size: number, weight = "700", color = colors.text.primary) => ({
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    fontSize:   size,
    fontWeight: weight as any,
    color,
    letterSpacing: -0.4,
    lineHeight:    size * 1.1,
  });

  const bodyFont = (size: number, clr = colors.text.secondary) => ({
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize:   size,
    color:      clr,
    lineHeight: size * 1.65,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ══════════════════════════════════════════════════
          NAV — Floating Glassmorphic
      ══════════════════════════════════════════════════ */}
      <View style={[S.nav, {
        ...glassStyle,
        borderBottomWidth: 1,
        borderBottomColor: cardBorder,
      }]}>
        <View style={[S.navInner, isNarrow && { paddingHorizontal: spacing[4] }]}>
          {/* Logo */}
          <TouchableOpacity style={layout.row} activeOpacity={0.8}>
            <View style={S.logoMark}>
              <RNText style={{ fontWeight: "900", fontSize: 15, color: "#fff", fontFamily: '"Space Grotesk", sans-serif' }}>G</RNText>
            </View>
            <RNText style={{ ...headFont(20, "700", colors.text.primary), marginLeft: 10 }}>GMIS</RNText>
          </TouchableOpacity>

          {/* Desktop links */}
          {!isNarrow && (
            <View style={[layout.row, { gap: spacing[7] }]}>
              {["Features", "Pricing", "How it works"].map((link) => (
                <TouchableOpacity key={link} activeOpacity={0.7}>
                  <RNText style={bodyFont(14, colors.text.secondary)}>{link}</RNText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* CTAs */}
          <View style={[layout.row, { gap: spacing[3] }]}>
            {!isNarrow && (
              <Button label="Find your school" variant="ghost" size="sm" onPress={() => router.push("/find-school")} />
            )}
            <Button label={isNarrow ? "Get started" : "Register institution →"} variant="primary" size="sm" onPress={() => router.push("/register")} />
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          HERO — Split layout with phone mockup
      ══════════════════════════════════════════════════ */}
      <View style={[S.heroSection, { backgroundColor: isDark ? "#03071a" : "#06061a" }]}>
        {/* Background orbs */}
        <View style={[S.orb, S.orbTopLeft]} />
        <View style={[S.orb, S.orbBottomRight]} />

        <View style={[S.heroInner, isNarrow && { flexDirection: "column", alignItems: "center" }]}>
          {/* Left: text */}
          <View style={[S.heroLeft, isNarrow && { alignItems: "center", maxWidth: "100%" as any }]}>
            {/* Live badge */}
            <View style={S.heroBadge}>
              <View style={S.heroBadgeDot} />
              <RNText style={{ fontSize: 11, color: "#93c5fd", fontWeight: "600", letterSpacing: 0.6, fontFamily: '"DM Sans", sans-serif' }}>
                Platform Live · gmis.app
              </RNText>
            </View>

            {/* Headline */}
            <RNText style={[headFont(isNarrow ? 34 : isWide ? 56 : 46, "700", "#f0f6ff"), {
              marginTop: spacing[4],
              textAlign: isNarrow ? "center" : "left",
              maxWidth: 580,
            }]}>
              The Campus OS{"\n"}for Africa's{"\n"}
              <RNText style={{ color: brand.blue }}>Universities</RNText>
            </RNText>

            {/* Sub */}
            <RNText style={[bodyFont(isNarrow ? 15 : 17, "rgba(148,163,184,0.9)"), {
              marginTop: spacing[5],
              maxWidth: 480,
              textAlign: isNarrow ? "center" : "left",
            }]}>
              Give every institution its own isolated portal — students, lecturers, admins and parents, all in one system.{"\n"}Live at{" "}
              <RNText style={{ color: "#60a5fa", fontFamily: '"DM Sans", sans-serif' }}>yourschool.gmis.app</RNText>
              {" "}in 48 hours.
            </RNText>

            {/* CTAs */}
            <View style={[layout.row, {
              gap: spacing[3],
              marginTop: spacing[8],
              flexWrap: "wrap",
              justifyContent: isNarrow ? "center" : "flex-start",
            }]}>
              <Button label="Find your school →" variant="primary" size="lg" onPress={() => router.push("/find-school")} />
              <Button label="Register institution" variant="secondary" size="lg" onPress={() => router.push("/register")} />
            </View>

            {/* Trust signals */}
            <View style={[layout.row, {
              gap: spacing[5],
              marginTop: spacing[6],
              flexWrap: "wrap",
              justifyContent: isNarrow ? "center" : "flex-start",
            }]}>
              {["Free for students", "Zero transaction fees", "Isolated per school"].map((t) => (
                <View key={t} style={[layout.row, { gap: spacing[2] }]}>
                  <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ade80", marginTop: 3 }} />
                  <RNText style={bodyFont(12, "rgba(148,163,184,0.75)")}>{t}</RNText>
                </View>
              ))}
            </View>
          </View>

          {/* Right: phone mockup — hidden on narrow */}
          {!isNarrow && (
            <View style={S.heroRight}>
              <PhoneMockup />
            </View>
          )}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════ */}
      <View style={[S.statsBar, {
        backgroundColor: isDark ? "#070d1f" : "#ffffff",
        borderTopWidth: 1, borderBottomWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(45,108,255,0.08)",
      }]}>
        {[
          { val: "5+",   lbl: "Institutions live" },
          { val: "2k+",  lbl: "Student accounts" },
          { val: "14",   lbl: "Core features" },
          { val: "48h",  lbl: "Time to go live" },
        ].map(({ val, lbl }, i, arr) => (
          <View key={lbl} style={[S.statItem, i < arr.length - 1 && {
            borderRightWidth: 1,
            borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          }]}>
            <RNText style={headFont(isNarrow ? 24 : 32, "700", colors.text.primary)}>{val}</RNText>
            <RNText style={bodyFont(13, colors.text.muted)}>{lbl}</RNText>
          </View>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════
          FEATURES — Bento Grid
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg2 }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              What's Inside
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Everything your campus needs
          </RNText>
          <RNText style={[bodyFont(16, colors.text.secondary), { textAlign: "center", maxWidth: 500, marginTop: spacing[3] }]}>
            14 student features, 9 admin tools, full lecturer and parent portals — all isolated per school.
          </RNText>
        </View>

        {/* Bento Grid */}
        <View style={[S.bentoWrapper, {
          display: isNarrow ? "flex" : "grid" as any,
          gridTemplateColumns: isWide ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
          flexDirection: "column",
          gap: spacing[4],
          maxWidth: 1160,
          alignSelf: "center",
          width: "100%" as any,
        } as any]}>
          {FEATURES.map(({ icon, title, desc, span, accent }) => {
            const spanStyle = (!isNarrow && span === 2) ? { gridColumn: "span 2" } : {};
            return (
              <View
                key={title}
                style={[S.bentoCard, spanStyle as any, {
                  borderColor: cardBorder,
                  ...(accent ? {
                    background: `linear-gradient(135deg, ${brand.blue}, ${brand.indigo})`,
                    backgroundImage: `linear-gradient(135deg, ${brand.blue}, ${brand.indigo})`,
                    backgroundColor: brand.blue,
                  } : glassStyle),
                } as any]}
              >
                <View style={[S.bentoIconBox, {
                  backgroundColor: accent ? "rgba(255,255,255,0.18)" : brand.blueAlpha10,
                }]}>
                  <Icon name={icon} size="lg" color={accent ? "#fff" : brand.blue} />
                </View>
                <RNText style={headFont(16, "600", accent ? "#fff" : colors.text.primary)}>
                  {title}
                </RNText>
                <RNText style={bodyFont(13, accent ? "rgba(255,255,255,0.80)" : colors.text.secondary)}>
                  {desc}
                </RNText>
              </View>
            );
          })}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          PERSONAS — Tabbed role cards
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              Who It's For
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Built for every campus role
          </RNText>
        </View>

        {/* Tabs */}
        <View style={[S.tabRow, { maxWidth: 640, alignSelf: "center", width: "100%" as any, marginBottom: spacing[8] }]}>
          {PERSONAS.map(({ role, color }, i) => (
            <TouchableOpacity
              key={role}
              onPress={() => setActivePersona(i)}
              activeOpacity={0.8}
              style={[S.tab, activePersona === i && {
                backgroundColor: color,
                borderColor:     color,
              }, activePersona !== i && {
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              }]}
            >
              <Icon name={PERSONAS[i].icon} size="sm" color={activePersona === i ? "#fff" : colors.text.secondary} />
              <RNText style={bodyFont(13, activePersona === i ? "#fff" : colors.text.secondary)}>
                {role}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active persona card */}
        {(() => {
          const { color, colorAlpha, headline, features, icon } = PERSONAS[activePersona];
          return (
            <View style={[S.personaCard, {
              ...glassStyle,
              borderWidth: 1,
              borderColor: cardBorder,
              borderRadius: radius["3xl"],
              maxWidth: 900,
              alignSelf: "center",
              width: "100%" as any,
            }]}>
              <View style={[layout.row, {
                gap: spacing[4],
                marginBottom: spacing[6],
                flexWrap: "wrap",
              }]}>
                <View style={[S.personaIconBox, { backgroundColor: colorAlpha }]}>
                  <Icon name={icon} size="xl" color={color} />
                </View>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <RNText style={headFont(22, "700", colors.text.primary)}>{PERSONAS[activePersona].role}</RNText>
                  <RNText style={bodyFont(15, colors.text.secondary)}>{headline}</RNText>
                </View>
              </View>

              <View style={{ flexDirection: isNarrow ? "column" : "row", flexWrap: "wrap", gap: spacing[3] }}>
                {features.map((f) => (
                  <View key={f} style={[S.featurePill, {
                    backgroundColor: colorAlpha,
                    borderColor: color + "33",
                    width: isNarrow ? "100%" as any : "47%" as any,
                  }]}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                    <RNText style={bodyFont(13, colors.text.primary)}>{f}</RNText>
                  </View>
                ))}
              </View>

              {/* Admin dashboard preview — shown when MacBook mockup is ready */}
              {activePersona === 2 && MACBOOK_MOCKUP_IMAGE && (
                <View style={S.macbookWrap}>
                  <Image
                    source={MACBOOK_MOCKUP_IMAGE}
                    style={S.macbookImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>
          );
        })()}
      </View>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS — Connected roadmap
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg2 }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              Getting Started
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Go live in 4 steps
          </RNText>
          <RNText style={[bodyFont(16, colors.text.secondary), { textAlign: "center", maxWidth: 460, marginTop: spacing[3] }]}>
            Your school can be live on GMIS in under 48 hours.
          </RNText>
        </View>

        <View style={{
          maxWidth: 1000, alignSelf: "center", width: "100%" as any,
        }}>
          {/* Connector row (desktop only) */}
          {!isNarrow && (
            <View style={[layout.row, { justifyContent: "center", marginBottom: -24, paddingHorizontal: spacing[12], zIndex: 0 }]}>
              <View style={[S.stepConnector, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(45,108,255,0.12)" }]} />
            </View>
          )}

          <View style={[isNarrow ? S.stepsCol : S.stepsRow]}>
            {STEPS.map(({ n, title, color, desc }, i) => (
              <View key={n} style={[S.stepCard, {
                ...glassStyle,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: radius["2xl"],
                flex: isNarrow ? undefined : 1,
                width: isNarrow ? "100%" as any : undefined,
                zIndex: 1,
              }]}>
                <View style={[S.stepNum, { backgroundColor: color + "20", borderColor: color + "40", borderWidth: 1 }]}>
                  <RNText style={headFont(20, "700", color)}>{n}</RNText>
                </View>
                <RNText style={headFont(15, "600", colors.text.primary)}>{title}</RNText>
                <RNText style={bodyFont(13, colors.text.secondary)}>{desc}</RNText>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          PRICING — Cards with billing toggle
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              Pricing
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Simple, transparent pricing
          </RNText>
          <RNText style={[bodyFont(16, colors.text.secondary), { textAlign: "center", maxWidth: 440, marginTop: spacing[3] }]}>
            Pay monthly or save 25% with an annual plan. Cancel anytime.
          </RNText>

          {/* Billing toggle */}
          <View style={[S.billingToggle, {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            marginTop: spacing[6],
          }]}>
            {(["monthly", "yearly"] as const).map((cycle) => (
              <TouchableOpacity
                key={cycle}
                onPress={() => setBilling(cycle)}
                activeOpacity={0.8}
                style={[S.billingBtn, billing === cycle && {
                  backgroundColor: brand.blue,
                  boxShadow: "0 2px 12px rgba(45,108,255,0.35)",
                } as any]}
              >
                <RNText style={bodyFont(13, billing === cycle ? "#fff" : colors.text.secondary)}>
                  {cycle === "monthly" ? "Monthly" : "Yearly  −25%"}
                </RNText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[S.pricingRow, { gap: spacing[5] }]}>
          {PLANS.map(({ name, monthly, yearly, cap, color, popular, features }) => {
            const price = billing === "yearly" ? yearly : monthly;
            return (
              <View key={name} style={[S.planCard, {
                flex: isNarrow ? undefined : 1,
                width: isNarrow ? "100%" as any : undefined,
                ...(popular ? {
                  backgroundImage: `linear-gradient(150deg, ${brand.blue}, ${brand.indigo})`,
                  backgroundColor: brand.blue,
                  boxShadow: "0 24px 48px rgba(45,108,255,0.35)",
                  transform: [{ scale: 1.02 }],
                } : {
                  ...glassStyle,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }),
              } as any]}>
                {popular && (
                  <View style={S.popularBadge}>
                    <RNText style={{ fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 1, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
                      Most Popular
                    </RNText>
                  </View>
                )}
                <RNText style={headFont(20, "600", popular ? "#fff" : colors.text.primary)}>{name}</RNText>
                <View style={[layout.row, { alignItems: "flex-end", gap: 4, marginTop: spacing[3] }]}>
                  <RNText style={headFont(36, "700", popular ? "#fff" : color)}>
                    ₦{(price / 1000).toFixed(0)}k
                  </RNText>
                  <RNText style={[bodyFont(13, popular ? "rgba(255,255,255,0.65)" : colors.text.muted), { paddingBottom: 4 }]}>
                    / mo{billing === "yearly" ? " · billed annually" : ""}
                  </RNText>
                </View>
                <RNText style={[bodyFont(12, popular ? "rgba(255,255,255,0.55)" : colors.text.muted), { marginBottom: spacing[5] }]}>
                  {cap}
                </RNText>
                {features.map((f) => (
                  <View key={f} style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: popular ? "rgba(255,255,255,0.2)" : brand.blueAlpha10, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="ui-check" size="xs" color={popular ? "#fff" : brand.blue} />
                    </View>
                    <RNText style={bodyFont(13, popular ? "rgba(255,255,255,0.85)" : colors.text.secondary)}>
                      {f}
                    </RNText>
                  </View>
                ))}
                <Button
                  label={popular ? "Get started →" : "Choose plan"}
                  variant={popular ? "secondary" : "primary"}
                  size="md"
                  full
                  onPress={() => router.push("/register")}
                  style={{ marginTop: spacing[5] }}
                />
              </View>
            );
          })}
        </View>
        <RNText style={[bodyFont(12, colors.text.muted), { textAlign: "center", marginTop: spacing[5] }]}>
          All plans include unlimited lecturers, unlimited admins, and 1 parent per student.
        </RNText>
      </View>

      {/* ══════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg2 }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              Testimonials
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Trusted by institutions
          </RNText>
        </View>

        <View style={[S.testimonialRow, { gap: spacing[5], maxWidth: 1100, alignSelf: "center", width: "100%" as any }]}>
          {TESTIMONIALS.map(({ quote, name, role, school }) => (
            <View key={name} style={[S.testimonialCard, {
              ...glassStyle,
              borderWidth: 1,
              borderColor: cardBorder,
              flex: isNarrow ? undefined : 1,
              width: isNarrow ? "100%" as any : undefined,
            }]}>
              {/* Quote mark */}
              <RNText style={headFont(56, "700", brand.blueAlpha20)}>❝</RNText>
              <RNText style={[bodyFont(14, colors.text.secondary), { marginTop: spacing[1], lineHeight: 24 }]}>
                {quote}
              </RNText>
              <View style={[S.testimonialAuthor, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                <View style={[S.testimonialAvatar, { backgroundColor: brand.blueAlpha15 }]}>
                  <RNText style={{ fontSize: 12, fontWeight: "700", color: brand.blue, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </RNText>
                </View>
                <View>
                  <RNText style={headFont(13, "600", colors.text.primary)}>{name}</RNText>
                  <RNText style={bodyFont(11, colors.text.muted)}>{role} · {school}</RNText>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════ */}
      <View style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <View style={S.sectionPill}>
            <RNText style={{ fontSize: 11, fontWeight: "700", color: brand.blue, letterSpacing: 1.2, textTransform: "uppercase" as any, fontFamily: '"DM Sans", sans-serif' }}>
              FAQ
            </RNText>
          </View>
          <RNText style={[headFont(isNarrow ? 28 : 40, "700", colors.text.primary), { textAlign: "center", marginTop: spacing[3] }]}>
            Frequently asked questions
          </RNText>
        </View>

        <View style={{ maxWidth: 720, alignSelf: "center", width: "100%" as any, gap: spacing[3] }}>
          {FAQ_ITEMS.map(([q, a], i) => {
            const open = openFaq === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setOpenFaq(open ? null : i)}
                activeOpacity={0.85}
                style={[S.faqItem, {
                  ...glassStyle,
                  borderWidth: 1,
                  borderColor: open ? brand.blueAlpha30 : cardBorder,
                  borderRadius: radius["2xl"],
                } as any]}
              >
                <View style={layout.rowBetween}>
                  <RNText style={[headFont(15, "600", colors.text.primary), { flex: 1, lineHeight: 24 }]}>
                    {q}
                  </RNText>
                  <View style={[S.faqChevron, {
                    backgroundColor: open ? brand.blueAlpha10 : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    transform: [{ rotate: open ? "45deg" : "0deg" }],
                  }]}>
                    <Icon name="ui-add" size="sm" color={open ? brand.blue : colors.text.muted} />
                  </View>
                </View>
                {open && (
                  <RNText style={[bodyFont(14, colors.text.secondary), {
                    marginTop: spacing[4],
                    paddingTop: spacing[4],
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    lineHeight: 24,
                  }]}>
                    {a}
                  </RNText>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          CTA — Dark gradient banner
      ══════════════════════════════════════════════════ */}
      <View style={[S.ctaBanner, {
        backgroundImage: `linear-gradient(135deg, #03071a 0%, #1a1060 50%, #03071a 100%)`,
        backgroundColor: "#03071a",
      } as any]}>
        <View style={[S.orb, { top: -80, left: "50%" as any, width: 400, height: 400, opacity: 0.15, backgroundColor: brand.blue }]} />
        <RNText style={[headFont(isNarrow ? 28 : 44, "700", "#f0f6ff"), { textAlign: "center", maxWidth: 600 }]}>
          Ready to transform{"\n"}your campus?
        </RNText>
        <RNText style={[bodyFont(16, "rgba(148,163,184,0.8)"), { textAlign: "center", maxWidth: 460, marginTop: spacing[4] }]}>
          Join the growing number of Nigerian institutions already running on GMIS. Setup is free to try.
        </RNText>
        <View style={[layout.row, { gap: spacing[4], marginTop: spacing[8], flexWrap: "wrap", justifyContent: "center" }]}>
          <Button label="Register your institution →" variant="primary" size="lg" onPress={() => router.push("/register")} />
          <Button label="Find your school" variant="secondary" size="lg" onPress={() => router.push("/find-school")} />
        </View>
      </View>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <View style={[S.footer, {
        backgroundColor: "#020509",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
      }]}>
        <View style={[S.footerInner, { maxWidth: 1160 }]}>
          {/* Brand */}
          <View style={S.footerBrand}>
            <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[4] }]}>
              <View style={S.logoMark}>
                <RNText style={{ fontWeight: "900", fontSize: 14, color: "#fff" }}>G</RNText>
              </View>
              <RNText style={headFont(20, "700", "#fff")}>GMIS</RNText>
            </View>
            <RNText style={bodyFont(13, "rgba(255,255,255,0.35)")}>
              GRASP Management Information System{"\n"}The future of academic operations{"\n"}for Nigerian institutions.
            </RNText>
          </View>

          {/* Links */}
          <View style={S.footerLinks}>
            {[
              { heading: "Product",       links: ["Features", "Pricing", "How it works", "Find your school"] },
              { heading: "Institutions",  links: ["Register", "Documentation", "Support", "SLA"] },
              { heading: "Company",       links: ["About DAMS Tech", "Contact", "Privacy Policy", "Terms of Service"] },
            ].map(({ heading, links }) => (
              <View key={heading} style={{ minWidth: 130 }}>
                <RNText style={[bodyFont(11, "rgba(255,255,255,0.25)"), {
                  textTransform: "uppercase" as any,
                  letterSpacing: 1.2,
                  fontWeight: "700",
                  marginBottom: spacing[4],
                }]}>
                  {heading}
                </RNText>
                {links.map((link) => (
                  <TouchableOpacity key={link} style={{ marginBottom: spacing[3] }} activeOpacity={0.7}>
                    <RNText style={bodyFont(13, "rgba(255,255,255,0.45)")}>{link}</RNText>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[S.footerBottom, {
          borderTopColor: "rgba(255,255,255,0.04)",
          maxWidth: 1160,
        }]}>
          <RNText style={bodyFont(12, "rgba(255,255,255,0.25)")}>
            © {new Date().getFullYear()} DAMS Technologies. All rights reserved.
          </RNText>
          <RNText style={bodyFont(12, "rgba(255,255,255,0.25)")}>
            Built in Cotonou, Benin Republic 🇧🇯
          </RNText>
        </View>
      </View>

    </ScrollView>
  );
}

// ── StyleSheet ─────────────────────────────────────────────
const S = StyleSheet.create({
  // ── Nav
  nav: {
    position:          "sticky" as any,
    top:               0,
    zIndex:            100,
    paddingVertical:   spacing[4],
  },
  navInner: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    maxWidth:          1200,
    marginHorizontal:  "auto" as any,
    paddingHorizontal: spacing[6],
    width:             "100%" as any,
  },
  logoMark: {
    width:           36,    height:         36,
    borderRadius:    radius.lg,
    backgroundColor: brand.blue,
    alignItems:      "center", justifyContent: "center",
  },

  // ── Hero
  heroSection: {
    paddingTop:        120,
    paddingBottom:     100,
    paddingHorizontal: spacing[6],
    overflow:          "hidden",
  },
  heroInner: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    maxWidth:         1160,
    marginHorizontal: "auto" as any,
    width:            "100%" as any,
    gap:              spacing[10],
  },
  heroLeft: {
    flex: 1, maxWidth: 600,
  },
  heroRight: {
    flex: 1, alignItems: "flex-end",
  },
  heroBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[2],
    alignSelf:         "flex-start",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    backgroundColor:   "rgba(45,108,255,0.12)",
    borderWidth:       1,
    borderColor:       "rgba(45,108,255,0.25)",
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80",
  },
  // Gradient orbs
  orb: {
    position:      "absolute",
    borderRadius:  9999,
    filter:        "blur(80px)" as any,
    opacity:       0.25,
  },
  orbTopLeft: {
    top: -120, left: -80,
    width: 500, height: 500,
    backgroundColor: brand.indigo,
  },
  orbBottomRight: {
    bottom: -100, right: -80,
    width: 400, height: 400,
    backgroundColor: brand.blue,
  },

  // ── Phone Mockup
  mockupOuter: {
    width:    260,
    height:   520,
    position: "relative",
    alignItems: "center",
  },
  mockupImage: {
    width:  260,
    height: 520,
  },
  mockupGlow: {
    position:        "absolute",
    width:           240,
    height:          240,
    borderRadius:    120,
    backgroundColor: brand.blue,
    top:             120,
    filter:          "blur(60px)" as any,
    opacity:         0.30,
  },
  phoneFrame: {
    width:           240,
    height:          490,
    borderRadius:    48,
    backgroundColor: "#0d1117",
    padding:         8,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 24 },
    shadowOpacity:   0.60,
    shadowRadius:    48,
    elevation:       24,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.1)",
  },
  phoneNotch: {
    width: 80, height: 24,
    borderRadius: 12,
    backgroundColor: "#0d1117",
    alignSelf: "center",
    position: "absolute",
    top: 0, zIndex: 10,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 42,
    backgroundColor: "#06091a",
    overflow: "hidden",
    padding: spacing[4],
    paddingTop: spacing[8],
  },
  appHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: spacing[4],
  },
  appHeaderSub:  { fontSize: 10, color: "rgba(148,163,184,0.7)", fontFamily: "system-ui" },
  appHeaderName: { fontSize: 14, fontWeight: "700", color: "#e8eeff", fontFamily: "system-ui" },
  appAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: brand.blue, alignItems: "center", justifyContent: "center",
  },
  gpaCard: {
    backgroundColor: "rgba(45,108,255,0.15)",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: "rgba(45,108,255,0.25)",
  },
  gpaLabel: { fontSize: 9, color: "rgba(148,163,184,0.7)", textTransform: "uppercase" as any, letterSpacing: 0.8, fontFamily: "system-ui" },
  gpaValue: { fontSize: 28, fontWeight: "700", color: brand.blue, fontFamily: "system-ui" },
  gpaTag:   { fontSize: 9, color: "#4ade80", fontFamily: "system-ui" },
  statChip: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10, padding: 8, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statChipVal: { fontSize: 13, fontWeight: "700", color: "#e8eeff", fontFamily: "system-ui" },
  statChipLbl: { fontSize: 8, color: "rgba(148,163,184,0.6)", marginTop: 2, fontFamily: "system-ui" },
  activityTitle: { fontSize: 10, fontWeight: "700", color: "rgba(148,163,184,0.5)", textTransform: "uppercase" as any, letterSpacing: 0.8, marginBottom: 8, fontFamily: "system-ui" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
  activityText: { fontSize: 10, color: "rgba(232,238,255,0.7)", fontFamily: "system-ui" },
  phoneNav: {
    flexDirection: "row", justifyContent: "space-around",
    marginTop: "auto" as any, paddingTop: spacing[3],
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  phoneNavItem: { alignItems: "center", paddingVertical: 4 },
  phoneNavDot:  { width: 4, height: 4, borderRadius: 2 },
  // Floating badges
  floatingBadge: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)" as any,
    WebkitBackdropFilter: "blur(16px)" as any,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    alignItems: "center",
  } as any,
  floatingBadgeNum: { fontSize: 14, fontWeight: "700", color: "#fff", fontFamily: "system-ui" },
  floatingBadgeSub: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" },

  // ── Stats bar
  statsBar: {
    flexDirection: "row",
    paddingVertical: spacing[6],
  },
  statItem: {
    flex: 1, alignItems: "center", paddingHorizontal: spacing[4], gap: spacing[1],
  },

  // ── Sections
  section: {
    paddingVertical:   spacing[24],
    paddingHorizontal: spacing[6],
  },
  sectionHead: {
    alignItems:   "center",
    marginBottom: spacing[12],
  },
  sectionPill: {
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    backgroundColor:   brand.blueAlpha10,
    borderWidth:       1,
    borderColor:       brand.blueAlpha20,
  },

  // ── Bento grid
  bentoWrapper: {},
  bentoCard: {
    padding:      spacing[6],
    borderRadius: radius["2xl"],
    borderWidth:  1,
    gap:          spacing[3],
  },
  bentoIconBox: {
    width:        44, height: 44,
    borderRadius: radius.md,
    alignItems:   "center", justifyContent: "center",
    marginBottom: spacing[1],
  },

  // ── Personas
  tabRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           spacing[2],
    justifyContent: "center",
  },
  tab: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:   radius["2xl"],
    borderWidth:    1,
    cursor:         "pointer" as any,
  },
  personaCard: {
    padding: spacing[8],
  },
  personaIconBox: {
    width:         64, height: 64,
    borderRadius:  radius.xl,
    alignItems:    "center", justifyContent: "center",
    flexShrink:    0,
  },
  featurePill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.xl,
    borderWidth:       1,
  },
  macbookWrap: {
    marginTop:    spacing[8],
    borderRadius: radius["2xl"],
    overflow:     "hidden",
    width:        "100%" as any,
    alignItems:   "center",
  },
  macbookImage: {
    width:  "100%" as any,
    height: 400,
  },

  // ── Steps
  stepsRow: {
    flexDirection: "row",
    gap:           spacing[4],
  },
  stepsCol: {
    flexDirection: "column",
    gap:           spacing[4],
  },
  stepCard: {
    padding: spacing[6],
    gap:     spacing[3],
  },
  stepNum: {
    width:         48, height: 48,
    borderRadius:  radius.full,
    alignItems:    "center", justifyContent: "center",
    marginBottom:  spacing[2],
  },
  stepConnector: {
    flex: 1, height: 2, borderRadius: 1,
  },

  // ── Pricing
  pricingRow: {
    flexDirection:    "row",
    flexWrap:         "wrap",
    maxWidth:         1000,
    alignSelf:        "center",
    width:            "100%" as any,
    justifyContent:   "center",
  },
  planCard: {
    padding:      spacing[7],
    borderRadius: radius["3xl"],
    minWidth:     260,
  },
  popularBadge: {
    alignSelf:         "flex-start",
    backgroundColor:   "rgba(255,255,255,0.18)",
    borderRadius:      radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
    marginBottom:      spacing[4],
  },
  billingToggle: {
    flexDirection:     "row",
    borderRadius:      radius.full,
    padding:           spacing[1],
  },
  billingBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
    borderRadius:      radius.full,
    cursor:            "pointer" as any,
  },

  // ── Testimonials
  testimonialRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
  },
  testimonialCard: {
    padding:      spacing[7],
    borderRadius: radius["3xl"],
    minWidth:     280,
  },
  testimonialAuthor: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            spacing[3],
    marginTop:      spacing[5],
    paddingTop:     spacing[5],
    borderTopWidth: 1,
  },
  testimonialAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },

  // ── FAQ
  faqItem: {
    padding:      spacing[5],
  },
  faqChevron: {
    width:          32, height: 32,
    borderRadius:   radius.full,
    alignItems:     "center", justifyContent: "center",
    flexShrink:     0, marginLeft: spacing[3],
  },

  // ── CTA
  ctaBanner: {
    alignItems:        "center",
    paddingVertical:   spacing[24],
    paddingHorizontal: spacing[6],
    overflow:          "hidden",
  },

  // ── Footer
  footer: { paddingTop: spacing[16] },
  footerInner: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    gap:               spacing[12],
    alignSelf:         "center",
    width:             "100%" as any,
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[12],
  },
  footerBrand: { minWidth: 220, flex: 1 },
  footerLinks: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           spacing[10],
  },
  footerBottom: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    flexWrap:          "wrap",
    gap:               spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[5],
    borderTopWidth:    1,
    alignSelf:         "center",
    width:             "100%" as any,
  },
});
