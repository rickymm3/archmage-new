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
import { colors, alpha } from "../theme";

export default function BarbarianAttackSetupScreen({ route, navigation }) {
  const { settlementId, settlementName } = route.params;
  const { showAlert } = useModal();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [setup, setSetup] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    loadSetup();
  }, []);

  async function loadSetup() {
    try {
      const data = await api.getBarbarianSetup(settlementId);
      setSetup(data);
      const q = {};
      (data.units || []).forEach((u) => { q[u.unit_id] = 0; });
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
    (setup.units || []).forEach((u) => { q[u.unit_id] = u.available; });
    setQuantities(q);
  }

  function clearAll() {
    if (!setup) return;
    const q = {};
    (setup.units || []).forEach((u) => { q[u.unit_id] = 0; });
    setQuantities(q);
  }

  const totalSending = Object.values(quantities).reduce((s, v) => s + v, 0);

  async function handleAttack() {
    if (totalSending === 0) {
      showAlert("No Units", "Select at least one unit to send.");
      return;
    }
    setSending(true);
    try {
      const units = {};
      for (const [uid, qty] of Object.entries(quantities)) {
        if (qty > 0) units[uid] = qty;
      }
      const data = await api.attackBarbarianSettlement(settlementId, units);
      navigation.replace("BattleResult", { result: data.result });
    } catch (e) {
      showAlert("Attack Failed", e.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={styles.loadingText}>Scouting the settlement...</Text>
      </View>
    );
  }

  if (!setup) return null;

  const combatUnits = (setup.units || []).filter((u) => u.available > 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>SETTLEMENT</Text>
          <Text style={styles.targetName}>{setup.settlement.name}</Text>
          <View style={styles.targetStats}>
            <Text style={styles.stat}>Lv {setup.settlement.level}</Text>
            <Text style={styles.stat}>⚡ {setup.settlement.power_target}</Text>
            <Text style={styles.stat}>{setup.settlement.element}</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={setAll}>
            <Text style={styles.quickBtnText}>Send All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={clearAll}>
            <Text style={styles.quickBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {combatUnits.length === 0 && (
          <Text style={styles.emptyText}>No units available to attack with.</Text>
        )}

        {combatUnits.map((unit) => {
          const qty = quantities[unit.unit_id] || 0;
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

              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(unit.unit_id, -10, unit.available)}>
                  <Text style={styles.qtyBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(unit.unit_id, -1, unit.available)}>
                  <Text style={styles.qtyBtnText}>-1</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyValue, qty > 0 && styles.qtyActive]}>{qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(unit.unit_id, 1, unit.available)}>
                  <Text style={styles.qtyBtnText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(unit.unit_id, 10, unit.available)}>
                  <Text style={styles.qtyBtnText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.maxBtn}
                  onPress={() => setQuantities((p) => ({ ...p, [unit.unit_id]: unit.available }))}
                >
                  <Text style={styles.maxBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.attackButton, totalSending === 0 && styles.disabled]}
          onPress={handleAttack}
          disabled={sending || totalSending === 0}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.attackText}>⚔️ Attack with {totalSending} units</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  loadingText: { color: colors.muted, marginTop: 12 },
  scroll: { flex: 1 },
  targetCard: {
    backgroundColor: alpha(colors.warning, "18"),
    margin: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.warning, "44"),
  },
  targetLabel: { color: colors.warning, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  targetName: { color: colors.text, fontSize: 18, fontWeight: "bold", marginTop: 2 },
  targetStats: { flexDirection: "row", gap: 16, marginTop: 6 },
  stat: { color: colors.textDim, fontSize: 13, textTransform: "capitalize" },
  quickActions: { flexDirection: "row", gap: 8, marginHorizontal: 12, marginBottom: 8 },
  quickBtn: {
    backgroundColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  quickBtnText: { color: colors.accentDim, fontSize: 13, fontWeight: "600" },
  emptyText: { color: colors.faint, textAlign: "center", padding: 24 },
  unitCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  unitName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  unitMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  available: { color: colors.muted, fontSize: 12 },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  qtyBtn: {
    backgroundColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  qtyBtnText: { color: colors.textDim, fontSize: 13, fontWeight: "600" },
  qtyValue: { color: colors.faint, fontSize: 18, fontWeight: "bold", minWidth: 40, textAlign: "center" },
  qtyActive: { color: colors.gold },
  maxBtn: {
    backgroundColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: "auto",
  },
  maxBtnText: { color: colors.accentDim, fontSize: 12, fontWeight: "700" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: alpha(colors.bg, "ee"),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attackButton: {
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  attackText: { color: colors.white, fontSize: 16, fontWeight: "bold" },
});
