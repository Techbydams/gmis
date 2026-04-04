// ============================================================
// GMIS — Web Landing Page
// Route: /(landing)  — shown at gmis.app (no subdomain)
// Placeholder until full 3D landing page is built (Step 14)
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Text, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

// Features list
const FEATURES = [
  { icon: "nav-results"   as const, label: "Academic Results",   desc: "Live grades, GPA, CGPA and honour class" },
  { icon: "nav-payments"  as const, label: "Fee Payments",       desc: "Secure Paystack integration per school"  },
  { icon: "nav-chat"      as const, label: "Campus Chat",        desc: "WhatsApp-style course group messaging"   },
  { icon: "nav-voting"    as const, label: "SUG Elections",      desc: "Tamper-proof digital voting system"      },
  { icon: "nav-ai"        as const, label: "AI Assistant",       desc: "Academic help powered by Claude"         },
  { icon: "nav-clearance" as const, label: "Clearance System",   desc: "Track library, fees, hostel clearance"   },
];

export default function LandingPage() {
  const router    = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <ScrollView
      style={[layout.fill, { backgroundColor: colors.bg.primary }]}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Nav */}
      <View style={[styles.nav, layout.rowBetween, { borderBottomColor: colors.border.subtle }]}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          <View style={styles.logoBox}>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.xl, color: "#fff" }}>G</Text>
          </View>
          <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: colors.text.primary }}>GMIS</Text>
        </View>
        <View style={[layout.row, { gap: spacing[3] }]}>
          <Button label="Find your school" variant="ghost" size="sm" onPress={() => router.push("/find-school")} />
          <Button label="Get started" variant="primary" size="sm" onPress={() => router.push("/find-school")} />
        </View>
      </View>

      {/* Hero */}
      <View style={[styles.hero, layout.centredH]}>
        <View style={[styles.heroBadge, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
          <View style={styles.liveDot} />
          <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold, letterSpacing: 0.5 }}>
            GMIS Platform · Live
          </Text>
        </View>

        <Text
          style={{
            fontSize:   fontSize["6xl"],
            fontWeight: fontWeight.black,
            color:      colors.text.primary,
            textAlign:  "center",
            lineHeight: fontSize["6xl"] * 1.1,
            maxWidth:   700,
            marginTop:  spacing[4],
          }}
        >
          The future of{" "}
          <Text style={{ fontSize: fontSize["6xl"], fontWeight: fontWeight.black, color: brand.blue }}>
            campus management
          </Text>
        </Text>

        <Text
          variant="body"
          color="secondary"
          align="center"
          style={{ maxWidth: 520, marginTop: spacing[4], lineHeight: 26 }}
        >
          GMIS gives every Nigerian university, polytechnic and college a powerful,
          isolated portal for students, lecturers, admins and parents — built for scale.
        </Text>

        <View style={[layout.row, { gap: spacing[3], marginTop: spacing[6], flexWrap: "wrap", justifyContent: "center" }]}>
          <Button
            label="Find your school →"
            variant="primary"
            size="lg"
            onPress={() => router.push("/find-school")}
          />
          <Button
            label="Register your institution"
            variant="ghost"
            size="lg"
            onPress={() => router.push("/register")}
          />
        </View>

        <Text variant="caption" color="muted" style={{ marginTop: spacing[3] }}>
          Free for students · Schools pay subscription · Zero transaction fees
        </Text>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text variant="heading" color="primary" align="center" style={{ marginBottom: spacing[2] }}>
          Everything your campus needs
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ marginBottom: spacing[8], maxWidth: 480, alignSelf: "center" }}>
          14 student features, 9 admin features, full lecturer and parent portals — all in one platform.
        </Text>

        <View style={styles.featureGrid}>
          {FEATURES.map(({ icon, label, desc }) => (
            <Card key={label} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: brand.blueAlpha10 }]}>
                <Icon name={icon} size="lg" color={brand.blue} />
              </View>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>{label}</Text>
              <Text variant="caption" color="muted">{desc}</Text>
            </Card>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={[styles.cta, layout.centredH, { backgroundColor: brand.blueAlpha5, borderColor: brand.blueAlpha15 }]}>
        <Text variant="title" color="primary" align="center" style={{ marginBottom: spacing[2] }}>
          Ready to get started?
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ marginBottom: spacing[6], maxWidth: 400 }}>
          Search for your institution below, or register your school on GMIS.
        </Text>
        <Button
          label="Find your school →"
          variant="primary"
          size="lg"
          onPress={() => router.push("/find-school")}
        />
      </View>

      {/* Footer */}
      <View style={[styles.footer, layout.centredH, { borderTopColor: colors.border.subtle }]}>
        <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[3] }]}>
          <View style={[styles.logoBox, { width: spacing[6], height: spacing[6] }]}>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.sm, color: "#fff" }}>G</Text>
          </View>
          <Text style={{ fontWeight: fontWeight.bold, color: colors.text.secondary }}>GMIS</Text>
        </View>
        <Text variant="caption" color="muted" align="center">
          A product of{" "}
          <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: brand.gold }}>DAMS Technologies</Text>
          {" "}· Cotonou, Benin Republic · {new Date().getFullYear()}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  nav: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[4],
    borderBottomWidth: 1,
  },
  logoBox: {
    width:           spacing[12],
    height:          spacing[12],
    borderRadius:    radius.xl,
    backgroundColor: brand.blue,
    alignItems:      "center",
    justifyContent:  "center",
  },
  hero: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[16],
  },
  heroBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    borderWidth:       1,
  },
  liveDot: {
    width:           spacing[2],
    height:          spacing[2],
    borderRadius:    radius.full,
    backgroundColor: brand.blue,
  },
  section: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[12],
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           spacing[4],
  },
  featureCard: {
    flex:    1,
    minWidth: 240,
    gap:     spacing[2],
  },
  featureIcon: {
    width:        spacing[10],
    height:       spacing[10],
    borderRadius: radius.lg,
    alignItems:   "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  cta: {
    marginHorizontal: spacing[6],
    padding:          spacing[10],
    borderRadius:     radius["2xl"],
    borderWidth:      1,
    marginBottom:     spacing[12],
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[8],
    borderTopWidth:    1,
  },
});
