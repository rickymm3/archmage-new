import React, { useState } from "react";
import { colors, alpha } from "../theme";
import { ArtPlaceholder } from "../components/ui";
import { ui as art } from "../assets";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const TYPE_ICONS = {
  infantry: "🗡",
  cavalry: "🐎",
  ranged: "🏹",
  flying: "🦅",
  magic: "✨",
  hero: "👑",
};
const ELEM_COLORS = {
  fire: colors.danger,
  water: colors.info,
  nature: colors.success,
  holy: colors.gold,
  void: colors.arcane,
  physical: colors.textDim,
};

export default function BattleResultScreen({ route, navigation }) {
  // `viewer` is "attacker" (default, post-attack flow) or "defender"
  // (viewing a battle report from a notification).
  const { result, viewer = "attacker" } = route.params;
  const [logExpanded, setLogExpanded] = useState(true);

  const isVictory = result.outcome === viewer;
  const landSeized = result.land_seized || 0;

  const yourArmy = viewer === "attacker" ? result.attacker_army : result.defender_army;
  const enemyArmy = viewer === "attacker" ? result.defender_army : result.attacker_army;
  const yourLabel = viewer === "attacker" ? "⚔️  YOUR FORCES (ATTACKER)" : "🛡  YOUR FORCES (DEFENDER)";
  const enemyLabel = viewer === "attacker" ? "🛡  ENEMY FORCES (DEFENDER)" : "⚔️  ENEMY FORCES (ATTACKER)";

  function renderStackCard(st, i, sideColor) {
    const pctLost = st.initial > 0 ? st.lost / st.initial : 0;
    const typeIcon = TYPE_ICONS[st.unit_type] || "⚔️";
    const elemColor = ELEM_COLORS[st.element] || colors.textDim;
    const ehp = (st.defense * 2) + 10;

    return (
      <View key={i} style={styles.stackCard}>
        <View style={styles.stackTop}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 16 }}>{typeIcon}</Text>
            <Text style={styles.stackName}>{st.name}</Text>
            <View style={[styles.elemBadge, { backgroundColor: elemColor + "33", borderColor: elemColor + "66" }]}>
              <Text style={[styles.elemText, { color: elemColor }]}>{st.element || "physical"}</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Text style={styles.statChip}>⚔️ {st.attack} ATK</Text>
          <Text style={styles.statChip}>🛡 {st.defense} DEF</Text>
          <Text style={styles.statChip}>💨 {st.speed} SPD</Text>
          <Text style={styles.statChip}>❤️ {ehp} EHP</Text>
        </View>

        {/* Counts bar */}
        <View style={styles.countsRow}>
          <View style={styles.countBox}>
            <Text style={styles.countLabel}>Sent</Text>
            <Text style={styles.countValue}>{st.initial}</Text>
          </View>
          <Text style={styles.countArrow}>→</Text>
          <View style={styles.countBox}>
            <Text style={styles.countLabel}>Survived</Text>
            <Text style={[styles.countValue, st.remaining > 0 ? styles.survived : styles.wiped]}>
              {st.remaining}
            </Text>
          </View>
          <View style={[styles.lostBox, pctLost >= 0.5 && styles.lostBoxHeavy]}>
            <Text style={styles.lostLabel}>Lost</Text>
            <Text style={styles.lostValue}>
              {st.lost} ({Math.round(pctLost * 100)}%)
            </Text>
          </View>
        </View>

        {/* Hero banner */}
        {st.hero && (
          <View style={[styles.heroBanner, !st.hero_alive && styles.heroBannerFallen]}>
            <Text style={styles.heroBannerText}>
              👑 {st.hero.name} {st.hero_alive ? "survived" : "FALLEN"}
              {st.hero.active_buff ? ` • ${st.hero.active_buff}` : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderArmySummary(label, army, color) {
    if (!army) return null;
    const stacks = army.stacks || [];
    const totalSent = stacks.reduce((s, st) => s + st.initial, 0);
    const totalLost = stacks.reduce((s, st) => s + st.lost, 0);
    const totalRemaining = stacks.reduce((s, st) => s + st.remaining, 0);

    return (
      <View style={[styles.armySection, { borderColor: color + "44" }]}>
        <View style={styles.armyHeader}>
          <Text style={[styles.armyLabel, { color }]}>{label}</Text>
          <Text style={styles.armyName}>{army.name}</Text>
        </View>
        {stacks.map((st, i) => renderStackCard(st, i, color))}
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Deployed</Text>
            <Text style={styles.totalValue}>{totalSent}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Survived</Text>
            <Text style={[styles.totalValue, { color: colors.success }]}>{totalRemaining}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Casualties</Text>
            <Text style={[styles.totalValue, { color: colors.danger }]}>
              {totalLost} ({totalSent > 0 ? Math.round((totalLost / totalSent) * 100) : 0}%)
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function colorForLogLine(line) {
    if (line.includes("=== BATTLE")) return colors.gold;
    if (line.includes("--- ROUND")) return colors.info;
    if (line.startsWith("[ATK]")) return colors.info;
    if (line.startsWith("[DEF]")) return colors.dangerSoft;
    if (line.includes("[ATK]") && line.includes("hits")) return colors.info;
    if (line.includes("[DEF]") && line.includes("hits")) return colors.dangerSoft;
    if (line.includes("[ATK]") && line.includes("counter-attacks")) return colors.info;
    if (line.includes("[DEF]") && line.includes("counter-attacks")) return colors.dangerSoft;
    if (line.includes("HERO STRIKE") || line.includes("VENGEANCE") || line.includes("ARCANE NOVA") || line.includes("DESPERATE VOLLEY"))
      return colors.warning;
    if (line.includes("kills") || line.includes("slaying")) return colors.dangerSoft;
    if (line.includes("LEECH") || line.includes("recovering")) return colors.success;
    if (line.includes("SPLASH")) return colors.arcane;
    if (line.includes("Morale") || line.includes("⚠")) return colors.warning;
    if (line.includes("Winner")) return colors.gold;
    if (line.includes("creates distance")) return colors.muted;
    return colors.faint;
  }

  function styleForLogLine(line) {
    if (line.includes("=== BATTLE") || line.includes("--- ROUND") || line.includes("Winner"))
      return { fontWeight: "bold" };
    if (line.startsWith("  ->")) return { marginLeft: 8 };
    if (line.startsWith("    ->")) return { marginLeft: 16, fontSize: 10 };
    return {};
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Outcome Banner */}
      <View style={[styles.banner, isVictory ? styles.victory : styles.defeat]}>
        <ArtPlaceholder
          emoji={isVictory ? "🏆" : "🥀"}
          label={isVictory ? "Victory art" : "Defeat art"}
          aspect={3}
          source={isVictory ? art.bannerVictory : art.bannerDefeat}
          style={{ marginBottom: 10 }}
        />
        <Text style={styles.bannerEmoji}>{isVictory ? "⚔️" : "💀"}</Text>
        <Text style={styles.bannerTitle}>
          {isVictory ? "VICTORY" : "DEFEAT"}
        </Text>
        {landSeized > 0 && (
          <Text style={styles.bannerSub}>
            {isVictory
              ? `+${landSeized} acres seized!`
              : `${landSeized} acres lost`}
          </Text>
        )}
      </View>

      {/* Army Summaries */}
      {renderArmySummary(yourLabel, yourArmy, colors.info)}
      {renderArmySummary(enemyLabel, enemyArmy, colors.danger)}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
          <Text style={styles.legendText}>Your actions</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.dangerSoft }]} />
          <Text style={styles.legendText}>Enemy actions</Text>
        </View>
      </View>

      {/* Combat Log */}
      <TouchableOpacity
        style={styles.logToggle}
        onPress={() => setLogExpanded(!logExpanded)}
      >
        <Text style={styles.logToggleText}>
          {logExpanded ? "▼ Combat Log" : "▶ Show Combat Log"}
        </Text>
      </TouchableOpacity>

      {logExpanded && (
        <View style={styles.logContainer}>
          {(result.log || []).map((line, i) => (
            <Text
              key={i}
              style={[
                styles.logLine,
                { color: colorForLogLine(line) },
                styleForLogLine(line),
              ]}
            >
              {line}
            </Text>
          ))}
        </View>
      )}

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate("Battles")}
      >
        <Text style={styles.backText}>Return to Targets</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  banner: { alignItems: "center", paddingVertical: 28, marginBottom: 4 },
  victory: { backgroundColor: alpha(colors.success, "22") },
  defeat: { backgroundColor: alpha(colors.danger, "18") },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { color: colors.text, fontSize: 28, fontWeight: "bold", letterSpacing: 3, marginTop: 4 },
  bannerSub: { color: colors.textDim, fontSize: 14, marginTop: 4 },

  armySection: { margin: 12, padding: 12, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1 },
  armyHeader: { marginBottom: 8 },
  armyLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  armyName: { color: colors.text, fontSize: 16, fontWeight: "bold", marginTop: 2 },

  stackCard: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: alpha(colors.border, "33"),
  },
  stackTop: { flexDirection: "row", alignItems: "center" },
  stackName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  elemBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
  elemText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  statChip: { color: colors.muted, fontSize: 11 },

  countsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  countBox: { alignItems: "center" },
  countLabel: { color: colors.faint, fontSize: 10 },
  countValue: { color: colors.text, fontSize: 16, fontWeight: "bold" },
  countArrow: { color: colors.faint, fontSize: 16 },
  survived: { color: colors.success },
  wiped: { color: colors.danger },
  lostBox: {
    marginLeft: "auto",
    alignItems: "center",
    backgroundColor: alpha(colors.danger, "11"),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lostBoxHeavy: { backgroundColor: alpha(colors.danger, "22") },
  lostLabel: { color: alpha(colors.danger, "88"), fontSize: 10 },
  lostValue: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  heroBanner: {
    backgroundColor: alpha(colors.gold, "11"),
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  heroBannerFallen: { borderLeftColor: colors.danger, backgroundColor: alpha(colors.danger, "11") },
  heroBannerText: { color: colors.gold, fontSize: 11 },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalItem: { alignItems: "center" },
  totalLabel: { color: colors.faint, fontSize: 10 },
  totalValue: { color: colors.text, fontSize: 14, fontWeight: "600" },

  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 8, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.muted, fontSize: 12 },

  logToggle: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    alignItems: "center",
  },
  logToggleText: { color: colors.accentDim, fontSize: 14, fontWeight: "600" },
  logContainer: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 10,
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logLine: { fontSize: 11, fontFamily: "monospace", lineHeight: 17, marginVertical: 1 },

  backButton: { margin: 12, marginTop: 16, backgroundColor: colors.border, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  backText: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
