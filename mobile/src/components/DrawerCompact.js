// Building blocks for collapsed-drawer layouts. Every GameHubShell drawer
// follows the same contract: collapsed shows a FIXED aggregated summary of
// that system (status + the primary action, sized so overflow is a scroll
// fallback rather than a cut-off), expanded shows the full detail UI.
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { DrawerExpandHint } from "./GameHubShell";
import { colors } from "../theme";

// Standard frame for a collapsed layout: content, spacer, expand hint.
// The ScrollView cannot scroll when the content fits (the normal case);
// on a squat viewport it scrolls instead of amputating the action button.
export function CompactShell({ hint = "Pull up for details", children }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {children}
      <View style={{ flex: 1 }} />
      <DrawerExpandHint label={hint} />
    </ScrollView>
  );
}

// Row of small labeled stats (rank / power / range, gold / slots / …).
// items: [{ value, label, color? }]
export function StatStrip({ items }) {
  return (
    <View style={styles.strip}>
      {items.map((item, i) => (
        <React.Fragment key={item.label || i}>
          {i > 0 && <View style={styles.stripDivider} />}
          <View style={styles.stripItem}>
            <Text style={[styles.stripValue, item.color != null && { color: item.color }]} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={styles.stripLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// One-line dim annotation under a strip ("Pikemen ×40 · Archers ×12").
export function CompactNote({ children, color }) {
  return (
    <Text style={[styles.note, color != null && { color }]} numberOfLines={2}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 3, gap: 6 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  stripItem: { flex: 1, alignItems: "center", minWidth: 0, paddingHorizontal: 2 },
  stripValue: { color: colors.text, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stripLabel: { color: colors.muted, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  stripDivider: { width: 1, height: 16, backgroundColor: colors.border },
  note: { color: colors.muted, fontSize: 10, textAlign: "center" },
});
