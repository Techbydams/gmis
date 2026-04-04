// ============================================================
// GMIS — Mobile Onboarding
// Route: /(onboarding)
// Only shown on iOS/Android first launch.
// After completing, stores flag and goes to find-school.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef } from "react";
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

export default function Onboarding() {
  const router        = useRouter();
  const { colors }    = useTheme();
  const [page, setPage] = useState(0);
  const scrollRef     = useRef<ScrollView>(null);

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

  const skip = () => router.replace("/find-school");

  const isLast = page === SLIDES.length - 1;

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
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Icon circle */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: slide.iconColor + "18", borderColor: slide.iconColor + "30" },
              ]}
            >
              <Icon name={slide.icon} size="3xl" color={slide.iconColor} />
            </View>

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
        {/* Dots */}
        <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[6] }]}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <View
                style={[
                  styles.dot,
                  {
                    width:           i === page ? spacing[6] : spacing[2],
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
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    gap:            spacing[5],
  },
  iconCircle: {
    width:        120,
    height:       120,
    borderRadius: 60,
    alignItems:   "center",
    justifyContent: "center",
    borderWidth:  1,
  },
  bottom: {
    paddingHorizontal: spacing[6],
    alignItems:        "center",
  },
  dot: {
    height:       spacing[2],
    borderRadius: radius.full,
    transition:   "width 0.3s" as any,
  },
});
