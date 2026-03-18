import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";

export default function ArmyScreen({ navigation }) {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadArmy() {
    try {
      const result = await api.getArmy();
      setData(result);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadArmy(); }, []));

  async function handlePayUpkeep() {
    const confirmed = await showConfirm("Pay Upkeep", `Pay ${data.stats.daily_upkeep} gold to maintain army morale?`, { confirmText: "Pay" });
    if (!confirmed) return;
    try {
      const result = await api.payUpkeep(data.stats.daily_upkeep);
      showAlert("Success", result.message);
      loadArmy();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleDisband(unitId, name) {
    const qty = await showPrompt("Disband", `How many ${name} to disband?`, { submitText: "Disband", destructive: true, keyboardType: "number-pad" });
    if (qty === null) return;
    try {
      const result = await api.disbandUnits(unitId, parseInt(qty) || 0);
      showAlert("Success", result.message);
      loadArmy();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  const s = data.stats;
  const heroes = data.units.filter((u) => u.unit_type === "hero");
  const regularUnits = data.units.filter((u) => u.unit_type !== "hero");

  const morale = Math.round(s.morale);
  let moraleColor, moraleMsg;
  if (morale === 0) {
    moraleColor = "#e74c3c";
    moraleMsg = "Total chaos — no one knows why they are fighting.";
  } else if (morale < 20) {
    moraleColor = "#e74c3c";
    moraleMsg = "Your troops are furious. Some are discussing desertion.";
  } else if (morale < 75) {
    moraleColor = "#f1c40f";
    moraleMsg = "The army is uneasy. They hope you won't forget to pay them.";
  } else {
    moraleColor = "#2ecc71";
    moraleMsg = "Spirits are high — your army is ready for anything!";
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadArmy(); setRefreshing(false); }} />}
    >
      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{s.total_quantity}</Text>
          <Text style={styles.statLabel}>Units</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{s.total_attack}</Text>
          <Text style={styles.statLabel}>Attack</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{s.total_defense}</Text>
          <Text style={styles.statLabel}>Defense</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: "#f1c40f" }]}>{s.daily_upkeep}</Text>
          <Text style={styles.statLabel}>Upkeep</Text>
        </View>
      </View>

      {/* Morale + Pay */}
      <View style={styles.card}>
        <View style={styles.moraleRow}>
          <Text style={[styles.moraleLabel, { color: moraleColor }]}>Morale: {morale}%</Text>
          <TouchableOpacity style={styles.payButton} onPress={handlePayUpkeep}>
            <Text style={styles.payText}>Pay Upkeep</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.moraleBarBg}>
          <View style={[styles.moraleBarFill, { width: `${Math.min(s.morale, 100)}%`, backgroundColor: moraleColor }]} />
        </View>
        <Text style={[styles.moraleMsg, { color: moraleColor }]}>{moraleMsg}</Text>
      </View>

      {/* Set Up Defense */}
      <TouchableOpacity style={styles.defenseButton} onPress={() => navigation.navigate("Defense")}>
        <Text style={styles.defenseIcon}>🛡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.defenseTitle}>Set Up Defense</Text>
          <Text style={styles.defenseSub}>Garrison units and select defense spells</Text>
        </View>
        <Text style={styles.defenseArrow}>›</Text>
      </TouchableOpacity>

      {/* Recruit Units */}
      <TouchableOpacity style={styles.recruitButton} onPress={() => navigation.navigate("Recruit")}>
        <Text style={styles.defenseIcon}>📯</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.recruitTitle}>Recruit Units</Text>
          <Text style={styles.defenseSub}>Spend gold to enlist new soldiers</Text>
        </View>
        <Text style={styles.recruitArrow}>›</Text>
      </TouchableOpacity>

      {/* Heroes */}
      {heroes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Heroes</Text>
          {heroes.map((u) => (
            <View key={u.id} style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>★ HERO</Text>
              </View>
              <View style={styles.unitHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{u.name}</Text>
                  {u.abilities && u.abilities.length > 0 && (
                    <Text style={styles.heroAbilities}>{u.abilities.join(" · ")}</Text>
                  )}
                </View>
              </View>
              <View style={styles.unitStats}>
                <Text style={styles.heroStat}>⚔️ {u.attack}</Text>
                <Text style={styles.heroStat}>🛡 {u.defense}</Text>
                <Text style={styles.heroStat}>💨 {u.speed}</Text>
                {u.mana_upkeep > 0 && <Text style={styles.heroStat}>🔮 {u.mana_upkeep}</Text>}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Regular Units */}
      {regularUnits.length > 0 && (
        <Text style={styles.sectionTitle}>Units</Text>
      )}
      {regularUnits.map((u) => (
        <View key={u.id} style={styles.unitCard}>
          <View style={styles.unitHeader}>
            <View>
              <Text style={styles.unitName}>{u.name}</Text>
              <Text style={styles.unitType}>{u.unit_type}{u.hero ? ` • Led by ${u.hero.name}` : ""}</Text>
            </View>
            <Text style={styles.unitQty}>x{u.quantity}</Text>
          </View>
          <View style={styles.unitStats}>
            <Text style={styles.unitStat}>⚔️ {u.attack}</Text>
            <Text style={styles.unitStat}>🛡 {u.defense}</Text>
            <Text style={styles.unitStat}>💨 {u.speed}</Text>
            <Text style={styles.unitStat}>🏠 {u.garrison} garrisoned</Text>
          </View>
          <View style={styles.unitActions}>
            <Text style={styles.availableText}>{u.available} available</Text>
            <TouchableOpacity
              style={styles.disbandBtn}
              onPress={() => handleDisband(u.unit_id, u.name)}
            >
              <Text style={styles.disbandText}>Disband</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {data.units.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No units in your army. Visit Town to recruit!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#e0e0e0", fontSize: 18, fontWeight: "bold" },
  statLabel: { color: "#888", fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    marginBottom: 0,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  moraleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  moraleLabel: { color: "#e0e0e0", fontSize: 14, fontWeight: "600" },
  payButton: { backgroundColor: "#2ecc71", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  payText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  moraleBarBg: { height: 6, backgroundColor: "#333", borderRadius: 3 },
  moraleBarFill: { height: 6, backgroundColor: "#2ecc71", borderRadius: 3 },
  moraleMsg: { fontSize: 12, marginTop: 8, fontStyle: "italic" },
  defenseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    margin: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7c5cbf",
  },
  defenseIcon: { fontSize: 24, marginRight: 12 },
  defenseTitle: { color: "#e0e0e0", fontSize: 15, fontWeight: "bold" },
  defenseSub: { color: "#888", fontSize: 12, marginTop: 2 },
  defenseArrow: { color: "#7c5cbf", fontSize: 24, fontWeight: "bold" },
  recruitButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2ecc71",
  },
  recruitTitle: { color: "#e0e0e0", fontSize: 15, fontWeight: "bold" },
  recruitArrow: { color: "#2ecc71", fontSize: 24, fontWeight: "bold" },
  sectionTitle: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  heroCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#f1c40f",
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(241,196,15,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  heroBadgeText: { color: "#f1c40f", fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
  heroName: { color: "#f1c40f", fontSize: 17, fontWeight: "bold" },
  heroAbilities: { color: "#bfa44e", fontSize: 12, marginTop: 3 },
  heroStat: { color: "#d4c17a", fontSize: 13, fontWeight: "500" },
  unitCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unitName: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
  unitType: { color: "#7c5cbf", fontSize: 12, marginTop: 2 },
  unitQty: { color: "#7c5cbf", fontSize: 20, fontWeight: "bold" },
  unitStats: { flexDirection: "row", marginTop: 8, gap: 16 },
  unitStat: { color: "#999", fontSize: 12 },
  unitActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 1, borderTopColor: "#2a2a4a", paddingTop: 8 },
  availableText: { color: "#888", fontSize: 12 },
  disbandBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4, borderWidth: 1, borderColor: "#e74c3c" },
  disbandText: { color: "#e74c3c", fontSize: 12 },
  emptyCard: { margin: 12, padding: 24, alignItems: "center" },
  emptyText: { color: "#666", fontSize: 14 },
});
