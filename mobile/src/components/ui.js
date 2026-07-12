import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, radius, type, alpha } from "../theme";

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
  return (
    <View style={[styles.progressBg, { height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
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
});
