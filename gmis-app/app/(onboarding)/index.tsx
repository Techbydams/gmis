// ============================================================
// GMIS — Mobile Onboarding (v2)
// Route: /(onboarding)
// Only shown on iOS/Android first launch.
// After completing, stores flag and goes to find-school.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter }    from "expo-router";
import { Text, Button } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme }     from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  icon:       IconName;
  iconColor:  string;
  bg:         string;         // darker tint for the orb
  title:      string;
  body:       string;
  tags:       string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    icon:      "academic-gpa",
    iconColor: brand.blue,
    bg:        "#1a3a8f",
    title:     "Your campus, in your pocket",
    body:      "Access your results, timetable, fees, and more — all from one secure portal built for your institution.",
    tags:      ["Results", "Timetable", "Clearance"],
  },
  {
    icon:      "nav-results",
    iconColor: "#4ade80",
    bg:        "#14532d",
    title:     "Real-time academic records",
    body:      "See your grades the moment they're released. Track your GPA, CGPA, and honour class live.",
    tags:      ["GPA Tracker", "CGPA", "Transcripts"],
  },
  {
    icon:      "nav-payments",
    iconColor: brand.gold,
    bg:        "#713f12",
    title:     "Pay fees securely",
    body:      "All payments go directly to your school via Paystack. GMIS never handles your money.",
    tags:      ["Paystack", "Fee History", "Receipts"],
  },
  {
    icon:      "nav-chat",
    iconColor: "#a855f7",
    bg:        "#3b0764",
    title:     "Stay connected",
    body:      "Chat with classmates in course groups, vote in elections, and follow campus news.",
    tags:      ["Group Chat", "Voting", "News Feed"],
  },
];

const DOT_INACTIVE = spacing[2];   // 8px
const DOT_ACTIVE   = 28;           // no spacing[7] — skips from 6→8

export default function Onboarding() {
  const router          = useRouter();
  const { colors, isDark } = useTheme();
  const GMIS_LOGO       = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;
  const [page, setPage] = useState(0);
  const scrollRef       = useRef<ScrollView>(null);

  // Per-dot width animations
  const dotAnims = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? DOT_ACTIVE : DOT_INACTIVE)),
  ).current;

  // Icon entrance: scale + opacity
  const iconScale   = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;

  // Orb pulse
  const orbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Dots
    const dotAnimations = dotAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue:         i === page ? DOT_ACTIVE : DOT_INACTIVE,
        damping:         22,
        stiffness:       320,
        mass:            0.6,
        useNativeDriver: false,
      }),
    );

    // Icon entrance
    iconScale.setValue(0.7);
    iconOpacity.setValue(0);
    const iconIn = Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1, damping: 18, stiffness: 260, mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }),
    ]);

    // Orb gentle pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1.00, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    Animated.parallel([...dotAnimations, iconIn]).start();
  }, [page]);

  const goTo = (index: number) => {
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const next = () => {
    if (page < SLIDES.length - 1) goTo(page + 1);
    else router.replace("/find-school");
  };

  const skip   = () => router.replace("/find-school");
  const isLast = page === SLIDES.length - 1;
  const slide  = SLIDES[page];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg.primary }]} edges={["top", "bottom"]}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, layout.rowBetween]}>
        <Image source={GMIS_LOGO} style={styles.logo} resizeMode="contain" />
        {!isLast && (
          <TouchableOpacity onPress={skip} activeOpacity={0.7} style={styles.skipBtn}>
            <Text variant="caption" color="muted">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Slides ─────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={Platform.OS !== "web"}
        showsHorizontalScrollIndicator={false}
        style={layout.fill}
        contentContainerStyle={{ width: SCREEN_WIDTH * SLIDES.length }}
        onMomentumScrollEnd={(e) => {
          const np = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (np !== page) setPage(np);
        }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>

            {/* Background orb — decorative */}
            <Animated.View
              style={[
                styles.orb,
                { backgroundColor: s.bg, transform: [{ scale: i === page ? orbScale : 1 }] },
              ]}
            />

            {/* Icon circle */}
            <Animated.View
              style={[
                styles.iconCircle,
                { backgroundColor: s.iconColor + "1a", borderColor: s.iconColor + "40" },
                i === page && { transform: [{ scale: iconScale }], opacity: iconOpacity },
              ]}
            >
              {/* Inner glow ring */}
              <View style={[styles.iconGlow, { backgroundColor: s.iconColor + "12" }]} />
              <Icon name={s.icon} size="3xl" color={s.iconColor} />
            </Animated.View>

            {/* Feature tags */}
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap", justifyContent: "center" }]}>
              {s.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: s.iconColor + "18", borderColor: s.iconColor + "35" }]}>
                  <Text style={{ fontSize: fontSize.xs, color: s.iconColor, fontWeight: fontWeight.semibold }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
              <Text variant="heading" color="primary" align="center" style={{ marginBottom: spacing[3] }}>
                {s.title}
              </Text>
              <Text variant="body" color="secondary" align="center" style={{ lineHeight: 26 }}>
                {s.body}
              </Text>
            </View>

          </View>
        ))}
      </ScrollView>

      {/* ── Bottom ─────────────────────────────────────────── */}
      <View style={styles.bottom}>

        {/* Progress dots */}
        <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width:           dotAnims[i],
                    backgroundColor: i === page ? SLIDES[i].iconColor : colors.border.strong,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <Button
          label={isLast ? "Find your school →" : "Next"}
          variant="primary"
          size="lg"
          full
          onPress={next}
          iconRight={isLast ? undefined : "ui-forward"}
        />

        {/* Footer credit */}
        <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[5] }}>
          {isLast
            ? <Text variant="micro" color="muted">A product of <Text variant="micro" color="gold" weight="bold">DAMS Technologies</Text></Text>
            : `${page + 1} of ${SLIDES.length}`
          }
        </Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
  },
  logo: {
    width:  80,
    height: 28,
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
  },

  slide: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: spacing[8],
    gap:               spacing[5],
    overflow:          "hidden",
  },

  // Background decorative orb
  orb: {
    position:     "absolute",
    width:        280,
    height:       280,
    borderRadius: 140,
    opacity:      0.18,
    top:          "10%",
  },

  iconCircle: {
    width:          156,
    height:         156,
    borderRadius:   78,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1.5,
  },
  iconGlow: {
    position:     "absolute",
    width:        120,
    height:       120,
    borderRadius: 60,
  },

  tag: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
    borderRadius:      radius.full,
    borderWidth:       1,
  },

  textBlock: {
    alignItems: "center",
    maxWidth:   320,
  },

  bottom: {
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[8],
    alignItems:        "center",
  },

  dot: {
    height:       spacing[2],
    borderRadius: radius.full,
  },
});
