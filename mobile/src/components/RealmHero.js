import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, alpha } from "../theme";

// Shared scene header used by the realm's major hubs. It deliberately
// mirrors the kingdom-map composition: compact intelligence at the top,
// a large piece of world art in the middle, and the active screen below.
export default function RealmHero({ source, eyebrow, title, subtitle, badges = [], height = 190 }) {
  return (
    <View style={[styles.hero, { height }]}>
      {source ? (
        <Image source={source} resizeMode="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}
      <LinearGradient
        colors={[alpha(colors.bg, "55"), "transparent", alpha(colors.bg, "ee")]}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.copy}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {!!badges.length && (
        <View style={styles.badges}>
          {badges.map((badge, index) => (
            <View key={`${badge.label}-${index}`} style={styles.badge}>
              <Text style={styles.badgeValue}>{badge.value}</Text>
              <Text style={styles.badgeLabel}>{badge.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.gold, "55"),
    backgroundColor: colors.card,
  },
  fallback: { backgroundColor: colors.cardAlt },
  copy: { position: "absolute", left: 14, right: 14, bottom: 12 },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1.7, textTransform: "uppercase" },
  title: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 2,
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: { color: colors.textDim, fontSize: 11, marginTop: 2, maxWidth: "68%" },
  badges: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 6 },
  badge: {
    minWidth: 62,
    alignItems: "center",
    backgroundColor: alpha(colors.bg, "d9"),
    borderWidth: 1,
    borderColor: alpha(colors.gold, "77"),
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeValue: { color: colors.text, fontSize: 12, fontWeight: "900" },
  badgeLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase", marginTop: 1 },
});
