import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";

export default function AttackSetupScreen({ route, navigation }) {
  const { targetId, targetName } = route.params;
  const { showAlert } = useModal();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [setup, setSetup] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [heroAssignments, setHeroAssignments] = useState({});

  useEffect(() => {
    loadSetup();
  }, []);

  async function loadSetup() {
    try {
      const data = await api.getBattleSetup(targetId);
      setSetup(data);
      // Init quantities to 0 for each non-hero unit
      const q = {};
      (data.units || []).forEach((u) => {
        if (u.unit_type !== "hero") q[u.unit_id] = 0;
      });
      setQuantities(q);
    } catch (e) {
      showAlert("Error", e.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  function adjustQty(unitId, delta, max) {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(max, (prev[unitId] || 0) + delta));
      return { ...prev, [unitId]: next };
    });
  }

  function setAll() {
    if (!setup) return;
    const q = {};
    (setup.units || []).forEach((u) => {
      if (u.unit_type !== "hero") q[u.unit_id] = u.available;
    });
    setQuantities(q);
  }

  function clearAll() {
    if (!setup) return;
    const q = {};
    (setup.units || []).forEach((u) => {
      if (u.unit_type !== "hero") q[u.unit_id] = 0;
    });
    setQuantities(q);
    setHeroAssignments({});
  }

  function toggleHero(heroUnitId, targetUnitId) {
    setHeroAssignments((prev) => {
      // If this hero is already assigned to this unit, unassign
      if (prev[targetUnitId] === heroUnitId) {
        const next = { ...prev };
        delete next[targetUnitId];
        return next;
      }
      // Remove hero from any other assignment
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v !== heroUnitId) next[k] = v;
      }
      next[targetUnitId] = heroUnitId;
      return next;
    });
  }

  const totalSending = Object.values(quantities).reduce((s, v) => s + v, 0);
  const assignedHeroes = new Set(Object.values(heroAssignments));

  async function handleAttack() {
    if (totalSending === 0) {
      showAlert("No Units", "Select at least one unit to send.");
      return;
    }
    setSending(true);
    try {
      // Build units hash: unit_id => quantity (only non-zero)
      const units = {};
      for (const [uid, qty] of Object.entries(quantities)) {
        if (qty > 0) units[uid] = qty;
      }
      // Build heroes hash: unit_id => hero_unit_id
      const heroes = {};
      for (const [uid, hid] of Object.entries(heroAssignments)) {
        if (units[uid]) heroes[uid] = hid;
      }
      const data = await api.createBattle(targetId, units, heroes);
      navigation.replace("BattleResult", { result: data.result });
    } catch (e) {
      showAlert("Battle Failed", e.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e0e0e0" size="large" />
        <Text style={styles.loadingText}>Preparing battle plan...</Text>
      </View>
    );
  }

  if (!setup) return null;

  const combatUnits = (setup.units || []).filter(
    (u) => u.unit_type !== "hero" && u.available > 0
  );
  const heroes = setup.heroes || [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Target Info */}
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>TARGET</Text>
          <Text style={styles.targetName}>
            {setup.target.kingdom_name || setup.target.username}
          </Text>
          <View style={styles.targetStats}>
            <Text style={styles.stat}>⚡ {setup.target.net_power}</Text>
            <Text style={styles.stat}>🏔 {setup.target.land} land</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={setAll}>
            <Text style={styles.quickBtnText}>Send All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={clearAll}>
            <Text style={styles.quickBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Unit Selection */}
        {combatUnits.length === 0 && (
          <Text style={styles.emptyText}>No units available to attack with.</Text>
        )}

        {combatUnits.map((unit) => {
          const qty = quantities[unit.unit_id] || 0;
          const assignedHero = heroAssignments[unit.unit_id];
          const heroData = assignedHero
            ? heroes.find((h) => h.unit_id === assignedHero)
            : null;

          return (
            <View key={unit.unit_id} style={styles.unitCard}>
              <View style={styles.unitHeader}>
                <View>
                  <Text style={styles.unitName}>{unit.name}</Text>
                  <Text style={styles.unitMeta}>
                    ⚔️ {unit.attack} 🛡 {unit.defense} 💨 {unit.speed}
                  </Text>
                </View>
                <Text style={styles.available}>{unit.available} avail</Text>
              </View>

              {/* Quantity Controls */}
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(unit.unit_id, -10, unit.available)}
                >
                  <Text style={styles.qtyBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(unit.unit_id, -1, unit.available)}
                >
                  <Text style={styles.qtyBtnText}>-1</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyValue, qty > 0 && styles.qtyActive]}>
                  {qty}
                </Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(unit.unit_id, 1, unit.available)}
                >
                  <Text style={styles.qtyBtnText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(unit.unit_id, 10, unit.available)}
                >
                  <Text style={styles.qtyBtnText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.maxBtn}
                  onPress={() =>
                    setQuantities((p) => ({
                      ...p,
                      [unit.unit_id]: unit.available,
                    }))
                  }
                >
                  <Text style={styles.maxBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>

              {/* Hero Assignment */}
              {qty > 0 && heroes.length > 0 && (
                <View style={styles.heroRow}>
                  <Text style={styles.heroLabel}>Lead:</Text>
                  {heroes.map((h) => {
                    const isAssigned = assignedHero === h.unit_id;
                    const taken =
                      !isAssigned && assignedHeroes.has(h.unit_id);
                    return (
                      <TouchableOpacity
                        key={h.unit_id}
                        style={[
                          styles.heroPill,
                          isAssigned && styles.heroPillActive,
                          taken && styles.heroPillTaken,
                        ]}
                        onPress={() =>
                          !taken && toggleHero(h.unit_id, unit.unit_id)
                        }
                        disabled={taken}
                      >
                        <Text
                          style={[
                            styles.heroPillText,
                            isAssigned && styles.heroPillTextActive,
                            taken && styles.heroPillTextTaken,
                          ]}
                        >
                          {h.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {heroData && (
                <Text style={styles.heroAssigned}>
                  👑 Led by {heroData.name}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Attack Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.attackButton, totalSending === 0 && styles.disabled]}
          onPress={handleAttack}
          disabled={sending || totalSending === 0}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.attackText}>
              ⚔️ Attack with {totalSending} units
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f1a" },
  loadingText: { color: "#888", marginTop: 12 },
  scroll: { flex: 1 },
  targetCard: {
    backgroundColor: "#2a1a1a",
    margin: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e74c3c44",
  },
  targetLabel: { color: "#e74c3c", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  targetName: { color: "#e0e0e0", fontSize: 18, fontWeight: "bold", marginTop: 2 },
  targetStats: { flexDirection: "row", gap: 16, marginTop: 6 },
  stat: { color: "#aaa", fontSize: 13 },
  quickActions: { flexDirection: "row", gap: 8, marginHorizontal: 12, marginBottom: 8 },
  quickBtn: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  quickBtnText: { color: "#8888cc", fontSize: 13, fontWeight: "600" },
  emptyText: { color: "#666", textAlign: "center", padding: 24 },
  unitCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  unitName: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  unitMeta: { color: "#888", fontSize: 11, marginTop: 2 },
  available: { color: "#888", fontSize: 12 },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  qtyBtn: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  qtyBtnText: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  qtyValue: { color: "#666", fontSize: 18, fontWeight: "bold", minWidth: 40, textAlign: "center" },
  qtyActive: { color: "#f1c40f" },
  maxBtn: {
    backgroundColor: "#3a3a5a",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: "auto",
  },
  maxBtnText: { color: "#8888cc", fontSize: 12, fontWeight: "700" },
  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6, flexWrap: "wrap" },
  heroLabel: { color: "#888", fontSize: 12 },
  heroPill: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3a3a5a",
  },
  heroPillActive: { backgroundColor: "#f1c40f22", borderColor: "#f1c40f" },
  heroPillTaken: { opacity: 0.3 },
  heroPillText: { color: "#aaa", fontSize: 11 },
  heroPillTextActive: { color: "#f1c40f" },
  heroPillTextTaken: { color: "#666" },
  heroAssigned: { color: "#f1c40f", fontSize: 12, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: "#0f0f1aee",
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
  },
  attackButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  attackText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
