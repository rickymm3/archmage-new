import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import HScroll from "./HScroll";
import { useTutorialRegistry } from "./TutorialTarget";
import { colors, spacing, radius, type, alpha } from "../theme";

const NATIVE_DRIVER = Platform.OS !== "web";

// ── Scene background ───────────────────────────────────────────────
// Full-screen building-interior art behind a screen's UI. The image is
// overscanned (cover-cropped) so it fills any aspect ratio; scrims keep
// the header zone and the scrolling lower half readable regardless of
// where the crop lands. Render as the FIRST child of a screen container.

export function SceneBackground({ source }) {
  if (!source) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={source} resizeMode="cover" style={StyleSheet.absoluteFill} />
      {/* top scrim: HUD/header readability */}
      <LinearGradient
        colors={[alpha(colors.bg, "99"), alpha(colors.bg, "00")]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%" }}
      />
      {/* bottom scrim: fades the floor into the app background under UI,
          starting low enough to leave the scene's hero band untouched */}
      <LinearGradient
        colors={[alpha(colors.bg, "00"), alpha(colors.bg, "8c"), alpha(colors.bg, "e0")]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", top: "48%", left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

/**
 * Shared UI primitives. Every screen composes these instead of
 * re-declaring the same card/section/loading styles.
 */

// ── Layout ─────────────────────────────────────────────────────────

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right, style }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, style]}>{children}</Text>
      {right}
    </View>
  );
}

// ── States ─────────────────────────────────────────────────────────

export function LoadingState({ label = "Loading..." }) {
  return (
    <View style={styles.stateContainer}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = "🌫", title, subtitle }) {
  return (
    <View style={styles.stateContainer}>
      <Text style={styles.stateIcon}>{icon}</Text>
      <Text style={styles.stateTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stateText}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Widgets ────────────────────────────────────────────────────────

export function ProgressBar({ percent, color = colors.accent, height = 6, style }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const anim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation
    }).start();
  }, [pct]);

  return (
    <View style={[styles.progressBg, { height, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

// ── Motion primitives ──────────────────────────────────────────────

// Touchable that springs down on press — the single biggest "this is a
// game, not a webpage" signal. Drop-in for TouchableOpacity.
export const PressableScale = React.forwardRef(function PressableScale(
  { children, style, containerStyle, onPress, disabled, scaleTo = 0.94, ...rest },
  ref
) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 8, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <Pressable
      ref={ref}
      style={containerStyle}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
});

// Content that fades + slides up on mount. Key it by the active sub-tab
// so every section switch replays the entrance.
export function FadeSlideIn({ children, style, duration = 200 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(translate, { toValue: 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY: translate }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function StatItem({ label, value, icon }) {
  return (
    <View style={styles.statItem}>
      {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Badge({ label, color = colors.accent, style }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: alpha(color, "22"), borderColor: color },
        style,
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, color = colors.accent, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, { backgroundColor: color }, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Sub-tab bar ────────────────────────────────────────────────────
// Slim segmented menu pinned to the bottom of a screen, directly above
// the main tab bar — switches sub-views without pushing new screens.

export function SubTabs({ tabs, active, onChange }) {
  const registry = useTutorialRegistry();
  const isScrollable = tabs.length > 8;
  const isDense = tabs.length > 5 && tabs.length <= 8;
  const usesQuarterSlots = !isScrollable && tabs.length < 5;
  const buttons = tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <PressableScale
            key={t.key}
            ref={registry ? registry.refFor(`subtab:${t.key}`) : undefined}
            containerStyle={isScrollable ? styles.scrollTabSlot : usesQuarterSlots ? styles.quarterTabSlot : { flex: 1 }}
            style={[styles.subTab, isDense && styles.subTabDense, isActive && styles.subTabActive]}
            onPress={() => onChange(t.key)}
            scaleTo={0.9}
          >
            {t.iconSource ? (
              <Image source={t.iconSource} resizeMode="contain" style={[styles.subTabIconImage, isDense && styles.subTabIconImageDense, !isActive && styles.subTabIconMuted]} />
            ) : (
              <Text style={[styles.subTabIcon, !isActive && styles.subTabIconMuted]}>{t.icon}</Text>
            )}
            <Text style={[styles.subTabLabel, isDense && styles.subTabLabelDense, isActive && styles.subTabLabelActive]}>
              {t.label}
            </Text>
            {t.badge ? (
              <View style={styles.subTabBadge}>
                <Text style={styles.subTabBadgeTxt}>{t.badge}</Text>
              </View>
            ) : null}
          </PressableScale>
        );
      });

  if (isScrollable) {
    return (
      <HScroll
        style={styles.subTabsScroll}
        contentContainerStyle={[styles.subTabs, isDense && styles.subTabsDense]}
      >
        {buttons}
      </HScroll>
    );
  }

  return (
    <View style={[styles.subTabs, isDense && styles.subTabsDense]}>{buttons}</View>
  );
}

// ── Art placeholder ────────────────────────────────────────────────
// Marks a slot where real artwork will eventually go. The dashed
// border + ART tag make the slots easy to find and replace with
// <Image> once assets exist.

export function ArtPlaceholder({
  emoji = "🎨",
  label,
  size = 56,
  aspect,           // e.g. 16/9 for a banner; overrides square sizing
  rounded = true,
  source,           // require()'d image; when set, renders the real art
  resizeMode,       // override; defaults to "cover" for banners, "contain" for icons
  style,
}) {
  const shape = aspect
    ? { width: "100%", aspectRatio: aspect }
    : { width: size, height: size };
  const br = rounded ? radius.lg : 0;

  // Real artwork provided — render it instead of the dashed placeholder.
  if (source) {
    return (
      <Image
        source={source}
        resizeMode={resizeMode || (aspect ? "cover" : "contain")}
        style={[shape, { borderRadius: br }, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.artSlot,
        shape,
        { borderRadius: br },
        style,
      ]}
    >
      <Text style={{ fontSize: aspect ? 40 : size * 0.5 }}>{emoji}</Text>
      {label ? <Text style={styles.artLabel}>{label}</Text> : null}
      <Text style={styles.artTag}>ART</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: type.section,
    fontWeight: "600",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 160,
  },
  stateIcon: { fontSize: 40, marginBottom: spacing.sm },
  stateTitle: {
    color: colors.text,
    fontSize: type.section,
    fontWeight: "600",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: type.body,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  progressBg: {
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  progressFill: { height: "100%" },
  statItem: { alignItems: "center", flex: 1 },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statValue: { color: colors.text, fontSize: type.section, fontWeight: "bold" },
  statLabel: { color: colors.muted, fontSize: type.tiny, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontSize: type.body, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  artSlot: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artLabel: { color: colors.muted, fontSize: type.tiny, marginTop: 2 },
  artTag: {
    position: "absolute",
    top: 3,
    right: 5,
    color: alpha(colors.accent, "99"),
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subTabs: {
    flexDirection: "row",
    height: 68,
    justifyContent: "center",
    backgroundColor: alpha("#090711", "f5"),
    borderTopWidth: 2,
    borderTopColor: alpha(colors.goldDim, "88"),
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 3,
  },
  subTabsDense: { paddingHorizontal: 2, gap: 1 },
  subTabsScroll: { flexGrow: 0, height: 68, backgroundColor: alpha("#090711", "f5") },
  scrollTabSlot: { width: 68, height: 62 },
  quarterTabSlot: { width: "24%", height: 62 },
  subTab: {
    height: 62,
    overflow: "hidden",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 3,
    backgroundColor: alpha("#171224", "f0"),
    borderWidth: 1,
    borderColor: alpha(colors.goldDim, "55"),
    borderRadius: 7,
  },
  subTabDense: { paddingHorizontal: 0, borderRadius: 5 },
  subTabActive: {
    backgroundColor: alpha("#3b2452", "f2"),
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  subTabIconImage: { zIndex: 2, width: 35, height: 35, marginBottom: -2 },
  subTabIcon: { zIndex: 2, fontSize: 22, lineHeight: 34 },
  subTabIconMuted: { opacity: 0.72 },
  subTabIconImageDense: { width: 28, height: 28, marginBottom: 0 },
  subTabLabel: {
    zIndex: 2,
    color: colors.textDim,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: colors.black,
    textShadowRadius: 4,
  },
  subTabLabelDense: { fontSize: 6.5, lineHeight: 8, letterSpacing: -0.15 },
  subTabLabelActive: { color: colors.gold },
  subTabBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    zIndex: 3,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  subTabBadgeTxt: { color: colors.white, fontSize: 9, fontWeight: "800" },
});
