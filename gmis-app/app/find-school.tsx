// ============================================================
// GMIS — Find School
// Route: /find-school
//
// FIXES:
//  - SafeAreaView for mobile (notch, home bar awareness)
//  - KeyboardAvoidingView so keyboard doesn't cover input
//  - Redirect logic: localhost/native = setTenantSlug + navigate
//                    production web   = subdomain redirect
//  - Layout centred properly on all screen sizes
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter }    from "expo-router";
import { supabase }         from "@/lib/supabase";
import { useTenant }        from "@/context/TenantContext";
import { redirectToTenant } from "@/lib/helpers";
import {
  Text, Input, Button, Card, Spinner,
} from "@/components/ui";
import { Icon }      from "@/components/ui/Icon";
import { useTheme }  from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import type { Organization } from "@/types";
import {
  brand, spacing, radius, fontSize, fontWeight,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

type FindAction = "login" | "signup";

// ── Detect if running on localhost ────────────────────────
function isLocalDev(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168") || h.startsWith("10.");
  } catch { return false; }
}

export default function FindSchool() {
  const router            = useRouter();
  const { setTenantSlug } = useTenant();
  const { colors }        = useTheme();
  const { isMobile, pagePadding } = useResponsive();

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState<Organization[]>([]);
  const [selected,    setSelected]    = useState<Organization | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [action,      setAction]      = useState<FindAction>("login");

  // ── Search ──────────────────────────────────────────────
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSelected(null);
    setNotFound(false);
    setResults([]);

    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, type, logo_url, status")
      .eq("status", "approved")
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
      .limit(5);

    setLoading(false);

    if (error || !data?.length) { setNotFound(true); return; }
    if (data.length === 1) setSelected(data[0] as Organization);
    else setResults(data as Organization[]);
  };

  // ── Redirect / Navigate ─────────────────────────────────
  const handleRedirect = async (org: Organization) => {
    setSelected(org);
    setResults([]);
    setRedirecting(true);

    const useNativeNav = Platform.OS !== "web" || isLocalDev();

    if (useNativeNav) {
      // Mobile OR localhost dev: set context and navigate directly
      // No subdomain redirect — that only works on production web
      try {
        await setTenantSlug(org.slug);
        // Small delay so the redirecting animation shows
        setTimeout(() => {
          if (action === "signup") {
            router.replace("/(tenant)/signup");
          } else {
            router.replace("/(tenant)/login");
          }
        }, 800);
      } catch (err) {
        console.error("Failed to set tenant:", err);
        setRedirecting(false);
      }
    } else {
      // Production web: redirect to subdomain
      setTimeout(() => {
        redirectToTenant(org.slug, action === "signup" ? "/signup" : "/login");
      }, 1500);
    }
  };

  // ── Redirecting screen ──────────────────────────────────
  if (redirecting && selected) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg.primary }]}>
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          <Spinner size="lg" />
          <View style={{ marginTop: spacing[6], alignItems: "center" }}>
            <Text variant="caption" color="muted" style={{ marginBottom: spacing[2] }}>
              Connecting you to
            </Text>
            <Text
              style={{
                fontSize:   isMobile ? fontSize["2xl"] : fontSize["3xl"],
                fontWeight: fontWeight.black,
                color:      brand.blue,
              }}
            >
              {selected.slug}.gmis.app
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing[2] }}>
              {selected.name}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg.primary }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={layout.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: pagePadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Centre wrapper — works on all screen sizes */}
          <View style={styles.inner}>

            {/* Logo + header */}
            <View style={[layout.centredH, { marginBottom: spacing[6] }]}>
              <TouchableOpacity
                onPress={() => router.push("/")}
                style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]}
                activeOpacity={0.7}
              >
                <View style={styles.logoBox}>
                  <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.xl, color: "#fff" }}>G</Text>
                </View>
                <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: colors.text.primary }}>
                  GMIS
                </Text>
              </TouchableOpacity>

              <Text variant="title" color="primary" align="center">Find your institution</Text>
              <Text
                variant="caption"
                color="muted"
                align="center"
                style={{ marginTop: spacing[2], maxWidth: 300 }}
              >
                Type your school name and we'll take you to your portal
              </Text>
            </View>

            {/* Login / Signup toggle */}
            <View
              style={[
                styles.actionTabs,
                { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT },
              ]}
            >
              {(["login", "signup"] as FindAction[]).map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setAction(id)}
                  style={[styles.actionTab, action === id && { backgroundColor: brand.blue }]}
                  activeOpacity={0.75}
                >
                  <Icon
                    name={id === "login" ? "status-locked" : "action-add"}
                    size="xs"
                    color={action === id ? "#fff" : colors.text.muted}
                  />
                  <Text
                    style={{
                      fontSize:   fontSize.sm,
                      fontWeight: action === id ? fontWeight.bold : fontWeight.normal,
                      color:      action === id ? "#fff" : colors.text.muted,
                      marginLeft: spacing[1],
                    }}
                  >
                    {id === "login" ? "Sign in" : "Create account"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search card */}
            <Card>
              <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[2] }}>
                School or institution name
              </Text>

              {/* Search row */}
              <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                <View style={layout.fill}>
                  <Input
                    value={query}
                    onChangeText={(v) => { setQuery(v); setNotFound(false); setResults([]); setSelected(null); }}
                    onSubmitEditing={search}
                    placeholder="e.g. ESTAM University, Unilag..."
                    iconLeft="action-search"
                    returnKeyType="search"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
                <Button
                  label="Search"
                  variant="primary"
                  size="md"
                  loading={loading}
                  onPress={search}
                />
              </View>

              {/* Results */}
              {results.length > 0 && (
                <View style={[styles.resultsList, { borderColor: colors.border.DEFAULT }]}>
                  {results.map((org, i) => (
                    <TouchableOpacity
                      key={org.id}
                      onPress={() => handleRedirect(org)}
                      activeOpacity={0.75}
                      style={[
                        styles.resultItem,
                        i < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                        { backgroundColor: colors.bg.hover },
                      ]}
                    >
                      <View style={[styles.orgInitials, { backgroundColor: brand.blueAlpha15 }]}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>
                          {org.slug.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary">{org.name}</Text>
                        <Text variant="micro" color="muted">{org.slug}.gmis.app</Text>
                      </View>
                      <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected school */}
              {selected && (
                <View style={[styles.selectedCard, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
                  <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                    <View style={[styles.orgInitialsLg, { backgroundColor: brand.blueAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: brand.blue }}>
                        {selected.slug.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="subtitle" weight="bold" color="primary">{selected.name}</Text>
                      <View style={[layout.row, { gap: spacing[1], marginTop: spacing[1] }]}>
                        <View style={styles.greenDot} />
                        <Text style={{ fontSize: fontSize.xs, color: "#4ade80", fontWeight: fontWeight.semibold }}>
                          {selected.slug}.gmis.app
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Button
                    label={action === "signup" ? `Create account at ${selected.name} →` : `Sign in to ${selected.name} →`}
                    variant="primary"
                    size="md"
                    full
                    onPress={() => handleRedirect(selected)}
                  />
                  <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                    Your data stays isolated to your school's secure portal
                  </Text>
                </View>
              )}

              {/* Not found */}
              {notFound && (
                <View style={[styles.notFoundCard, { backgroundColor: colors.status.warningBg, borderColor: colors.status.warningBorder }]}>
                  <Text variant="label" color="warning" weight="semibold" style={{ marginBottom: spacing[1] }}>
                    School not found
                  </Text>
                  <Text variant="caption" color="warning" style={{ marginBottom: spacing[3] }}>
                    "{query}" is not registered on GMIS yet.
                  </Text>
                  <Button label="Register your institution →" variant="secondary" size="sm" onPress={() => router.push("/register")} />
                </View>
              )}

              {/* Popular schools placeholder */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, marginTop: spacing[4], paddingTop: spacing[4] }}>
                <Text
                  style={{
                    fontSize:      fontSize["2xs"],
                    fontWeight:    fontWeight.bold,
                    color:         colors.text.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    marginBottom:  spacing[2],
                  }}
                >
                  Popular institutions
                </Text>
                <Text variant="caption" color="muted">Schools will appear here once they register on GMIS.</Text>
              </View>
            </Card>

            {/* Register link */}
            <View style={[layout.centredH, { marginTop: spacing[4] }]}>
              <Text variant="caption" color="muted">
                School not listed?{" "}
                <Text variant="caption" color="link" weight="bold" onPress={() => router.push("/register")}>
                  Register on GMIS →
                </Text>
              </Text>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",  // centres content vertically when shorter than screen
  },
  inner: {
    width:     "100%",
    maxWidth:  480,
    alignSelf: "center",      // always horizontally centred
  },
  logoBox: {
    width:           spacing[12],
    height:          spacing[12],
    borderRadius:    radius.xl,
    backgroundColor: brand.blue,
    alignItems:      "center",
    justifyContent:  "center",
  },
  actionTabs: {
    flexDirection:  "row",
    borderRadius:   radius.xl,
    borderWidth:    1,
    padding:        spacing[1],
    marginBottom:   spacing[5],
    gap:            spacing[1],
  },
  actionTab: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: spacing[3],
    borderRadius:    radius.lg,
    gap:             spacing[1],
  },
  resultsList: {
    borderRadius:  radius.lg,
    borderWidth:   1,
    overflow:      "hidden",
    marginBottom:  spacing[3],
  },
  resultItem: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
  },
  orgInitials: {
    width:          spacing[10] - spacing[1],
    height:         spacing[10] - spacing[1],
    borderRadius:   radius.md,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  orgInitialsLg: {
    width:          spacing[12],
    height:         spacing[12],
    borderRadius:   radius.lg,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  selectedCard: {
    padding:      spacing[4],
    borderRadius: radius.xl,
    borderWidth:  1,
    marginBottom: spacing[3],
  },
  greenDot: {
    width:           spacing[1] + 1,
    height:          spacing[1] + 1,
    borderRadius:    radius.full,
    backgroundColor: "#4ade80",
  },
  notFoundCard: {
    padding:      spacing[4],
    borderRadius: radius.xl,
    borderWidth:  1,
    marginBottom: spacing[3],
  },
});
