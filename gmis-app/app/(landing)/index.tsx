// ============================================================
// GMIS — Platform Landing Page
// Route: /(landing)  — only shown at gmis.app (no subdomain)
// Web-only. Full marketing page for GMIS platform.
// Sections: Nav, Hero, Features, Who it's for, Pricing,
//           How it works, Testimonials, CTA, Footer
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Text, Button, Card } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Section types ──────────────────────────────────────────
interface Feature {
  icon:  IconName;
  title: string;
  desc:  string;
}

interface Plan {
  name:    string;
  price:   string;
  period:  string;
  cap:     string;
  color:   string;
  popular: boolean;
  features: string[];
}

interface Persona {
  role:     string;
  icon:     IconName;
  color:    string;
  features: string[];
}

// ── Data ──────────────────────────────────────────────────
const FEATURES: Feature[] = [
  { icon: "nav-results",    title: "Academic Results",    desc: "Live grades the moment they're released. GPA, CGPA and honour class computed automatically." },
  { icon: "nav-payments",   title: "Fee Payments",        desc: "Paystack integration per school. Payments go directly to the school — GMIS takes nothing." },
  { icon: "nav-chat",       title: "Campus Chat",         desc: "WhatsApp-style group messaging per course. DMs between students and lecturers." },
  { icon: "nav-voting",     title: "SUG Elections",       desc: "Tamper-proof digital voting. Nominations, campaigns, and live results — all on GMIS." },
  { icon: "nav-ai",         title: "AI Academic Assistant", desc: "Claude-powered academic help available 24/7. Explains concepts, solves problems, reviews work." },
  { icon: "nav-clearance",  title: "Clearance System",    desc: "Digital library, hostel, fees, lab and sports clearance. No more paper queues." },
  { icon: "nav-timetable",  title: "Smart Timetable",     desc: "Class and exam timetables with live NOW / UP NEXT status, auto-updated every 30 seconds." },
  { icon: "nav-attendance", title: "QR Attendance",       desc: "Anti-cheat QR codes with device fingerprint + GPS verification. 15-minute countdown." },
  { icon: "nav-calendar",   title: "Academic Calendar",   desc: "School-wide events, deadlines and sessions in one place. Synced for all users." },
  { icon: "nav-courses",    title: "Course Registration", desc: "Students register for courses online each semester. Admin controls registration windows." },
  { icon: "nav-social",     title: "Campus Social Feed",  desc: "Instagram + TikTok-style feed and reels. Keeps the campus community connected." },
  { icon: "nav-gpa",        title: "GPA Calculator",      desc: "Interactive grade simulator. Try different scores before results drop." },
];

const PERSONAS: Persona[] = [
  {
    role:  "Students",
    icon:  "user-student",
    color: brand.blue,
    features: [
      "Check results the moment they're released",
      "Pay school fees securely via Paystack",
      "Register for courses each semester",
      "View personal timetable and exam schedule",
      "Chat with classmates in course groups",
      "Vote in SUG elections from your phone",
      "Track clearance status across all departments",
      "Get 24/7 academic help from AI assistant",
    ],
  },
  {
    role:  "Lecturers",
    icon:  "user-lecturer",
    color: "#10b981",
    features: [
      "Upload CA and exam scores by matric number",
      "View all students enrolled in your courses",
      "Generate QR codes for attendance tracking",
      "Monitor handout payment status",
      "Lock submitted results for accuracy",
      "View class timetable and venue info",
    ],
  },
  {
    role:  "Administrators",
    icon:  "user-admin",
    color: brand.gold,
    features: [
      "Full academic setup: faculties, departments, courses",
      "Approve and manage student registrations",
      "Assign lecturers to courses and timetable slots",
      "Release results after lecturer submission",
      "Configure fee structure per level and session",
      "Generate and manage student ID cards",
      "Control registration windows and settings",
      "Run SUG elections and manage candidates",
    ],
  },
  {
    role:  "Parents",
    icon:  "user-parent",
    color: "#a855f7",
    features: [
      "Monitor ward's academic results in real time",
      "View fee payment status and history",
      "Track attendance percentage across courses",
      "Access academic calendar and exam dates",
      "Receive automatic alerts on key events",
      "Link multiple wards to a single account",
    ],
  },
];

const PLANS: Plan[] = [
  {
    name:    "Starter",
    price:   "₦15,000",
    period:  "/ month",
    cap:     "Up to 300 students",
    color:   "#60a5fa",
    popular: false,
    features: [
      "All core student features",
      "Results & timetable management",
      "Fee payment integration",
      "Basic analytics dashboard",
      "Email support",
    ],
  },
  {
    name:    "Pro",
    price:   "₦35,000",
    period:  "/ month",
    cap:     "Up to 2,000 students",
    color:   brand.blue,
    popular: true,
    features: [
      "Everything in Starter",
      "AI academic assistant",
      "QR attendance system",
      "Campus social feed & reels",
      "SUG election module",
      "Parent portal",
      "Priority support",
    ],
  },
  {
    name:    "Enterprise",
    price:   "₦80,000",
    period:  "/ month",
    cap:     "Unlimited students",
    color:   brand.gold,
    popular: false,
    features: [
      "Everything in Pro",
      "Unlimited student accounts",
      "Custom subdomain & branding",
      "ID card generation system",
      "Advanced analytics",
      "Dedicated account manager",
      "SLA-backed uptime guarantee",
    ],
  },
];

const STEPS = [
  { n: "1", title: "Register your institution", desc: "Submit your school's details and documents. DAMS Technologies reviews and approves within 48 hours." },
  { n: "2", title: "Set up your portal",         desc: "Configure faculties, departments, courses and staff. Your isolated Supabase database is ready instantly." },
  { n: "3", title: "Onboard your students",      desc: "Students self-register or you bulk-import via CSV. Approve registrations with a single click." },
  { n: "4", title: "Go live",                    desc: "Your school portal is live at yourschool.gmis.app. Students log in with matric number or email." },
];

// ── Component ──────────────────────────────────────────────
export default function LandingPage() {
  const router              = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { width }           = useWindowDimensions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isNarrow = width < 768;
  const isMedium = width >= 768 && width < 1200;

  const bg  = isDark ? "#03071a" : "#f8faff";
  const bg2 = isDark ? "#080d20" : "#f0f4ff";

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: bg }]}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── NAV ───────────────────────────────────────────── */}
      <View style={[styles.nav, { backgroundColor: bg, borderBottomColor: colors.border.subtle }]}>
        <View style={[styles.navInner, isNarrow && { paddingHorizontal: spacing[4] }]}>
          {/* Logo */}
          <TouchableOpacity style={[layout.row, { gap: spacing[2] }]} activeOpacity={0.8}>
            <View style={styles.logoBox}>
              <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.lg, color: "#fff" }}>G</Text>
            </View>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: colors.text.primary }}>GMIS</Text>
          </TouchableOpacity>

          {/* Desktop nav links */}
          {!isNarrow && (
            <View style={[layout.row, { gap: spacing[6] }]}>
              {["Features", "Pricing", "How it works"].map((link) => (
                <TouchableOpacity key={link} activeOpacity={0.7}>
                  <Text style={{ fontSize: fontSize.base, color: colors.text.secondary }}>{link}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* CTAs */}
          <View style={[layout.row, { gap: spacing[3] }]}>
            <Button
              label="Find your school"
              variant="ghost"
              size="sm"
              onPress={() => router.push("/find-school")}
            />
            <Button
              label="Register institution"
              variant="primary"
              size="sm"
              onPress={() => router.push("/register")}
            />
          </View>
        </View>
      </View>

      {/* ── HERO ──────────────────────────────────────────── */}
      <View style={[styles.hero, { backgroundColor: bg }]}>
        <View style={styles.heroBadge}>
          <View style={styles.liveDot} />
          <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold, letterSpacing: 0.8 }}>
            GMIS Platform · Live · gmis.app
          </Text>
        </View>

        <Text
          style={{
            fontSize:   isNarrow ? fontSize["4xl"] : fontSize["6xl"],
            fontWeight: fontWeight.black,
            color:      colors.text.primary,
            textAlign:  "center",
            lineHeight: isNarrow ? fontSize["4xl"] * 1.15 : fontSize["6xl"] * 1.1,
            maxWidth:   700,
            marginTop:  spacing[4],
          }}
        >
          The future of{"\n"}
          <Text style={{ fontSize: isNarrow ? fontSize["4xl"] : fontSize["6xl"], fontWeight: fontWeight.black, color: brand.blue }}>
            campus management
          </Text>
        </Text>

        <Text
          style={{
            fontSize:   fontSize.lg,
            color:      colors.text.secondary,
            textAlign:  "center",
            maxWidth:   520,
            marginTop:  spacing[4],
            lineHeight: 28,
          }}
        >
          Give every Nigerian university, polytechnic and college a powerful, isolated portal for students, lecturers, admins and parents.
        </Text>

        <View style={[layout.row, { gap: spacing[3], marginTop: spacing[7], flexWrap: "wrap", justifyContent: "center" }]}>
          <Button label="Find your school →" variant="primary" size="lg" onPress={() => router.push("/find-school")} />
          <Button label="Register your institution" variant="secondary" size="lg" onPress={() => router.push("/register")} />
        </View>

        <View style={[layout.row, { gap: spacing[5], marginTop: spacing[5], flexWrap: "wrap", justifyContent: "center" }]}>
          {[
            { label: "Free for students" },
            { label: "Schools pay subscription" },
            { label: "Zero transaction fees" },
          ].map(({ label }) => (
            <View key={label} style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="status-success" size="sm" color={colors.status.success} filled />
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── FEATURES GRID ─────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: bg2 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: brand.blue }]}>WHAT'S INSIDE</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Everything your campus needs
          </Text>
          <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>
            14 student features, 9 admin features, full lecturer and parent portals — all isolated per school.
          </Text>
        </View>

        <View style={[styles.featureGrid, { gap: spacing[4] }]}>
          {FEATURES.map(({ icon, title, desc }) => (
            <View
              key={title}
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.bg.card,
                  borderColor:     colors.border.DEFAULT,
                  minWidth:        isNarrow ? "100%" : 240,
                  flex:            isNarrow ? undefined : 1,
                },
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: brand.blueAlpha10 }]}>
                <Icon name={icon} size="lg" color={brand.blue} />
              </View>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>{title}</Text>
              <Text variant="caption" color="secondary" style={{ lineHeight: 20 }}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── WHO IT'S FOR ──────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: bg }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: brand.blue }]}>WHO IT'S FOR</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Built for every campus role</Text>
        </View>

        <View style={[styles.personaGrid, { gap: spacing[4] }]}>
          {PERSONAS.map(({ role, icon, color, features }) => (
            <View
              key={role}
              style={[
                styles.personaCard,
                {
                  backgroundColor: colors.bg.card,
                  borderColor:     colors.border.DEFAULT,
                  flex: isNarrow ? undefined : 1,
                  minWidth: isNarrow ? "100%" : 220,
                },
              ]}
            >
              <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                <View style={[styles.personaIcon, { backgroundColor: color + "15" }]}>
                  <Icon name={icon} size="lg" color={color} />
                </View>
                <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, alignSelf: "center" }}>
                  {role}
                </Text>
              </View>
              {features.map((f) => (
                <View key={f} style={[layout.row, { gap: spacing[2], marginBottom: spacing[2] }]}>
                  <Icon name="ui-check" size="xs" color={color} />
                  <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.text.secondary, lineHeight: 20 }}>{f}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: bg2 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: brand.blue }]}>GETTING STARTED</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>How it works</Text>
          <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>
            Your school can be live on GMIS in under 48 hours.
          </Text>
        </View>

        <View style={[layout.row, { gap: spacing[4], flexWrap: "wrap", justifyContent: "center" }]}>
          {STEPS.map(({ n, title, desc }) => (
            <View
              key={n}
              style={[
                styles.stepCard,
                {
                  backgroundColor: colors.bg.card,
                  borderColor:     colors.border.DEFAULT,
                  flex: isNarrow ? undefined : 1,
                  minWidth: isNarrow ? "100%" : 200,
                },
              ]}
            >
              <View style={[styles.stepNum, { backgroundColor: brand.blueAlpha10 }]}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.black, color: brand.blue }}>{n}</Text>
              </View>
              <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary, marginBottom: spacing[2] }}>{title}</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary, lineHeight: 20 }}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── PRICING ───────────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: bg }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: brand.blue }]}>PRICING</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Simple, transparent pricing</Text>
          <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>
            Pay monthly, quarterly, biannual or yearly. Cancel anytime.
          </Text>
        </View>

        <View style={[layout.row, { gap: spacing[4], flexWrap: "wrap", justifyContent: "center" }]}>
          {PLANS.map(({ name, price, period, cap, color, popular, features }) => (
            <View
              key={name}
              style={[
                styles.planCard,
                {
                  backgroundColor: popular ? brand.blue : colors.bg.card,
                  borderColor:     popular ? brand.blue : colors.border.DEFAULT,
                  borderWidth:     popular ? 2 : 1,
                  flex:            isNarrow ? undefined : 1,
                  minWidth:        isNarrow ? "100%" : 220,
                },
              ]}
            >
              {popular && (
                <View style={styles.popularBadge}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: "#fff" }}>MOST POPULAR</Text>
                </View>
              )}
              <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: popular ? "#fff" : colors.text.primary, marginBottom: spacing[1] }}>
                {name}
              </Text>
              <View style={[layout.row, { alignItems: "flex-end", gap: spacing[1], marginBottom: spacing[1] }]}>
                <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: popular ? "#fff" : color }}>{price}</Text>
                <Text style={{ fontSize: fontSize.sm, color: popular ? "rgba(255,255,255,0.7)" : colors.text.muted, paddingBottom: spacing[1] }}>{period}</Text>
              </View>
              <Text style={{ fontSize: fontSize.xs, color: popular ? "rgba(255,255,255,0.7)" : colors.text.muted, marginBottom: spacing[4] }}>{cap}</Text>
              {features.map((f) => (
                <View key={f} style={[layout.row, { gap: spacing[2], marginBottom: spacing[2] }]}>
                  <Icon name="ui-check" size="xs" color={popular ? "#fff" : color} />
                  <Text style={{ flex: 1, fontSize: fontSize.sm, color: popular ? "rgba(255,255,255,0.85)" : colors.text.secondary }}>
                    {f}
                  </Text>
                </View>
              ))}
              <Button
                label={popular ? "Get started →" : "Choose plan"}
                variant={popular ? "secondary" : "primary"}
                size="md"
                full
                onPress={() => router.push("/register")}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          ))}
        </View>

        <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, textAlign: "center", marginTop: spacing[5] }}>
          All plans include: unlimited lecturers, unlimited admins, and 1 parent per student.
        </Text>
      </View>

      {/* ── CTA BANNER ────────────────────────────────────── */}
      <View style={[styles.ctaBanner, { backgroundColor: brand.blue }]}>
        <Text style={{ fontSize: isNarrow ? fontSize["2xl"] : fontSize["3xl"], fontWeight: fontWeight.black, color: "#fff", textAlign: "center", marginBottom: spacing[2] }}>
          Ready to transform your campus?
        </Text>
        <Text style={{ fontSize: fontSize.base, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: spacing[6], maxWidth: 480 }}>
          Join the growing number of Nigerian institutions already using GMIS.
        </Text>
        <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap", justifyContent: "center" }]}>
          <Button label="Register your institution →" variant="secondary" size="lg" onPress={() => router.push("/register")} />
          <Button label="Find your school" variant="ghost" size="lg" onPress={() => router.push("/find-school")} />
        </View>
      </View>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <View style={[styles.footer, { backgroundColor: isDark ? "#020509" : "#0a0f2c", borderTopColor: "rgba(255,255,255,0.08)" }]}>
        <View style={styles.footerInner}>
          <View style={styles.footerBrand}>
            <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[3] }]}>
              <View style={styles.logoBox}><Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.lg, color: "#fff" }}>G</Text></View>
              <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: "#fff" }}>GMIS</Text>
            </View>
            <Text style={{ fontSize: fontSize.sm, color: "rgba(255,255,255,0.4)", maxWidth: 260, lineHeight: 20 }}>
              GRASP Management Information System — the future of academic operations for Nigerian institutions.
            </Text>
          </View>

          <View style={styles.footerLinks}>
            {[
              { heading: "Product", links: ["Features", "Pricing", "How it works", "Find your school"] },
              { heading: "Institutions", links: ["Register", "Documentation", "Support", "SLA"] },
              { heading: "Company", links: ["About DAMS Tech", "Contact", "Privacy Policy", "Terms of Service"] },
            ].map(({ heading, links }) => (
              <View key={heading} style={{ minWidth: 120 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[3] }}>
                  {heading}
                </Text>
                {links.map((link) => (
                  <TouchableOpacity key={link} style={{ marginBottom: spacing[2] }} activeOpacity={0.7}>
                    <Text style={{ fontSize: fontSize.sm, color: "rgba(255,255,255,0.5)" }}>{link}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.footerBottom, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
          <Text style={{ fontSize: fontSize.xs, color: "rgba(255,255,255,0.3)" }}>
            © {new Date().getFullYear()} DAMS Technologies. All rights reserved.
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: "rgba(255,255,255,0.3)" }}>
            Built in Cotonou, Benin Republic 🇧🇯
          </Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: {
    paddingVertical:   spacing[4],
    borderBottomWidth: 1,
    position:          "sticky" as any,
    top:               0,
    zIndex:            100,
  },
  navInner: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    maxWidth:          1200,
    marginHorizontal:  "auto",
    paddingHorizontal: spacing[6],
    width:             "100%",
  },
  logoBox: {
    width:           spacing[10], height: spacing[10],
    borderRadius:    radius.xl,
    backgroundColor: brand.blue,
    alignItems:      "center", justifyContent: "center",
  },
  hero: {
    alignItems:        "center",
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[20],
  },
  heroBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    backgroundColor:   brand.blueAlpha10,
    borderWidth:       1,
    borderColor:       brand.blueAlpha20,
  },
  liveDot: {
    width: spacing[2], height: spacing[2],
    borderRadius: radius.full, backgroundColor: brand.blue,
  },
  section: {
    paddingVertical:   spacing[16],
    paddingHorizontal: spacing[6],
  },
  sectionHeader: {
    alignItems:    "center",
    marginBottom:  spacing[10],
  },
  sectionLabel: {
    fontSize:      fontSize.xs,
    fontWeight:    fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom:  spacing[2],
  },
  sectionTitle: {
    fontSize:   fontSize["3xl"],
    fontWeight: fontWeight.black,
    textAlign:  "center",
    marginBottom: spacing[3],
  },
  sectionSub: {
    fontSize:  fontSize.lg,
    textAlign: "center",
    maxWidth:  540,
    lineHeight: 26,
  },
  featureGrid: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    maxWidth:       1200,
    alignSelf:      "center",
    width:          "100%",
  },
  featureCard: {
    padding:      spacing[5],
    borderRadius: radius.xl,
    borderWidth:  1,
    gap:          spacing[2],
  },
  featureIconBox: {
    width:        spacing[11], height: spacing[11],
    borderRadius: radius.lg,
    alignItems:   "center", justifyContent: "center",
    marginBottom: spacing[1],
  },
  personaGrid: {
    flexDirection: "row", flexWrap: "wrap",
    maxWidth: 1200, alignSelf: "center", width: "100%",
  },
  personaCard: {
    padding: spacing[5], borderRadius: radius.xl, borderWidth: 1,
  },
  personaIcon: {
    width: spacing[12], height: spacing[12],
    borderRadius: radius.lg, alignItems: "center", justifyContent: "center",
  },
  stepCard: {
    padding: spacing[5], borderRadius: radius.xl, borderWidth: 1, gap: spacing[2],
  },
  stepNum: {
    width: spacing[12], height: spacing[12],
    borderRadius: radius.full,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing[2],
  },
  planCard: {
    padding: spacing[6], borderRadius: radius["2xl"],
    overflow: "hidden",
  },
  popularBadge: {
    alignSelf:         "flex-start",
    backgroundColor:   "rgba(255,255,255,0.2)",
    borderRadius:      radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
    marginBottom:      spacing[3],
  },
  ctaBanner: {
    alignItems:        "center",
    paddingVertical:   spacing[16],
    paddingHorizontal: spacing[6],
  },
  footer: {
    paddingTop: spacing[12], borderTopWidth: 1,
  },
  footerInner: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    gap:               spacing[10],
    maxWidth:          1200,
    alignSelf:         "center",
    width:             "100%",
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[10],
  },
  footerBrand: {
    minWidth: 240, flex: 1,
  },
  footerLinks: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing[8],
  },
  footerBottom: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    flexWrap:          "wrap",
    gap:               spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[5],
    borderTopWidth:    1,
    maxWidth:          1200,
    alignSelf:         "center",
    width:             "100%",
  },
});
