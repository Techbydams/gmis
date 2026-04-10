// ============================================================
// GMIS — Find School (FIXED)
//
// KEY FIXES:
//  1. Search query now includes supabase_url + supabase_anon_key
//     so we have everything we need in one query
//  2. Uses setTenantFromOrg() instead of setTenantSlug()
//     = zero second DB query = no more infinite spinner
//  3. SafeAreaView + KeyboardAvoidingView for mobile
//  4. Properly centred on all screen sizes
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef, useEffect } from "react";
import {
  View,
  Animated,
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
import { Text, Input, Button, Card } from "@/components/ui";
import { Icon }       from "@/components/ui/Icon";
import { useTheme }   from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import type { Organization } from "@/types";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type FindAction = "login" | "signup";

function isLocalDev(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h.includes("192.168") || h.includes("10.");
  } catch { return false; }
}

export default function FindSchool() {
  const router               = useRouter();
  const { setTenantFromOrg } = useTenant();
  const { colors }           = useTheme();
  const { isMobile, pagePadding } = useResponsive();

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState<Organization[]>([]);
  const [selected,    setSelected]    = useState<Organization | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [navigating,  setNavigating]  = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [action,      setAction]      = useState<FindAction>("login");
  const [error,       setError]       = useState<string | null>(null);

  // ── Logo entrance animation ──────────────────────────────
  const logoScale   = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, damping: 16, stiffness: 220, mass: 0.8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Connecting screen pulse animation ────────────────────
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!navigating) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1.35, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0,    duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1, duration: 0,   useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [navigating]);

  // ── Action tab sliding pill ───────────────────────────────
  const [tabsWidth,    setTabsWidth]    = useState(0);
  const actionPillX    = useRef(new Animated.Value(0)).current;
  const actionInitRef  = useRef(false);

  useEffect(() => {
    if (tabsWidth === 0) return;
    const idx    = action === "login" ? 0 : 1;
    const tabW   = (tabsWidth - 8) / 2;
    const target = idx * tabW + 4;
    if (!actionInitRef.current) {
      actionPillX.setValue(target);
      actionInitRef.current = true;
    } else {
      Animated.spring(actionPillX, {
        toValue: target, damping: 22, stiffness: 300, mass: 0.7, useNativeDriver: false,
      }).start();
    }
  }, [action, tabsWidth]);

  // ── Search — includes credentials in one query ─────────
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSelected(null);
    setNotFound(false);
    setResults([]);
    setError(null);

    // Include supabase_url + supabase_anon_key so we don't need a second query
    const { data, error: searchError } = await supabase
      .from("organizations")
      .select("id, name, slug, type, logo_url, status, supabase_url, supabase_anon_key")
      .eq("status", "approved")
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
      .limit(8);

    setLoading(false);

    if (searchError) {
      setError("Could not search schools. Check your connection.");
      return;
    }
    if (!data?.length) { setNotFound(true); return; }
    if (data.length === 1) setSelected(data[0] as Organization);
    else setResults(data as Organization[]);
  };

  // ── Navigate to school portal ───────────────────────────
  const handleRedirect = async (org: Organization) => {
    setSelected(org);
    setResults([]);
    setNavigating(true);
    setError(null);

    const useInAppNav = Platform.OS !== "web" || isLocalDev();

    if (useInAppNav) {
      // Mobile or localhost: use in-app navigation
      // setTenantFromOrg does NOT make a second DB query
      try {
        await setTenantFromOrg(org);
        // Navigate immediately — tenant is now set
        router.replace(action === "signup" ? "/(tenant)/signup" : "/(tenant)/login");
      } catch (err) {
        console.error("Failed to set tenant:", err);
        setError("Could not connect to school portal. Please try again.");
        setNavigating(false);
      }
    } else {
      // Production web: subdomain redirect
      setTimeout(() => {
        redirectToTenant(org.slug, action === "signup" ? "/signup" : "/login");
      }, 1200);
    }
  };

  // ── Navigating screen ───────────────────────────────────
  if (navigating && selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          {/* Animated pulse ring */}
          <View style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              style={{
                position:        "absolute",
                width:           88,
                height:          88,
                borderRadius:    44,
                backgroundColor: brand.blueAlpha15,
                transform:       [{ scale: pulseScale }],
                opacity:         pulseOpacity,
              }}
            />
            <View style={[styles.logoBox, { width: 64, height: 64, borderRadius: radius.xl }]}>
              <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.xl, color: "#fff" }}>G</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing[6], alignItems: "center" }}>
            <Text variant="caption" color="muted" style={{ marginBottom: spacing[2] }}>
              Connecting to
            </Text>
            <Text
              style={{
                fontSize:   isMobile ? fontSize["2xl"] : fontSize["3xl"],
                fontWeight: fontWeight.black,
                color:      brand.blue,
                textAlign:  "center",
              }}
            >
              {selected.name}
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
              {selected.slug}.gmis.app
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={layout.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: pagePadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>

            {/* Logo + title — entrance animation */}
            <Animated.View
              style={[layout.centredH, { marginBottom: spacing[6], transform: [{ scale: logoScale }], opacity: logoOpacity }]}
            >
              <TouchableOpacity
                onPress={() => router.canGoBack() ? router.back() : null}
                style={[styles.logoBox, { marginBottom: spacing[5] }]}
                activeOpacity={0.8}
              >
                <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.xl, color: "#fff" }}>G</Text>
              </TouchableOpacity>

              <Text variant="title" color="primary" align="center">Find your institution</Text>
              <Text
                variant="caption"
                color="muted"
                align="center"
                style={{ marginTop: spacing[2], maxWidth: 280, lineHeight: 20 }}
              >
                Search your school to access your portal
              </Text>
            </Animated.View>

            {/* Login / Signup toggle — sliding pill */}
            <View
              style={[styles.actionTabs, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
              onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
            >
              {tabsWidth > 0 && (
                <Animated.View
                  style={[
                    styles.actionTabPill,
                    { width: (tabsWidth - 8) / 2, transform: [{ translateX: actionPillX }] },
                  ]}
                  pointerEvents="none"
                />
              )}
              {(["login", "signup"] as FindAction[]).map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setAction(id)}
                  style={[styles.actionTab]}
                  activeOpacity={0.85}
                >
                  <Icon name={id === "login" ? "status-locked" : "action-add"} size="xs" color={action === id ? "#fff" : colors.text.muted} />
                  <Text style={{ fontSize: fontSize.sm, fontWeight: action === id ? fontWeight.bold : fontWeight.normal, color: action === id ? "#fff" : colors.text.muted, marginLeft: spacing[1] }}>
                    {id === "login" ? "Sign in" : "Register"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Connection error */}
            {error && (
              <Card variant="error" style={{ marginBottom: spacing[3] }}>
                <View style={[layout.row, { gap: spacing[2] }]}>
                  <Icon name="status-error" size="sm" color={colors.status.error} />
                  <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.error }}>{error}</Text>
                </View>
              </Card>
            )}

            {/* Search */}
            <Card>
              <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[2] }}>
                Institution name or slug
              </Text>

              <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[3] }]}>
                <View style={layout.fill}>
                  <Input
                    value={query}
                    onChangeText={(v) => { setQuery(v); setNotFound(false); setError(null); }}
                    onSubmitEditing={search}
                    placeholder="e.g. ESTAM University"
                    iconLeft="action-search"
                    returnKeyType="search"
                    containerStyle={{ marginBottom: 0 }}
                    autoCapitalize="none"
                  />
                </View>
                <Button label="Search" variant="primary" size="md" loading={loading} onPress={search} />
              </View>

              {/* Results list */}
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
                      <View style={[styles.initials, { backgroundColor: brand.blueAlpha15 }]}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>
                          {org.slug.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{org.name}</Text>
                        <Text variant="micro" color="muted">{org.slug}.gmis.app</Text>
                      </View>
                      <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Single result / selected */}
              {selected && (
                <View style={[styles.selectedCard, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
                  <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[4] }]}>
                    <View style={[styles.initialsLg, { backgroundColor: brand.blueAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: brand.blue }}>
                        {selected.slug.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="subtitle" weight="bold" color="primary">{selected.name}</Text>
                      <View style={[layout.row, { gap: spacing[1], marginTop: spacing[1] }]}>
                        <View style={[styles.greenDot]} />
                        <Text style={{ fontSize: fontSize.xs, color: "#4ade80", fontWeight: fontWeight.semibold }}>
                          {selected.slug}.gmis.app
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Button
                    label={action === "signup" ? `Create account at ${selected.name}` : `Sign in to ${selected.name}`}
                    variant="primary"
                    size="md"
                    full
                    iconRight="ui-forward"
                    onPress={() => handleRedirect(selected)}
                  />

                  <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                    Your data stays in {selected.name}'s secure isolated portal
                  </Text>
                </View>
              )}

              {/* Not found */}
              {notFound && (
                <View style={[styles.notFound, { backgroundColor: colors.status.warningBg, borderColor: colors.status.warningBorder }]}>
                  <Text variant="label" color="warning" weight="semibold" style={{ marginBottom: spacing[1] }}>School not found</Text>
                  <Text variant="caption" color="warning" style={{ marginBottom: spacing[3] }}>
                    "{query}" is not on GMIS yet.
                  </Text>
                  <Button label="Register your institution →" variant="secondary" size="sm" onPress={() => router.push("/register" as any)} />
                </View>
              )}
            </Card>

            {/* Register link */}
            <View style={[layout.centredH, { marginTop: spacing[4], marginBottom: spacing[4] }]}>
              <Text variant="caption" color="muted">
                Not listed?{" "}
                <Text variant="caption" color="link" weight="bold" onPress={() => router.push("/register" as any)}>
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
    flexGrow:       1,
    justifyContent: "center",
    paddingVertical: spacing[8],
  },
  inner: {
    width:     "100%",
    maxWidth:  460,
    alignSelf: "center",
  },
  logoBox: {
    width:           spacing[12] + spacing[2],
    height:          spacing[12] + spacing[2],
    borderRadius:    radius.xl,
    backgroundColor: brand.blue,
    alignItems:      "center",
    justifyContent:  "center",
  },
  actionTabs: {
    flexDirection: "row",
    borderRadius:  radius.xl,
    borderWidth:   1,
    padding:       spacing[1],
    marginBottom:  spacing[5],
    position:      "relative",
  },
  actionTabPill: {
    position:        "absolute",
    top:             spacing[1],
    bottom:          spacing[1],
    borderRadius:    radius.lg,
    backgroundColor: brand.blue,
  },
  actionTab: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: spacing[3],
    borderRadius:    radius.lg,
    gap:             spacing[1],
    zIndex:          1,
  },
  resultsList: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", marginBottom: spacing[3] },
  resultItem:  { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  initials:    { width: spacing[10], height: spacing[10], borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  initialsLg:  { width: spacing[12], height: spacing[12], borderRadius: radius.lg, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  selectedCard:{ padding: spacing[4], borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing[3] },
  greenDot:    { width: spacing[1] + 1, height: spacing[1] + 1, borderRadius: radius.full, backgroundColor: "#4ade80" },
  notFound:    { padding: spacing[4], borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing[3] },
});
