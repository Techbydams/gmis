// ============================================================
// GMIS — Platform Landing Page v3  (GSAP Interactive 3D)
// Route: /(landing)  — only at gmis.app (no subdomain)
//
// Requires: npx expo install gsap
//
// Animations: hero entrance · scroll reveals · 3D card tilt
//             floating phone · orb parallax · stat counters
//             step connector draw · CTA glow pulse
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Platform, Text as RNText, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Text, Button } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Assets ────────────────────────────────────────────────
const LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

// ── Mockup images (uncomment when generated) ──────────────
const PHONE_MOCKUP_IMAGE: any = null;
// const PHONE_MOCKUP_IMAGE = require("../../assets/mockups/phone-dashboard.png");

// ── Google Fonts (web only) ───────────────────────────────
function usePremiumFonts() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = "gmis-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id   = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ── GSAP lazy-loader (web only, avoids SSR crash) ─────────
async function loadGSAP() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

// ── Data ──────────────────────────────────────────────────
const FEATURES = [
  { id: "f0",  icon: "nav-ai"        as IconName, title: "AI Academic Assistant", accent: true,  span: 2,
    desc: "Claude-powered 24/7 help — explains concepts, solves exam problems, reviews drafts." },
  { id: "f1",  icon: "nav-results"   as IconName, title: "Live Results",
    desc: "Grades the moment they drop. GPA, CGPA, honour class computed instantly." },
  { id: "f2",  icon: "nav-payments"  as IconName, title: "Zero-Cut Fees",
    desc: "100% of every payment goes directly to the institution. No GMIS deductions." },
  { id: "f3",  icon: "nav-attendance"as IconName, title: "QR Attendance",
    desc: "Anti-cheat QR with device fingerprint + GPS. 15-minute countdown window." },
  { id: "f4",  icon: "nav-voting"    as IconName, title: "SUG Elections",  accent: true, span: 2,
    desc: "Tamper-proof digital voting. Nominations, campaigns, and live results — fully transparent." },
  { id: "f5",  icon: "nav-chat"      as IconName, title: "Campus Chat",
    desc: "WhatsApp-style course groups and DMs between students and lecturers." },
  { id: "f6",  icon: "nav-timetable" as IconName, title: "Smart Timetable",
    desc: "NOW / UP NEXT live status. Auto-updated every 30 seconds." },
  { id: "f7",  icon: "nav-clearance" as IconName, title: "Digital Clearance",
    desc: "Library, hostel, lab and fee clearance. No paper queues ever again." },
  { id: "f8",  icon: "nav-gpa"       as IconName, title: "GPA Simulator",
    desc: "Try different scores before results drop. Plan your semester strategy." },
  { id: "f9",  icon: "nav-social"    as IconName, title: "Campus Social",  span: 2,
    desc: "Instagram-style feed keeps the campus community connected on one platform." },
  { id: "f10", icon: "nav-courses"   as IconName, title: "Course Registration",
    desc: "Online course registration each semester. Admin controls the window." },
  { id: "f11", icon: "nav-calendar"  as IconName, title: "Academic Calendar",
    desc: "School-wide events, deadlines and sessions — synced for everyone." },
];

const PERSONAS = [
  {
    role: "Students",       icon: "user-student"  as IconName, color: brand.blue,   colorAlpha: brand.blueAlpha15,
    headline: "Your entire campus life, in one app.",
    features: ["Check results the moment they drop","Pay fees securely via Paystack","Register courses & track progress","Get AI academic help 24/7","Chat with classmates in course groups","Vote in SUG elections from your phone"],
  },
  {
    role: "Lecturers",      icon: "user-lecturer" as IconName, color: brand.emerald, colorAlpha: brand.emeraldAlpha15,
    headline: "Grading, attendance, and more — simplified.",
    features: ["Upload CA and exam scores by matric","Generate QR codes for live attendance","View all enrolled students per course","Lock submitted results for accuracy","Monitor handout payment status","View timetable and venue info"],
  },
  {
    role: "Administrators", icon: "user-admin"    as IconName, color: brand.gold,    colorAlpha: brand.goldAlpha15,
    headline: "Full academic control from one dashboard.",
    features: ["Full setup: faculties, departments, courses","Approve and manage student registrations","Configure fee structure per level/session","Release results after lecturer submission","Generate and manage student ID cards","Run SUG elections and manage candidates"],
  },
  {
    role: "Parents",        icon: "user-parent"   as IconName, color: brand.purple,  colorAlpha: brand.purpleAlpha15,
    headline: "Stay connected to your ward's journey.",
    features: ["Monitor results in real time","View fee payment history","Track attendance across all courses","Receive automatic alerts on key events","Access academic calendar and exam dates","Link multiple wards to one account"],
  },
];

const STEPS = [
  { n: "01", title: "Register",          color: brand.blue,
    desc: "Submit your school's details. We review and approve within 48 hours." },
  { n: "02", title: "Configure portal",  color: brand.indigo,
    desc: "Set up faculties, departments, and courses. Your isolated DB is ready instantly." },
  { n: "03", title: "Onboard students",  color: brand.purple,
    desc: "Self-register or bulk-import via CSV. Approve each registration in one click." },
  { n: "04", title: "Go live",           color: brand.emerald,
    desc: "Portal is live at yourschool.gmis.app. Students log in with matric or email." },
];

const TESTIMONIALS = [
  { quote: "GMIS transformed how we manage student records. What took our registry days now takes minutes. The isolated database architecture was the deciding factor.",
    name: "Dr. Seun Adeyemi", role: "ICT Director", school: "Federal Polytechnic Ede" },
  { quote: "Our students love checking results and paying fees from their phones. Even parents praise the system. The QR attendance alone ended proxy attendance completely.",
    name: "Mrs. Folake Okonkwo", role: "Deputy Registrar", school: "Lagos State University of Education" },
  { quote: "We onboarded 1,400 students in under a week using the CSV import. The admin panel is clean and powerful. Best decision we made this academic session.",
    name: "Prof. Emmanuel Eze", role: "Director of Academic Planning", school: "Bells University of Technology" },
];

const FAQ_ITEMS = [
  ["How does the subdomain system work?",
   "Each institution gets their own URL — e.g. yourschool.gmis.app — configured automatically via wildcard DNS when your institution is approved. No extra technical setup on your end."],
  ["Does GMIS take a cut from student payments?",
   "No. GMIS takes zero cut from student transactions. Institutions link their own Paystack account and all fee payments go 100% directly to the institution."],
  ["How is each institution's data isolated?",
   "Every institution gets its own dedicated Supabase database. There is zero shared data between institutions — authentication, files, and records are fully separate."],
  ["Can students self-register?",
   "Yes. Students register on their institution's portal using their student ID. The admin reviews and approves each account before portal access is granted."],
  ["Is there a mobile app?",
   "Yes. GMIS is a cross-platform Expo app. Students and staff can use the native iOS or Android app, or access the web portal from any browser."],
  ["Can we migrate our existing student data?",
   "Yes. We provide CSV import tools for bulk student, lecturer, and course data. Our onboarding team assists with data migration during setup."],
  ["What happens if an institution misses a payment?",
   "The system auto-detects overdue subscriptions and locks the portal. Only the platform admin can manually unlock it after renewal."],
] as const;

// ── BentoCard — with 3D hover tilt ───────────────────────
function BentoCard({
  id, icon, title, desc, accent, span, isDark, glassStyle, cardBorder, colors,
}: any) {
  const cardRef = useRef<any>(null);

  const onMouseMove = useCallback(async (e: any) => {
    if (Platform.OS !== "web" || !cardRef.current) return;
    const { default: gsap } = await import("gsap");
    const rect = cardRef.current.getBoundingClientRect?.();
    if (!rect) return;
    const x = ((e.nativeEvent.clientX - rect.left) / rect.width  - 0.5) * 16;
    const y = ((e.nativeEvent.clientY - rect.top)  / rect.height - 0.5) * -10;
    gsap.to(cardRef.current, {
      rotationY: x, rotationX: y, transformPerspective: 900,
      duration: 0.25, ease: "power2.out",
    });
  }, []);

  const onMouseLeave = useCallback(async () => {
    if (Platform.OS !== "web" || !cardRef.current) return;
    const { default: gsap } = await import("gsap");
    gsap.to(cardRef.current, {
      rotationY: 0, rotationX: 0,
      duration: 0.7, ease: "elastic.out(1, 0.4)",
    });
  }, []);

  return (
    <View
      ref={cardRef}
      nativeID={id}
      {...{ onMouseMove, onMouseLeave } as any}
      style={[S.bentoCard,
        span === 2 && S.bentoCardDouble,
        { borderColor: cardBorder },
        accent
          ? { background:`linear-gradient(135deg,${brand.blue},${brand.indigo})`,
              backgroundImage:`linear-gradient(135deg,${brand.blue},${brand.indigo})`,
              backgroundColor: brand.blue } as any
          : { ...glassStyle },
      ] as any}
    >
      <View style={[S.bentoIcon, { backgroundColor: accent ? "rgba(255,255,255,0.18)" : brand.blueAlpha10 }]}>
        <Icon name={icon} size="lg" color={accent ? "#fff" : brand.blue} />
      </View>
      <RNText style={{ fontFamily: '"Space Grotesk",system-ui', fontSize: 16, fontWeight: "600" as any, color: accent ? "#fff" : colors.text.primary, marginTop: spacing[3] }}>
        {title}
      </RNText>
      <RNText style={{ fontFamily: '"DM Sans",system-ui', fontSize: 13, color: accent ? "rgba(255,255,255,0.78)" : colors.text.secondary, lineHeight: 20, marginTop: spacing[2] }}>
        {desc}
      </RNText>
    </View>
  );
}

// ── Phone mockup ──────────────────────────────────────────
function PhoneMockup() {
  return (
    <View nativeID="phone-wrap" style={S.phoneWrap}>
      <View style={S.phoneGlow} />
      {PHONE_MOCKUP_IMAGE ? (
        <Image source={PHONE_MOCKUP_IMAGE} style={{ width: 260, height: 520 }} resizeMode="contain" />
      ) : (
        <View style={S.phoneFrame}>
          <View style={S.phonePill} />
          <View style={S.phoneScreen}>
            <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <View>
                <RNText style={{ fontSize:10, color:"rgba(148,163,184,0.6)", fontFamily:"system-ui" }}>Good morning 👋</RNText>
                <RNText style={{ fontSize:14, fontWeight:"700", color:"#e8eeff", fontFamily:"system-ui" }}>Amina Okafor</RNText>
              </View>
              <View style={{ width:32, height:32, borderRadius:16, backgroundColor:brand.blue, alignItems:"center", justifyContent:"center" }}>
                <RNText style={{ color:"#fff", fontWeight:"700", fontSize:12 }}>AO</RNText>
              </View>
            </View>
            <View style={S.gpaCard}>
              <RNText style={{ fontSize:10, color:"rgba(148,163,184,0.7)", fontFamily:"system-ui" }}>Current CGPA</RNText>
              <RNText style={{ fontSize:28, fontWeight:"800", color:"#e8eeff", fontFamily:'"Space Grotesk",system-ui', lineHeight:34 }}>4.21</RNText>
              <View style={{ flexDirection:"row", alignItems:"center", gap:4, marginTop:2 }}>
                <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#4ade80" }} />
                <RNText style={{ fontSize:10, color:"rgba(148,163,184,0.8)", fontFamily:"system-ui" }}>Second Class Upper</RNText>
              </View>
            </View>
            <View style={{ flexDirection:"row", gap:6, marginTop:10 }}>
              {[["6","Courses"],["87%","Attend."],["₦0","Owing"]].map(([v,l]) => (
                <View key={l} style={S.statChip}>
                  <RNText style={{ fontSize:13, fontWeight:"700", color:"#e8eeff", fontFamily:"system-ui" }}>{v}</RNText>
                  <RNText style={{ fontSize:9, color:"rgba(148,163,184,0.6)", fontFamily:"system-ui" }}>{l}</RNText>
                </View>
              ))}
            </View>
            <View style={{ marginTop:12 }}>
              <RNText style={{ fontSize:11, fontWeight:"600", color:"rgba(148,163,184,0.5)", textTransform:"uppercase", letterSpacing:0.8, fontFamily:"system-ui" }}>Recent Activity</RNText>
              {[["#4ade80","ENG 301 result released"],["#60a5fa","Fee payment confirmed"],[brand.gold,"Timetable updated"]].map(([dot,text]) => (
                <View key={text as string} style={{ flexDirection:"row", alignItems:"center", gap:8, marginTop:8 }}>
                  <View style={{ width:6, height:6, borderRadius:3, backgroundColor:dot as string }} />
                  <RNText style={{ fontSize:11, color:"rgba(148,163,184,0.75)", fontFamily:"system-ui" }}>{text as string}</RNText>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
      {/* Floating stat badges */}
      <View style={[S.floatBadge, { top:60, right:-28 }]}>
        <RNText style={{ fontSize:14, fontWeight:"800", color:"#e8eeff", fontFamily:'"Space Grotesk",system-ui' }}>4.8★</RNText>
        <RNText style={{ fontSize:10, color:"rgba(148,163,184,0.7)", fontFamily:"system-ui" }}>App Rating</RNText>
      </View>
      <View style={[S.floatBadge, { bottom:110, left:-32 }]}>
        <RNText style={{ fontSize:14, fontWeight:"800", color:"#e8eeff", fontFamily:'"Space Grotesk",system-ui' }}>48h</RNText>
        <RNText style={{ fontSize:10, color:"rgba(148,163,184,0.7)", fontFamily:"system-ui" }}>Go-live time</RNText>
      </View>
    </View>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function LandingPage() {
  usePremiumFonts();

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [openFaq,       setOpenFaq]       = useState<number | null>(null);
  const [activePersona, setActivePersona] = useState(0);

  const isNarrow = width < 768;
  const isWide   = width >= 1100;

  // Refs for GSAP
  const scrollRef = useRef<any>(null);

  // Derived colors
  const bg        = isDark ? "#030919" : "#f8f9ff";
  const bg2       = isDark ? "#060c1e" : "#f0f2ff";
  const card      = isDark ? "rgba(10,20,45,0.80)"  : "rgba(255,255,255,0.88)";
  const glassStyle = {
    backgroundColor:      card,
    backdropFilter:       "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow:            isDark ? "0 4px 32px rgba(0,0,0,0.35)" : "0 4px 24px rgba(45,108,255,0.07)",
  } as any;
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)";

  const headFont = (size: number, weight = "700", color: string = colors.text.primary) => ({
    fontFamily: '"Space Grotesk",system-ui,sans-serif',
    fontSize: size, fontWeight: weight as any,
    color, letterSpacing: -0.5, lineHeight: size * 1.08,
  });
  const bodyFont = (size: number, clr: string = colors.text.secondary) => ({
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: size, color: clr, lineHeight: size * 1.65,
  });

  // ── GSAP animations ─────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let ctx: any = null;

    loadGSAP().then((g) => {
      if (!g) return;
      const { gsap, ScrollTrigger } = g;

      // Configure ScrollTrigger to use the ScrollView container
      if (scrollRef.current) {
        ScrollTrigger.defaults({ scroller: scrollRef.current });
      }

      ctx = gsap.context(() => {
        const $ = (sel: string) => document.getElementById(sel);
        const $$ = (sel: string) => Array.from(document.querySelectorAll(sel));

        // ── 1. Nav entrance ──────────────────────────────
        gsap.from("#gmis-nav", {
          y: -70, opacity: 0, duration: 0.7,
          ease: "expo.out", delay: 0.1,
        });

        // ── 2. Hero entrance sequence ────────────────────
        const heroTl = gsap.timeline({
          defaults: { ease: "expo.out" },
          delay: 0.3,
        });

        heroTl
          .from("#hero-badge",   { scale: 0.7, opacity: 0, duration: 0.5, ease: "back.out(2)" })
          .from(["#hl-0","#hl-1","#hl-2"], { yPercent: 105, opacity: 0, duration: 0.85, stagger: 0.09 }, "<0.2")
          .from("#hero-sub",     { y: 28, opacity: 0, duration: 0.7 }, "<0.35")
          .from($$(".hero-cta"), { y: 18, opacity: 0, duration: 0.5, stagger: 0.1 }, "<0.25")
          .from($$(".hero-trust"),{ y: 12, opacity: 0, duration: 0.45, stagger: 0.07 }, "<0.2")
          .from("#phone-wrap",   { scale: 0.88, y: 48, opacity: 0, duration: 1.1, ease: "expo.out" }, "<0.15");

        // ── 3. Phone float (continuous) ──────────────────
        gsap.to("#phone-wrap", {
          y: -18, duration: 3.2, ease: "sine.inOut",
          repeat: -1, yoyo: true,
        });

        // ── 4. Orb slow drift ────────────────────────────
        gsap.to("#orb1", { x: 40, y: -30, duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true });
        gsap.to("#orb2", { x: -30, y: 25, duration: 9, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2 });
        gsap.to("#orb3", { x: 20, y: 40, duration: 11, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 4 });

        // ── 5. Stats counter on scroll ───────────────────
        [
          { id: "sv-0", val: 10,   suffix: "+" },
          { id: "sv-1", val: 5000, suffix: "+" },
          { id: "sv-2", val: 14,   suffix: ""  },
          { id: "sv-3", val: 48,   suffix: "h" },
        ].forEach(({ id, val, suffix }) => {
          const el = $(id);
          if (!el) return;
          const proxy = { v: 0 };
          gsap.to(proxy, {
            v: val, duration: 2.2, ease: "power2.out",
            onUpdate() { el.textContent = Math.round(proxy.v).toLocaleString() + suffix; },
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });

        // ── 6. Bento cards stagger reveal ────────────────
        gsap.from($$(".bento-card"), {
          opacity: 0, y: 44, scale: 0.97,
          duration: 0.7, stagger: { amount: 0.9, from: "start" },
          ease: "power3.out",
          scrollTrigger: {
            trigger: "#bento-section",
            start: "top 78%", once: true,
          },
        });

        // ── 7. Step cards sequential reveal ──────────────
        gsap.from($$(".step-card"), {
          opacity: 0, y: 40,
          duration: 0.6, stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: "#steps-section",
            start: "top 80%", once: true,
          },
        });
        // Connector line draw
        gsap.fromTo("#step-connector",
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 1.2, ease: "power2.inOut",
            scrollTrigger: { trigger: "#steps-section", start: "top 75%", once: true } }
        );

        // ── 8. Testimonials reveal ───────────────────────
        gsap.from($$(".testi-card"), {
          opacity: 0, y: 36,
          duration: 0.65, stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: { trigger: "#testi-section", start: "top 82%", once: true },
        });

        // ── 9. Contact section ───────────────────────────
        gsap.from($$(".contact-reveal"), {
          opacity: 0, y: 30, duration: 0.7, stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: "#contact-section", start: "top 80%", once: true },
        });
        // CTA glow pulse
        gsap.to("#contact-cta-btn", {
          boxShadow: "0 0 50px rgba(45,108,255,0.55)",
          duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true,
          delay: 1.5,
        });

        // ── 10. FAQ items stagger ────────────────────────
        gsap.from($$(".faq-item"), {
          opacity: 0, x: -24, duration: 0.5, stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: "#faq-section", start: "top 82%", once: true },
        });

        // ── 11. CTA banner ───────────────────────────────
        gsap.from("#cta-headline", {
          scale: 0.94, opacity: 0, duration: 0.8, ease: "expo.out",
          scrollTrigger: { trigger: "#cta-banner", start: "top 80%", once: true },
        });

      });
    });

    return () => {
      ctx?.revert?.();
      loadGSAP().then(g => g?.ScrollTrigger?.getAll().forEach((t: any) => t.kill()));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persona switch with animation ───────────────────────
  const switchPersona = useCallback(async (i: number) => {
    if (i === activePersona) return;
    if (Platform.OS === "web") {
      const { default: gsap } = await import("gsap");
      await gsap.to("#persona-content", { opacity: 0, y: -8, duration: 0.18, ease: "power2.in" });
      setActivePersona(i);
      gsap.fromTo("#persona-content",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }
      );
    } else {
      setActivePersona(i);
    }
  }, [activePersona]);

  // ── Section pill ─────────────────────────────────────────
  const Pill = ({ label }: { label: string }) => (
    <View style={S.sectionPill}>
      <RNText style={{ fontSize:11, fontWeight:"700", color:brand.blue, letterSpacing:1.4,
        textTransform:"uppercase" as any, fontFamily:'"DM Sans",sans-serif' }}>
        {label}
      </RNText>
    </View>
  );

  const LOGO_IMG = isDark ? LOGO_DARK : LOGO_LIGHT;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ════════════════ NAV ═══════════════════════════ */}
      <View nativeID="gmis-nav" style={[S.nav, {
        ...glassStyle,
        borderBottomWidth: 1,
        borderBottomColor: cardBorder,
      }]}>
        <View style={[S.navInner, isNarrow && { paddingHorizontal: spacing[4] }]}>
          {/* Logo */}
          <TouchableOpacity style={[layout.row, { gap: spacing[2], alignItems: "center" }]} activeOpacity={0.85}
            onPress={() => scrollRef.current?.scrollTo?.({ y: 0, animated: true })}>
            <Image source={LOGO_IMG} style={{ width: 36, height: 36 }} resizeMode="contain" />
            <RNText style={headFont(20, "700", colors.text.primary)}>GMIS</RNText>
          </TouchableOpacity>

          {/* Desktop links */}
          {!isNarrow && (
            <View style={[layout.row, { gap: spacing[7] }]}>
              {["Features", "How it works", "Contact"].map((link) => (
                <TouchableOpacity key={link} activeOpacity={0.7}>
                  <RNText style={bodyFont(14, colors.text.secondary)}>{link}</RNText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* CTAs */}
          <View style={[layout.row, { gap: spacing[3] }]}>
            {!isNarrow && (
              <Button label="Find your school" variant="ghost" size="sm"
                onPress={() => router.push("/find-school")} />
            )}
            <Button
              label={isNarrow ? "Get started" : "Register institution →"}
              variant="primary" size="sm"
              onPress={() => router.push("/register")}
            />
          </View>
        </View>
      </View>

      {/* ════════════════ HERO ══════════════════════════ */}
      <View style={[S.hero, { backgroundColor: "#030919" }]}>
        {/* Animated gradient orbs */}
        <View nativeID="orb1" style={[S.orb, { top:-100, left:-60,  width:600, height:600, backgroundColor: brand.indigo, opacity:0.22 }]} />
        <View nativeID="orb2" style={[S.orb, { bottom:-80, right:-60, width:480, height:480, backgroundColor: brand.blue,  opacity:0.18 }]} />
        <View nativeID="orb3" style={[S.orb, { top:"40%"  as any, left:"60%" as any, width:300, height:300, backgroundColor: brand.purple, opacity:0.14 }]} />

        {/* Dot grid overlay */}
        <View style={S.dotGrid} />

        <View style={[S.heroInner, isNarrow && { flexDirection:"column", alignItems:"center" }]}>
          {/* Left text */}
          <View style={[S.heroLeft, isNarrow && { alignItems:"center", maxWidth:"100%" as any }]}>
            {/* Live badge */}
            <View nativeID="hero-badge" style={S.heroBadge}>
              <View style={S.badgeDot} />
              <RNText style={{ fontSize:11, color:"#93c5fd", fontWeight:"600", letterSpacing:0.6, fontFamily:'"DM Sans",sans-serif' }}>
                Platform Live · gmis.app
              </RNText>
            </View>

            {/* Headline — each line wrapped in overflow:hidden for slide-up reveal */}
            <View style={{ marginTop: spacing[5] }}>
              {[
                { id:"hl-0", text:"The Campus OS",    color:"#f0f7ff" },
                { id:"hl-1", text:"for Africa's",      color:"#f0f7ff" },
                { id:"hl-2", text:"Universities",      color: brand.blue },
              ].map(({ id, text, color }) => (
                <View key={id} style={{ overflow:"hidden" as any }}>
                  <RNText nativeID={id} style={[headFont(isNarrow ? 36 : isWide ? 58 : 48, "800", color), {
                    display:"block" as any, textAlign: isNarrow ? "center" : "left",
                  }]}>{text}</RNText>
                </View>
              ))}
            </View>

            {/* Sub */}
            <RNText nativeID="hero-sub" style={[bodyFont(isNarrow ? 15 : 17, "rgba(148,163,184,0.88)"), {
              marginTop: spacing[5], maxWidth: 480,
              textAlign: isNarrow ? "center" : "left",
            }]}>
              Give every institution its own isolated portal — students, lecturers, admins and parents,
              all in one system. Live at{" "}
              <RNText style={{ color:"#60a5fa", fontFamily:'"DM Sans",sans-serif' }}>yourschool.gmis.app</RNText>
              {" "}in 48 hours.
            </RNText>

            {/* CTA buttons */}
            <View style={[layout.row, {
              gap: spacing[3], marginTop: spacing[8],
              flexWrap:"wrap", justifyContent: isNarrow ? "center" : "flex-start",
            }]}>
              <View className="hero-cta">
                <Button label="Find your school →" variant="primary" size="lg"
                  onPress={() => router.push("/find-school")} />
              </View>
              <View className="hero-cta">
                <Button label="Register institution" variant="secondary" size="lg"
                  onPress={() => router.push("/register")} />
              </View>
            </View>

            {/* Trust signals */}
            <View style={[layout.row, {
              gap: spacing[5], marginTop: spacing[5], flexWrap:"wrap",
              justifyContent: isNarrow ? "center" : "flex-start",
            }]}>
              {["Free for students", "Zero transaction fees", "Isolated per school"].map((t) => (
                <View key={t} className="hero-trust" style={[layout.row, { gap: spacing[2] }]}>
                  <View style={{ width:5, height:5, borderRadius:99, backgroundColor:"#4ade80", marginTop:4 }} />
                  <RNText style={bodyFont(12, "rgba(148,163,184,0.72)")}>{t}</RNText>
                </View>
              ))}
            </View>
          </View>

          {/* Right: Phone mockup */}
          {!isNarrow && (
            <View style={S.heroRight}>
              <PhoneMockup />
            </View>
          )}
        </View>
      </View>

      {/* ════════════════ STATS BAR ═════════════════════ */}
      <View style={[S.statsBar, {
        backgroundColor: isDark ? "#070d20" : "#ffffff",
        borderTopWidth:1, borderBottomWidth:1,
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(45,108,255,0.08)",
      }]}>
        {[
          { svId:"sv-0", display:"10+",   label:"Institutions live" },
          { svId:"sv-1", display:"5,000+",label:"Student accounts" },
          { svId:"sv-2", display:"14",    label:"Core features" },
          { svId:"sv-3", display:"48h",   label:"Time to go live" },
        ].map(({ svId, display, label }, i, arr) => (
          <View key={label} style={[S.statItem, i < arr.length - 1 && {
            borderRightWidth:1,
            borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
          }]}>
            <RNText nativeID={svId} style={headFont(isNarrow ? 26 : 34, "800", colors.text.primary)}>
              {display}
            </RNText>
            <RNText style={bodyFont(13, colors.text.muted)}>{label}</RNText>
          </View>
        ))}
      </View>

      {/* ════════════════ FEATURES BENTO ════════════════ */}
      <View nativeID="bento-section" style={[S.section, { backgroundColor: bg2 }]}>
        <View style={S.sectionHead}>
          <Pill label="What's Inside" />
          <RNText style={[headFont(isNarrow ? 28 : 42, "800", colors.text.primary), { textAlign:"center", marginTop:spacing[3] }]}>
            Everything your campus needs
          </RNText>
          <RNText style={[bodyFont(16, colors.text.secondary), { textAlign:"center", maxWidth:500, marginTop:spacing[3] }]}>
            14 student features, 9 admin tools, full lecturer and parent portals — isolated per school.
          </RNText>
        </View>

        <View style={[S.bentoGrid, {
          display: isNarrow ? "flex" : "grid" as any,
          gridTemplateColumns: isWide ? "repeat(4,1fr)" : "repeat(2,1fr)",
          flexDirection: "column",
        } as any]}>
          {FEATURES.map((f) => (
            <BentoCard
              key={f.id}
              {...f}
              isDark={isDark}
              glassStyle={glassStyle}
              cardBorder={cardBorder}
              colors={colors}
            />
          ))}
        </View>
      </View>

      {/* ════════════════ PERSONAS ══════════════════════ */}
      <View style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <Pill label="Who It's For" />
          <RNText style={[headFont(isNarrow ? 28 : 42, "800", colors.text.primary), { textAlign:"center", marginTop:spacing[3] }]}>
            Built for every campus role
          </RNText>
        </View>

        {/* Tabs */}
        <View style={[S.tabRow, { maxWidth:640, alignSelf:"center", width:"100%" as any, marginBottom:spacing[8] }]}>
          {PERSONAS.map(({ role, color }, i) => (
            <TouchableOpacity key={role} onPress={() => switchPersona(i)} activeOpacity={0.8}
              style={[S.tab,
                activePersona === i
                  ? { backgroundColor: color, borderColor: color }
                  : { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }
              ]}>
              <Icon name={PERSONAS[i].icon} size="sm" color={activePersona === i ? "#fff" : colors.text.secondary} />
              <RNText style={bodyFont(13, activePersona === i ? "#fff" : colors.text.secondary)}>
                {role}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Persona card */}
        {(() => {
          const p = PERSONAS[activePersona];
          return (
            <View nativeID="persona-content" style={[S.personaCard, {
              ...glassStyle, borderWidth:1, borderColor:cardBorder,
              borderRadius: radius["3xl"], maxWidth:900,
              alignSelf:"center", width:"100%" as any,
            }]}>
              <View style={[layout.row, { gap:spacing[4], marginBottom:spacing[6], flexWrap:"wrap" }]}>
                <View style={[S.personaIcon, { backgroundColor: p.colorAlpha }]}>
                  <Icon name={p.icon} size="xl" color={p.color} />
                </View>
                <View style={{ flex:1, minWidth:200 }}>
                  <RNText style={headFont(22, "700", colors.text.primary)}>{p.role}</RNText>
                  <RNText style={bodyFont(15, colors.text.secondary)}>{p.headline}</RNText>
                </View>
              </View>
              <View style={{ flexDirection: isNarrow ? "column" : "row", flexWrap:"wrap", gap:spacing[3] }}>
                {p.features.map((f) => (
                  <View key={f} style={[S.featurePill, {
                    backgroundColor: p.colorAlpha,
                    borderColor: p.color + "33",
                    width: isNarrow ? "100%" as any : "47%" as any,
                  }]}>
                    <View style={{ width:6, height:6, borderRadius:3, backgroundColor:p.color }} />
                    <RNText style={bodyFont(13, colors.text.primary)}>{f}</RNText>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}
      </View>

      {/* ════════════════ HOW IT WORKS ══════════════════ */}
      <View nativeID="steps-section" style={[S.section, { backgroundColor: bg2 }]}>
        <View style={S.sectionHead}>
          <Pill label="Getting Started" />
          <RNText style={[headFont(isNarrow ? 28 : 42, "800", colors.text.primary), { textAlign:"center", marginTop:spacing[3] }]}>
            Go live in 4 steps
          </RNText>
          <RNText style={[bodyFont(16, colors.text.secondary), { textAlign:"center", maxWidth:460, marginTop:spacing[3] }]}>
            Your school can be live on GMIS in under 48 hours.
          </RNText>
        </View>

        <View style={{ maxWidth:1000, alignSelf:"center", width:"100%" as any }}>
          {!isNarrow && (
            <View style={[layout.row, { justifyContent:"center", marginBottom:-28, paddingHorizontal:spacing[12], zIndex:0 }]}>
              <View nativeID="step-connector" style={[S.stepConnector, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(45,108,255,0.12)",
              }]} />
            </View>
          )}
          <View style={isNarrow ? S.stepsCol : S.stepsRow}>
            {STEPS.map(({ n, title, color, desc }) => (
              <View key={n} className="step-card" style={[S.stepCard, {
                ...glassStyle, borderWidth:1, borderColor:cardBorder, borderRadius:radius["2xl"],
                flex: isNarrow ? undefined : 1, width: isNarrow ? "100%" as any : undefined, zIndex:1,
              }]}>
                <View style={[S.stepNum, { backgroundColor:color+"20", borderColor:color+"40", borderWidth:1 }]}>
                  <RNText style={headFont(18, "800", color)}>{n}</RNText>
                </View>
                <RNText style={headFont(15, "600", colors.text.primary)}>{title}</RNText>
                <RNText style={bodyFont(13, colors.text.secondary)}>{desc}</RNText>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ════════════════ TESTIMONIALS ══════════════════ */}
      <View nativeID="testi-section" style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <Pill label="Testimonials" />
          <RNText style={[headFont(isNarrow ? 28 : 42, "800", colors.text.primary), { textAlign:"center", marginTop:spacing[3] }]}>
            Trusted by institutions
          </RNText>
        </View>
        <View style={[S.testiRow, { gap:spacing[5], maxWidth:1100, alignSelf:"center", width:"100%" as any }]}>
          {TESTIMONIALS.map(({ quote, name, role, school }) => (
            <View key={name} className="testi-card" style={[S.testiCard, {
              ...glassStyle, borderWidth:1, borderColor:cardBorder,
              flex: isNarrow ? undefined : 1, width: isNarrow ? "100%" as any : undefined,
            }]}>
              <RNText style={{ fontFamily:'"Space Grotesk",system-ui', fontSize:52, color:brand.blueAlpha20, lineHeight:52 }}>❝</RNText>
              <RNText style={[bodyFont(14, colors.text.secondary), { marginTop:spacing[2], lineHeight:24 }]}>{quote}</RNText>
              <View style={[S.testiAuthor, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                <View style={[S.testiAvatar, { backgroundColor: brand.blueAlpha15 }]}>
                  <RNText style={{ fontSize:12, fontWeight:"700", color:brand.blue, fontFamily:'"Space Grotesk",system-ui' }}>
                    {name.split(" ").map((w) => w[0]).join("").slice(0,2)}
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

      {/* ════════════════ CONTACT (replaces Pricing) ════ */}
      <View nativeID="contact-section" style={[S.contactSection, {
        backgroundImage: `linear-gradient(135deg, #030919 0%, #0d1a4a 50%, #030919 100%)`,
        backgroundColor: "#030919",
      } as any]}>
        {/* Orbs */}
        <View style={[S.orb, { top:-60, left:"35%"as any, width:480, height:480, backgroundColor:brand.blue, opacity:0.1 }]} />
        <View style={[S.orb, { bottom:-40, right:-80, width:360, height:360, backgroundColor:brand.purple, opacity:0.12 }]} />

        <View style={{ maxWidth:820, alignSelf:"center", width:"100%"as any, alignItems:"center" }}>
          {/* GMIS logo */}
          <Image className="contact-reveal" source={LOGO_LIGHT} style={{ width:60, height:60, marginBottom:spacing[5] }} resizeMode="contain" />

          <View className="contact-reveal" style={S.sectionPill}>
            <RNText style={{ fontSize:11, fontWeight:"700", color:brand.blue, letterSpacing:1.4,
              textTransform:"uppercase"as any, fontFamily:'"DM Sans",sans-serif' }}>Get in touch</RNText>
          </View>

          <RNText className="contact-reveal" style={[headFont(isNarrow ? 32 : 52, "800", "#f0f7ff"), {
            textAlign:"center", maxWidth:640, marginTop:spacing[4],
          }]}>
            Ready to transform{"\n"}your campus?
          </RNText>

          <RNText className="contact-reveal" style={[bodyFont(17, "rgba(148,163,184,0.82)"), {
            textAlign:"center", maxWidth:520, marginTop:spacing[4],
          }]}>
            Talk to our team. We'll walk you through setting up your institution, answer your questions, and get you live in 48 hours.
          </RNText>

          {/* Contact cards */}
          <View className="contact-reveal" style={[layout.row, {
            gap:spacing[4], marginTop:spacing[10], flexWrap:"wrap", justifyContent:"center",
          }]}>
            {[
              { icon:"nav-chat"as IconName, label:"Chat on WhatsApp", sub:"+229 97 00 00 00", color:brand.emerald, bg:"rgba(16,185,129,0.1)", border:"rgba(16,185,129,0.25)" },
              { icon:"nav-ai"  as IconName, label:"Send us an email",  sub:"hello@damstech.com",   color:brand.blue,   bg:"rgba(45,108,255,0.1)",  border:"rgba(45,108,255,0.25)"  },
            ].map(({ icon, label, sub, color, bg: cbg, border }) => (
              <TouchableOpacity key={label} activeOpacity={0.8} style={[S.contactCard, {
                backgroundColor: cbg,
                borderColor: border,
              }]}>
                <View style={{ width:44, height:44, borderRadius:radius.lg, backgroundColor:color+"25", alignItems:"center", justifyContent:"center", marginBottom:spacing[3] }}>
                  <Icon name={icon} size="lg" color={color} />
                </View>
                <RNText style={headFont(15, "600", "#e8eeff")}>{label}</RNText>
                <RNText style={bodyFont(13, "rgba(148,163,184,0.7)")}>{sub}</RNText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Primary CTA */}
          <View nativeID="contact-cta-btn" className="contact-reveal" style={{ marginTop:spacing[8], borderRadius:radius.full, overflow:"hidden"as any }}>
            <Button
              label="Register your institution →"
              variant="primary" size="lg"
              onPress={() => router.push("/register")}
            />
          </View>

          <RNText className="contact-reveal" style={[bodyFont(13, "rgba(148,163,184,0.45)"), { marginTop:spacing[4] }]}>
            Free to get started · No credit card required
          </RNText>
        </View>
      </View>

      {/* ════════════════ FAQ ═══════════════════════════ */}
      <View nativeID="faq-section" style={[S.section, { backgroundColor: bg }]}>
        <View style={S.sectionHead}>
          <Pill label="FAQ" />
          <RNText style={[headFont(isNarrow ? 28 : 42, "800", colors.text.primary), { textAlign:"center", marginTop:spacing[3] }]}>
            Frequently asked questions
          </RNText>
        </View>
        <View style={{ maxWidth:720, alignSelf:"center", width:"100%"as any, gap:spacing[3] }}>
          {FAQ_ITEMS.map(([q, a], i) => {
            const open = openFaq === i;
            return (
              <TouchableOpacity key={i} className="faq-item" onPress={() => setOpenFaq(open ? null : i)}
                activeOpacity={0.85}
                style={[S.faqItem, {
                  ...glassStyle, borderWidth:1,
                  borderColor: open ? brand.blueAlpha30 : cardBorder,
                  borderRadius: radius["2xl"],
                } as any]}>
                <View style={layout.rowBetween}>
                  <RNText style={[headFont(15, "600", colors.text.primary), { flex:1, lineHeight:24 }]}>{q}</RNText>
                  <View style={[S.faqChevron, {
                    backgroundColor: open ? brand.blueAlpha10 : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    transform:[{ rotate: open ? "45deg" : "0deg" }],
                  }]}>
                    <Icon name="ui-add" size="sm" color={open ? brand.blue : colors.text.muted} />
                  </View>
                </View>
                {open && (
                  <RNText style={[bodyFont(14, colors.text.secondary), {
                    marginTop:spacing[4], paddingTop:spacing[4],
                    borderTopWidth:1, borderTopColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    lineHeight:24,
                  }]}>{a}</RNText>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ════════════════ FOOTER ════════════════════════ */}
      <View style={[S.footer, { backgroundColor:"#020509", borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.05)" }]}>
        <View style={[S.footerInner, { maxWidth:1160 }]}>
          <View style={S.footerBrand}>
            <View style={[layout.row, { gap:spacing[2], marginBottom:spacing[4], alignItems:"center" }]}>
              <Image source={LOGO_LIGHT} style={{ width:32, height:32 }} resizeMode="contain" />
              <RNText style={headFont(20, "700", "#fff")}>GMIS</RNText>
            </View>
            <RNText style={bodyFont(13, "rgba(255,255,255,0.32)")}>
              GRASP Management Information System{"\n"}The future of academic operations{"\n"}for Nigerian institutions.
            </RNText>
            <RNText style={[bodyFont(12, "rgba(255,255,255,0.2)"), { marginTop:spacing[4] }]}>
              © {new Date().getFullYear()} DAMS Technologies · Built in Cotonou, Benin Republic 🇧🇯
            </RNText>
          </View>
          <View style={S.footerLinks}>
            {[
              { heading:"Product",      links:["Features","How it works","Find your school","Register"] },
              { heading:"Institutions", links:["Documentation","Support","SLA","Contact"] },
              { heading:"Company",      links:["About DAMS Tech","Privacy Policy","Terms of Service"] },
            ].map(({ heading, links }) => (
              <View key={heading} style={{ minWidth:130 }}>
                <RNText style={[bodyFont(11, "rgba(255,255,255,0.22)"), {
                  textTransform:"uppercase"as any, letterSpacing:1.2,
                  fontWeight:"700", marginBottom:spacing[4],
                }]}>{heading}</RNText>
                {links.map((link) => (
                  <TouchableOpacity key={link} style={{ marginBottom:spacing[3] }} activeOpacity={0.7}>
                    <RNText style={bodyFont(13, "rgba(255,255,255,0.42)")}>{link}</RNText>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

// ── StyleSheet ────────────────────────────────────────────
// Typed as `any` so web-only CSS (backdropFilter, position:sticky,
// filter, etc.) don't conflict with RN's strict ViewStyle union.
const S: any = StyleSheet.create(({
  // Nav
  nav: {
    position:"sticky"as any, top:0, zIndex:100,
    paddingVertical: spacing[4],
  },
  navInner: {
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    maxWidth:1200, marginHorizontal:"auto"as any,
    paddingHorizontal:spacing[6], width:"100%"as any,
  },

  // Hero
  hero: {
    paddingTop:130, paddingBottom:110,
    paddingHorizontal:spacing[6], overflow:"hidden",
  },
  heroInner: {
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    maxWidth:1160, marginHorizontal:"auto"as any,
    width:"100%"as any, gap:spacing[12],
  },
  heroLeft:  { flex:1, maxWidth:620 },
  heroRight: { flex:1, alignItems:"flex-end" },
  heroBadge: {
    flexDirection:"row", alignItems:"center", gap:spacing[2],
    alignSelf:"flex-start",
    paddingHorizontal:spacing[4], paddingVertical:spacing[2],
    borderRadius:radius.full,
    backgroundColor:"rgba(45,108,255,0.12)",
    borderWidth:1, borderColor:"rgba(45,108,255,0.28)",
  },
  badgeDot: {
    width:7, height:7, borderRadius:99, backgroundColor:"#4ade80",
    shadowColor:"#4ade80", shadowOpacity:0.8, shadowRadius:6, shadowOffset:{width:0,height:0},
  },
  orb: {
    position:"absolute", borderRadius:9999,
    filter:"blur(90px)"as any,
  },
  dotGrid: {
    position:"absolute"as any,
    top:0, left:0, right:0, bottom:0,
  },

  // Phone mockup
  phoneWrap:  { width:270, height:540, position:"relative", alignItems:"center" },
  phoneGlow:  {
    position:"absolute", width:260, height:260, borderRadius:130,
    backgroundColor:brand.blue, top:120,
    filter:"blur(70px)"as any, opacity:0.28,
  },
  phoneFrame: {
    width:252, height:510, borderRadius:50,
    backgroundColor:"#080e1c", padding:8,
    shadowColor:"#000", shadowOffset:{width:0,height:28},
    shadowOpacity:0.65, shadowRadius:48, elevation:24,
    borderWidth:1, borderColor:"rgba(255,255,255,0.1)",
  },
  phonePill: {
    width:90, height:26, borderRadius:13,
    backgroundColor:"#080e1c",
    alignSelf:"center", position:"absolute", top:0, zIndex:10,
  },
  phoneScreen: {
    flex:1, borderRadius:44, backgroundColor:"#060a18",
    overflow:"hidden", padding:spacing[4], paddingTop:spacing[9],
  },
  gpaCard: {
    backgroundColor:"rgba(45,108,255,0.15)",
    borderRadius:14, padding:12,
    borderWidth:1, borderColor:"rgba(45,108,255,0.25)",
  },
  statChip: {
    flex:1, backgroundColor:"rgba(255,255,255,0.05)",
    borderRadius:10, padding:8, alignItems:"center",
    borderWidth:1, borderColor:"rgba(255,255,255,0.08)",
  },
  floatBadge: {
    position:"absolute",
    backgroundColor:"rgba(10,22,55,0.92)",
    backdropFilter:"blur(16px)"as any,
    WebkitBackdropFilter:"blur(16px)"as any,
    borderRadius:radius.xl,
    paddingHorizontal:spacing[4], paddingVertical:spacing[2],
    borderWidth:1, borderColor:"rgba(255,255,255,0.1)",
    alignItems:"center",
    shadowColor:"#000", shadowOpacity:0.35, shadowRadius:16, shadowOffset:{width:0,height:8},
  },

  // Stats bar
  statsBar:  { flexDirection:"row", paddingVertical:spacing[6] },
  statItem:  { flex:1, alignItems:"center", paddingVertical:spacing[2] },

  // Section shell
  section:   { paddingVertical:spacing[24], paddingHorizontal:spacing[6] },
  sectionHead: { alignItems:"center", marginBottom:spacing[12] },
  sectionPill: {
    paddingHorizontal:spacing[4], paddingVertical:spacing[2],
    borderRadius:radius.full,
    backgroundColor:"rgba(45,108,255,0.10)",
    borderWidth:1, borderColor:"rgba(45,108,255,0.20)",
  },

  // Bento
  bentoGrid: {
    gap:spacing[4], maxWidth:1160, alignSelf:"center", width:"100%"as any,
  },
  bentoCard: {
    borderRadius:radius["2xl"],
    borderWidth:1,
    padding:spacing[6],
    gap:spacing[2],
  },
  bentoCardDouble: { gridColumn:"span 2"as any },
  bentoIcon: {
    width:spacing[12], height:spacing[12],
    borderRadius:radius.lg, alignItems:"center", justifyContent:"center",
  },

  // Persona
  personaCard: { padding:spacing[8] },
  personaIcon: {
    width:56, height:56, borderRadius:radius["2xl"],
    alignItems:"center", justifyContent:"center",
  },
  featurePill: {
    flexDirection:"row", alignItems:"center", gap:spacing[2],
    paddingHorizontal:spacing[3], paddingVertical:spacing[2],
    borderRadius:radius.lg, borderWidth:1,
  },
  tabRow: { flexDirection:"row", flexWrap:"wrap", gap:spacing[2] },
  tab: {
    flexDirection:"row", alignItems:"center", gap:spacing[2],
    paddingHorizontal:spacing[4], paddingVertical:spacing[3],
    borderRadius:radius.xl, borderWidth:1, flex:1, justifyContent:"center",
  },

  // Steps
  stepsRow: { flexDirection:"row", gap:spacing[4] },
  stepsCol: { flexDirection:"column", gap:spacing[4] },
  stepCard: { padding:spacing[6], gap:spacing[3] },
  stepNum: {
    width:48, height:48, borderRadius:radius.xl,
    alignItems:"center", justifyContent:"center",
  },
  stepConnector: {
    flex:1, height:2, borderRadius:1,
  },

  // Testimonials
  testiRow: { flexDirection:"row", flexWrap:"wrap" },
  testiCard: {
    padding:spacing[6], borderRadius:radius["2xl"],
    gap:spacing[2],
  },
  testiAuthor: {
    flexDirection:"row", alignItems:"center", gap:spacing[3],
    marginTop:spacing[5], paddingTop:spacing[5], borderTopWidth:1,
  },
  testiAvatar: {
    width:40, height:40, borderRadius:radius.full,
    alignItems:"center", justifyContent:"center",
  },

  // Contact
  contactSection: {
    paddingVertical:spacing[24], paddingHorizontal:spacing[6],
    overflow:"hidden", alignItems:"center",
  },
  contactCard: {
    borderRadius:radius["2xl"], borderWidth:1,
    padding:spacing[6], minWidth:220, maxWidth:280,
    flex:1, alignItems:"center",
  },

  // FAQ
  faqItem: { padding:spacing[5] },
  faqChevron: {
    width:32, height:32, borderRadius:radius.lg,
    alignItems:"center", justifyContent:"center",
    marginLeft:spacing[3], flexShrink:0,
  },

  // Footer
  footer: { paddingVertical:spacing[16], paddingHorizontal:spacing[6] },
  footerInner: {
    flexDirection:"row", flexWrap:"wrap", gap:spacing[10],
    marginHorizontal:"auto"as any, width:"100%"as any,
  },
  footerBrand: { minWidth:220, maxWidth:320, flex:1 },
  footerLinks: {
    flex:2, flexDirection:"row", flexWrap:"wrap", gap:spacing[10],
    justifyContent:"flex-end",
  },
}) as any);
