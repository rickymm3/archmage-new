import React, { useState } from "react";
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
  fire: "#e74c3c",
  water: "#3498db",
  nature: "#2ecc71",
  holy: "#f1c40f",
  void: "#9b59b6",
  physical: "#aaa",
};

export default function BattleResultScreen({ route, navigation }) {
  const { result } = route.params;
  const [logExpanded, setLogExpanded] = useState(true);

  const isVictory = result.outcome === "attacker";
  const landSeized = result.land_seized || 0;

  function renderStackCard(st, i, sideColor) {
    const pctLost = st.initial > 0 ? st.lost / st.initial : 0;
    const typeIcon = TYPE_ICONS[st.unit_type] || "⚔️";
    const elemColor = ELEM_COLORS[st.element] || "#aaa";
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
            <Text style={[styles.totalValue, { color: "#2ecc71" }]}>{totalRemaining}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Casualties</Text>
            <Text style={[styles.totalValue, { color: "#e74c3c" }]}>
              {totalLost} ({totalSent > 0 ? Math.round((totalLost / totalSent) * 100) : 0}%)
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function colorForLogLine(line) {
    if (line.includes("=== BATTLE")) return "#f1c40f";
    if (line.includes("--- ROUND")) return "#3498db";
    if (line.startsWith("[ATK]")) return "#5dade2";
    if (line.startsWith("[DEF]")) return "#e07070";
    if (line.includes("[ATK]") && line.includes("hits")) return "#5dade2";
    if (line.includes("[DEF]") && line.includes("hits")) return "#e07070";
    if (line.includes("[ATK]") && line.includes("counter-attacks")) return "#5dade2";
    if (line.includes("[DEF]") && line.includes("counter-attacks")) return "#e07070";
    if (line.includes("HERO STRIKE") || line.includes("VENGEANCE") || line.includes("ARCANE NOVA") || line.includes("DESPERATE VOLLEY"))
      return "#e67e22";
    if (line.includes("kills") || line.includes("slaying")) return "#cc6666";
    if (line.includes("LEECH") || line.includes("recovering")) return "#2ecc71";
    if (line.includes("SPLASH")) return "#9b59b6";
    if (line.includes("Morale") || line.includes("⚠")) return "#f39c12";
    if (line.includes("Winner")) return "#f1c40f";
    if (line.includes("creates distance")) return "#888";
    return "#777";
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
      {renderArmySummary("⚔️  YOUR FORCES (ATTACKER)", result.attacker_army, "#3498db")}
      {renderArmySummary("🛡  ENEMY FORCES (DEFENDER)", result.defender_army, "#e74c3c")}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#5dade2" }]} />
          <Text style={styles.legendText}>Your actions</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#e07070" }]} />
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
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  banner: { alignItems: "center", paddingVertical: 28, marginBottom: 4 },
  victory: { backgroundColor: "#1a2e1a" },
  defeat: { backgroundColor: "#2e1a1a" },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { color: "#e0e0e0", fontSize: 28, fontWeight: "bold", letterSpacing: 3, marginTop: 4 },
  bannerSub: { color: "#aaa", fontSize: 14, marginTop: 4 },

  armySection: { margin: 12, padding: 12, backgroundColor: "#1a1a2e", borderRadius: 10, borderWidth: 1 },
  armyHeader: { marginBottom: 8 },
  armyLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  armyName: { color: "#e0e0e0", fontSize: 16, fontWeight: "bold", marginTop: 2 },

  stackCard: {
    backgroundColor: "#12122a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#2a2a4a33",
  },
  stackTop: { flexDirection: "row", alignItems: "center" },
  stackName: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  elemBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
  elemText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  statChip: { color: "#888", fontSize: 11 },

  countsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  countBox: { alignItems: "center" },
  countLabel: { color: "#666", fontSize: 10 },
  countValue: { color: "#e0e0e0", fontSize: 16, fontWeight: "bold" },
  countArrow: { color: "#555", fontSize: 16 },
  survived: { color: "#2ecc71" },
  wiped: { color: "#e74c3c" },
  lostBox: {
    marginLeft: "auto",
    alignItems: "center",
    backgroundColor: "#e74c3c11",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lostBoxHeavy: { backgroundColor: "#e74c3c22" },
  lostLabel: { color: "#e74c3c88", fontSize: 10 },
  lostValue: { color: "#e74c3c", fontSize: 13, fontWeight: "600" },

  heroBanner: {
    backgroundColor: "#f1c40f11",
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#f1c40f",
  },
  heroBannerFallen: { borderLeftColor: "#e74c3c", backgroundColor: "#e74c3c11" },
  heroBannerText: { color: "#f1c40f", fontSize: 11 },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
  },
  totalItem: { alignItems: "center" },
  totalLabel: { color: "#666", fontSize: 10 },
  totalValue: { color: "#e0e0e0", fontSize: 14, fontWeight: "600" },

  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 8, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#888", fontSize: 12 },

  logToggle: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    alignItems: "center",
  },
  logToggleText: { color: "#8888cc", fontSize: 14, fontWeight: "600" },
  logContainer: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 10,
    backgroundColor: "#111122",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  logLine: { fontSize: 11, fontFamily: "monospace", lineHeight: 17, marginVertical: 1 },

  backButton: { margin: 12, marginTop: 16, backgroundColor: "#2a2a4a", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  backText: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
});
