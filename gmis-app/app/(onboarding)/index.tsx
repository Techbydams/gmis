// ============================================================
// GMIS — Mobile Onboarding
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  icon:       IconName;
  iconColor:  string;
  title:      string;
  body:       string;
}

const SLIDES: OnboardingSlide[] = [
  {
    icon:      "academic-gpa",
    iconColor: brand.blue,
    title:     "Your campus, in your pocket",
    body:      "Access your results, timetable, fees, and more — all from one secure portal built for your institution.",
  },
  {
    icon:      "nav-results",
    iconColor: "#4ade80",
    title:     "Real-time academic records",
    body:      "See your grades the moment they're released. Track your GPA, CGPA, and honour class live.",
  },
  {
    icon:      "nav-payments",
    iconColor: brand.gold,
    title:     "Pay fees securely",
    body:      "All payments go directly to your school via Paystack. GMIS never handles your money.",
  },
  {
    icon:      "nav-chat",
    iconColor: "#a855f7",
    title:     "Stay connected",
    body:      "Chat with classmates in course groups, vote in elections, and follow campus news — all in one place.",
  },
];

// Dot inactive/active widths
const DOT_INACTIVE = spacing[2];  // 8px
const DOT_ACTIVE   = spacing[6];  // 24px

export default function Onboarding() {
  const router        = useRouter();
  const { colors }    = useTheme();
  const [page, setPage] = useState(0);
  const scrollRef     = useRef<ScrollView>(null);

  // ── Dot animations ────────────────────────────────────────
  // One Animated.Value per dot, tracking its width
  const dotAnims = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? DOT_ACTIVE : DOT_INACTIVE)),
  ).current;

  // ── Icon entrance animations ──────────────────────────────
  const iconScale   = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;

  // Animate dots + icon whenever page changes
  useEffect(() => {
    // Dots: each collapses/expands to target width
    const dotAnimations = dotAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue:         i === page ? DOT_ACTIVE : DOT_INACTIVE,
        damping:         20,
        stiffness:       300,
        mass:            0.6,
        useNativeDriver: false,  // width cannot use native driver
      }),
    );

    // Icon: scale from 0.75→1 and fade from 0→1
    iconScale.setValue(0.75);
    iconOpacity.setValue(0);
    const iconAnimation = Animated.parallel([
      Animated.spring(iconScale, {
        toValue:         1,
        damping:         18,
        stiffness:       280,
        mass:            0.7,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([...dotAnimations, iconAnimation]).start();
  }, [page]);

  const goTo = (index: number) => {
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      goTo(page + 1);
    } else {
      router.replace("/find-school");
    }
  };

  const skip  = () => router.replace("/find-school");
  const isLast = page === SLIDES.length - 1;

  const currentSlide = SLIDES[page];

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg.primary }]} edges={["top", "bottom"]}>

      {/* Skip button */}
      <View style={[styles.skipRow, layout.rowEnd]}>
        {!isLast && (
          <TouchableOpacity onPress={skip} activeOpacity={0.7} style={styles.skipBtn}>
            <Text variant="caption" color="muted">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={layout.fill}
        contentContainerStyle={{ width: SCREEN_WIDTH * SLIDES.length }}
        onMomentumScrollEnd={(e) => {
          const newPage = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (newPage !== page) setPage(newPage);
        }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Icon circle — animated on active slide */}
            <Animated.View
              style={[
                styles.iconCircle,
                { backgroundColor: slide.iconColor + "18", borderColor: slide.iconColor + "30" },
                i === page
                  ? { transform: [{ scale: iconScale }], opacity: iconOpacity }
                  : undefined,
              ]}
            >
              <Icon name={slide.icon} size="3xl" color={slide.iconColor} />
            </Animated.View>

            <Text
              variant="heading"
              color="primary"
              align="center"
              style={{ marginBottom: spacing[4], maxWidth: 300 }}
            >
              {slide.title}
            </Text>

            <Text
              variant="body"
              color="secondary"
              align="center"
              style={{ maxWidth: 320, lineHeight: 24 }}
            >
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom area */}
      <View style={[styles.bottom, { paddingBottom: spacing[8] }]}>

        {/* Animated dots */}
        <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[6] }]}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width:           dotAnims[i],
                    backgroundColor: i === page ? brand.blue : colors.border.strong,
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

        {isLast && (
          <Text
            variant="caption"
            color="muted"
            align="center"
            style={{ marginTop: spacing[4] }}
          >
            A product of{" "}
            <Text variant="caption" color="gold" weight="bold">DAMS Technologies</Text>
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skipRow: {
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
  },
  slide: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: spacing[6],
    gap:               spacing[5],
  },
  iconCircle: {
    width:          120,
    height:         120,
    borderRadius:   60,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
  },
  bottom: {
    paddingHorizontal: spacing[6],
    alignItems:        "center",
  },
  dot: {
    height:       spacing[2],
    borderRadius: radius.full,
  },
});
