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

const TABS = [
  { key: "tax", label: "💰 Tax Collection" },
  { key: "mana", label: "🔮 Mana Battery" },
];

export default function TreasuryScreen() {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("tax");

  async function loadData() {
    try {
      setData(await api.getTreasury());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handleTax(tier) {
    try {
      const result = await api.collectTax(tier);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleRecharge() {
    try {
      const result = await api.rechargeMana();
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const tierColors = {
    lenient: "#2ecc71",
    standard: "#3498db",
    heavy: "#f39c12",
    extortion: "#e74c3c",
  };

  function renderTaxTab() {
    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor="#f1c40f"
          />
        }
      >
        {/* Gold balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Gold Treasury</Text>
          <Text style={styles.balanceValue}>💰 {data.gold?.toLocaleString()}</Text>
          <Text style={styles.balanceSub}>
            +{data.production_rates?.gold || 0}/hr production
          </Text>
        </View>

        {/* Taxable info */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Base Taxable Amount</Text>
          <Text style={styles.infoValue}>{data.taxable_amount} gold</Text>
        </View>

        {/* Tax tiers */}
        <Text style={styles.sectionLabel}>Choose Tax Rate</Text>
        {data.tax_rates &&
          Object.entries(data.tax_rates).map(([tier, config]) => {
            const color = tierColors[tier] || "#888";
            const amount = Math.round(
              data.taxable_amount * (config.multiplier || 1)
            );
            return (
              <TouchableOpacity
                key={tier}
                style={styles.tierCard}
                onPress={() => handleTax(tier)}
                activeOpacity={0.7}
              >
                <View style={[styles.tierStripe, { backgroundColor: color }]} />
                <View style={styles.tierBody}>
                  <View style={styles.tierTop}>
                    <Text style={[styles.tierName, { color }]}>
                      {config.label || tier}
                    </Text>
                    <Text style={styles.tierAmount}>+{amount} gold</Text>
                  </View>
                  <View style={styles.tierBottom}>
                    <Text style={styles.tierMeta}>
                      {Math.round((config.multiplier || 1) * 100)}% rate
                    </Text>
                    <Text style={styles.tierMeta}>
                      {config.cooldown ? `${Math.round(config.cooldown / 60)}m cooldown` : ""}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.collectArrow, { color }]}>→</Text>
              </TouchableOpacity>
            );
          })}
        <View style={{ height: 30 }} />
      </ScrollView>
    );
  }

  function renderManaTab() {
    const net = data.net_mana_potential || 0;
    const charge = data.mana_charge || 0;
    // charge: 0.0 = just released, 1.0 = fully charged (overload)
    const projectedChange = Math.floor(net * charge);
    const projectedMana = (data.mana || 0) + projectedChange;
    const wouldBreach = projectedMana < 0;
    const isOverloaded = charge >= 1.0;
    const isHighCharge = charge >= 0.75;

    const netColor = net >= 0 ? "#2ecc71" : "#e74c3c";
    const projColor = wouldBreach ? "#e74c3c" : projectedChange >= 0 ? "#2ecc71" : "#f39c12";
    const chargePercent = Math.round(charge * 100);
    const barColor = isOverloaded ? "#e74c3c" : isHighCharge ? "#f39c12" : chargePercent > 30 ? "#7c5cbf" : "#3498db";

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor="#7c5cbf"
          />
        }
      >
        {/* Mana balance */}
        <View style={[styles.balanceCard, { borderColor: "#7c5cbf" }]}>
          <Text style={styles.balanceLabel}>Mana Reserves</Text>
          <Text style={[styles.balanceValue, { color: "#7c5cbf" }]}>
            🔮 {data.mana?.toLocaleString()} / {data.max_mana?.toLocaleString()}
          </Text>
        </View>

        {/* Mana Flow breakdown */}
        <View style={styles.manaFlowCard}>
          <Text style={styles.manaFlowTitle}>Mana Flow (per cycle)</Text>
          <View style={styles.manaFlowRow}>
            <Text style={styles.manaFlowLabel}>Generation</Text>
            <Text style={[styles.manaFlowValue, { color: "#2ecc71" }]}>
              +{data.mana_generation || 0}
            </Text>
          </View>
          <View style={styles.manaFlowRow}>
            <Text style={styles.manaFlowLabel}>Upkeep (spells + units)</Text>
            <Text style={[styles.manaFlowValue, { color: "#e74c3c" }]}>
              -{data.mana_upkeep || 0}
            </Text>
          </View>
          <View style={[styles.manaFlowRow, styles.manaFlowTotal]}>
            <Text style={styles.manaFlowLabel}>Net Flow</Text>
            <Text style={[styles.manaFlowValue, { color: netColor, fontWeight: "700" }]}>
              {net >= 0 ? "+" : ""}{net}
            </Text>
          </View>
        </View>

        {/* Capacitor */}
        <View style={styles.batteryCard}>
          <Text style={styles.batteryTitle}>Mana Capacitor</Text>
          <Text style={styles.batterySubtitle}>
            Charges over time. Release before it overloads!
          </Text>

          <View style={styles.batteryOuter}>
            <View
              style={[
                styles.batteryFill,
                { width: `${chargePercent}%`, backgroundColor: barColor },
              ]}
            />
          </View>
          <Text style={[styles.batteryPercent, { color: isOverloaded ? "#e74c3c" : isHighCharge ? "#f39c12" : "#aaa" }]}>
            {isOverloaded ? "⚡ OVERLOADED" : `${chargePercent}% charged`}
          </Text>

          {/* Projected result */}
          <View style={styles.projectedCard}>
            <Text style={styles.projectedLabel}>If released now</Text>
            <Text style={[styles.projectedValue, { color: projColor }]}>
              {projectedChange >= 0 ? "+" : ""}{projectedChange} mana
            </Text>
            {wouldBreach && (
              <Text style={styles.breachBadge}>⚠️ VOID BREACH</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.channelBtn, wouldBreach && styles.channelBtnDanger, isOverloaded && !wouldBreach && styles.channelBtnOverload]}
            onPress={handleRecharge}
            activeOpacity={0.7}
          >
            <Text style={styles.channelBtnText}>
              {wouldBreach
                ? "⚠️  Release Mana (Risk Breach)"
                : isOverloaded
                  ? "⚡  Release Now!"
                  : "🔮  Release Mana"}
            </Text>
          </TouchableOpacity>

          {isHighCharge && !wouldBreach && (
            <Text style={styles.overloadWarning}>
              ⚡ Capacitor charge is high! Release soon to avoid overload.
            </Text>
          )}

          {net < 0 && (
            <Text style={styles.warningText}>
              ⚠️ Your mana upkeep exceeds generation. Releasing will drain your
              mana reserves. If mana hits 0, a Void Breach occurs — your garrison
              will fight to defend the Mana Core!
            </Text>
          )}
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "tax" ? renderTaxTab() : renderManaTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#f1c40f",
  },
  tabText: { color: "#888", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#f1c40f" },
  tabContent: { flex: 1 },

  // ── Balance card ──
  balanceCard: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#f1c40f",
    alignItems: "center",
  },
  balanceLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  balanceValue: {
    color: "#f1c40f",
    fontSize: 32,
    fontWeight: "700",
  },
  balanceSub: { color: "#666", fontSize: 13, marginTop: 4 },

  // ── Info row ──
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    marginBottom: 12,
  },
  infoLabel: { color: "#888", fontSize: 13 },
  infoValue: { color: "#e0e0e0", fontSize: 14, fontWeight: "600" },

  // ── Section label ──
  sectionLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 14,
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Tax tier cards ──
  tierCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  tierStripe: {
    width: 4,
    alignSelf: "stretch",
  },
  tierBody: {
    flex: 1,
    padding: 14,
  },
  tierTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tierName: { fontSize: 16, fontWeight: "700" },
  tierAmount: { color: "#e0e0e0", fontSize: 16, fontWeight: "700" },
  tierBottom: { flexDirection: "row", gap: 16 },
  tierMeta: { color: "#888", fontSize: 12 },
  collectArrow: { fontSize: 22, fontWeight: "700", paddingRight: 14 },

  // ── Mana battery card ──
  batteryCard: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  batteryTitle: {
    color: "#7c5cbf",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  batterySubtitle: { color: "#666", fontSize: 12, marginBottom: 16 },
  batteryOuter: {
    height: 24,
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  batteryFill: {
    height: 24,
    borderRadius: 12,
  },
  batteryPercent: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },
  batteryInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#2a2a4a",
  },
  batteryInfoItem: { alignItems: "center" },
  batteryInfoLabel: { color: "#888", fontSize: 11, marginBottom: 4 },
  batteryInfoValue: { fontSize: 14, fontWeight: "700" },

  // Mana flow card
  manaFlowCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    padding: 14,
  },
  manaFlowTitle: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  manaFlowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  manaFlowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
    marginTop: 6,
    paddingTop: 8,
  },
  manaFlowLabel: { color: "#888", fontSize: 14 },
  manaFlowValue: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },

  // Projected result
  projectedCard: {
    backgroundColor: "#12122a",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  projectedLabel: { color: "#888", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  projectedValue: { fontSize: 24, fontWeight: "700" },
  breachBadge: {
    color: "#e74c3c",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    backgroundColor: "#2a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },

  channelBtn: {
    backgroundColor: "#7c5cbf",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  channelBtnDanger: {
    backgroundColor: "#a33",
  },
  channelBtnOverload: {
    backgroundColor: "#f39c12",
  },
  channelBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  overloadWarning: {
    color: "#f39c12",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  warningText: {
    color: "#e74c3c",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
