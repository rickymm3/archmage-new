import React, { useState, useCallback, useEffect, useRef } from "react";
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
import LoadingButton from "../components/LoadingButton";
import { LoadingState, SubTabs, FadeSlideIn } from "../components/ui";
import { colors, alpha } from "../theme";

const TABS = [
  { key: "tax", icon: "💰", label: "Tax Collection" },
  { key: "mana", icon: "🔮", label: "Mana Battery" },
];

// When `fixedTab` is provided (embedded in the Kingdom hub), the screen
// renders just that tab's content with no internal sub-menu.
export default function TreasuryScreen({ fixedTab }) {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tabState, setTabState] = useState("tax");
  const activeTab = fixedTab || tabState;
  const setActiveTab = setTabState;
  const [cooldownRemaining, setCooldownRemaining] = useState(null);
  const cooldownRef = useRef(null);

  // Live countdown timer for tax cooldown
  useEffect(() => {
    if (!data?.tax_cooldown) {
      setCooldownRemaining(null);
      return;
    }
    const target = new Date(data.tax_cooldown).getTime();
    function tick() {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setCooldownRemaining(left > 0 ? left : null);
      if (left <= 0 && cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    }
    tick();
    cooldownRef.current = setInterval(tick, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [data?.tax_cooldown]);

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
        <LoadingState />
      </View>
    );
  }

  const tierColors = {
    lenient: colors.success,
    standard: colors.info,
    heavy: colors.warning,
    extortion: colors.danger,
  };

  function formatCooldown(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m cooldown`;
    if (hrs > 0) return `${hrs}h cooldown`;
    return `${mins}m cooldown`;
  }

  function formatCountdown(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  const onCooldown = cooldownRemaining != null && cooldownRemaining > 0;

  function renderTaxTab() {
    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={colors.gold}
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

        {/* Cooldown banner */}
        {onCooldown && (
          <View style={styles.cooldownBanner}>
            <Text style={styles.cooldownIcon}>⏳</Text>
            <View>
              <Text style={styles.cooldownLabel}>Tax Cooldown Active</Text>
              <Text style={styles.cooldownTimer}>{formatCountdown(cooldownRemaining)}</Text>
            </View>
          </View>
        )}

        {/* Tax tiers */}
        <Text style={styles.sectionLabel}>Choose Tax Rate</Text>
        {data.tax_rates &&
          Object.entries(data.tax_rates).map(([tier, config]) => {
            const color = tierColors[tier] || colors.muted;
            const amount = Math.round(
              data.taxable_amount * (config.multiplier || 1)
            );
            return (
              <LoadingButton
                key={tier}
                style={[styles.tierCard, onCooldown && styles.tierCardDisabled]}
                onPress={() => handleTax(tier)}
                disabled={onCooldown}
              >
                <View style={[styles.tierStripe, { backgroundColor: onCooldown ? colors.border : color }]} />
                <View style={styles.tierBody}>
                  <View style={styles.tierTop}>
                    <Text style={[styles.tierName, { color: onCooldown ? colors.faint : color }]}>
                      {config.label || tier}
                    </Text>
                    <Text style={[styles.tierAmount, onCooldown && { color: colors.faint }]}>+{amount} gold</Text>
                  </View>
                  <View style={styles.tierBottom}>
                    <Text style={styles.tierMeta}>
                      {Math.round((config.multiplier || 1) * 100)}% rate
                    </Text>
                    <Text style={styles.tierMeta}>
                      {config.cooldown ? formatCooldown(config.cooldown) : ""}
                    </Text>
                  </View>
                </View>
                {onCooldown
                  ? <Text style={styles.collectLock}>🔒</Text>
                  : <Text style={[styles.collectArrow, { color }]}>→</Text>
                }
              </LoadingButton>
            );
          })}
        <View style={{ height: 30 }} />
      </ScrollView>
    );
  }

  function renderManaTab() {
    const net = data.net_mana_potential || 0;
    const charge = data.mana_charge || 0;
    // Yield: base (60% linear) + bonus (40% quadratic) to reward waiting
    const baseYield = Math.floor(net * 0.6 * charge);
    const bonusYield = Math.floor(net * 0.4 * charge * charge);
    const projectedChange = baseYield + bonusYield;
    const projectedMana = (data.mana || 0) + projectedChange;
    const wouldBreach = projectedMana < 0;
    const isOverloaded = charge >= 1.0;
    const isHighCharge = charge >= 0.75;

    const netColor = net >= 0 ? colors.success : colors.danger;
    const projColor = wouldBreach ? colors.danger : projectedChange >= 0 ? colors.success : colors.warning;
    const chargePercent = Math.round(charge * 100);
    const barColor = isOverloaded ? colors.danger : isHighCharge ? colors.warning : chargePercent > 30 ? colors.accent : colors.info;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Mana balance */}
        <View style={[styles.balanceCard, { borderColor: colors.accent }]}>
          <Text style={styles.balanceLabel}>Mana Reserves</Text>
          <Text style={[styles.balanceValue, { color: colors.accent }]}>
            🔮 {data.mana?.toLocaleString()} / {data.max_mana?.toLocaleString()}
          </Text>
        </View>

        {/* Mana Flow breakdown */}
        <View style={styles.manaFlowCard}>
          <Text style={styles.manaFlowTitle}>Mana Flow (per cycle)</Text>
          <View style={styles.manaFlowRow}>
            <Text style={styles.manaFlowLabel}>Generation</Text>
            <Text style={[styles.manaFlowValue, { color: colors.success }]}>
              +{data.mana_generation || 0}
            </Text>
          </View>
          <View style={styles.manaFlowRow}>
            <Text style={styles.manaFlowLabel}>Upkeep (spells + units)</Text>
            <Text style={[styles.manaFlowValue, { color: colors.danger }]}>
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
            Bonus mana increases the longer you wait.
          </Text>

          <View style={styles.batteryOuter}>
            <View
              style={[
                styles.batteryFill,
                { width: `${chargePercent}%`, backgroundColor: barColor },
              ]}
            />
          </View>
          <Text style={[styles.batteryPercent, { color: isOverloaded ? colors.danger : isHighCharge ? colors.warning : colors.textDim }]}>
            {isOverloaded ? "⚡ OVERLOADED" : `${chargePercent}% charged`}
          </Text>

          {/* Projected result */}
          <View style={styles.projectedCard}>
            <Text style={styles.projectedLabel}>If released now</Text>
            <Text style={[styles.projectedValue, { color: projColor }]}>
              {projectedChange >= 0 ? "+" : ""}{projectedChange} mana
            </Text>
            <View style={styles.yieldBreakdown}>
              <Text style={styles.yieldBase}>Base: {baseYield >= 0 ? "+" : ""}{baseYield}</Text>
              <Text style={styles.yieldBonus}>✨ Bonus: {bonusYield >= 0 ? "+" : ""}{bonusYield}</Text>
            </View>
            {wouldBreach && (
              <Text style={styles.breachBadge}>⚠️ VOID BREACH</Text>
            )}
          </View>

          <LoadingButton
            style={[styles.channelBtn, wouldBreach && styles.channelBtnDanger, isOverloaded && !wouldBreach && styles.channelBtnOverload]}
            onPress={handleRecharge}
          >
            <Text style={styles.channelBtnText}>
              {wouldBreach
                ? "⚠️  Release Mana (Risk Breach)"
                : isOverloaded
                  ? "⚡  Release Now!"
                  : "🔮  Release Mana"}
            </Text>
          </LoadingButton>

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
      <FadeSlideIn key={activeTab} style={{ flex: 1 }}>
        {activeTab === "tax" ? renderTaxTab() : renderManaTab()}
      </FadeSlideIn>

      {!fixedTab && <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.gold },
  tabContent: { flex: 1 },

  // ── Balance card ──
  balanceCard: {
    backgroundColor: colors.card,
    margin: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
  },
  balanceLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  balanceValue: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: "700",
  },
  balanceSub: { color: colors.faint, fontSize: 13, marginTop: 4 },

  // ── Info row ──
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: "600" },

  // ── Section label ──
  sectionLabel: {
    color: colors.textDim,
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
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
  tierAmount: { color: colors.text, fontSize: 16, fontWeight: "700" },
  tierBottom: { flexDirection: "row", gap: 16 },
  tierMeta: { color: colors.muted, fontSize: 12 },
  collectArrow: { fontSize: 22, fontWeight: "700", paddingRight: 14 },
  collectLock: { fontSize: 18, paddingRight: 14, opacity: 0.5 },
  tierCardDisabled: { opacity: 0.5 },

  // ── Cooldown banner ──
  cooldownBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(colors.danger, "18"),
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.danger, "44"),
    gap: 12,
  },
  cooldownIcon: { fontSize: 28 },
  cooldownLabel: { color: colors.danger, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  cooldownTimer: { color: colors.dangerSoft, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },

  // ── Mana battery card ──
  batteryCard: {
    backgroundColor: colors.card,
    margin: 12,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  batteryTitle: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  batterySubtitle: { color: colors.faint, fontSize: 12, marginBottom: 16 },
  batteryOuter: {
    height: 24,
    backgroundColor: colors.border,
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
    borderColor: colors.border,
  },
  batteryInfoItem: { alignItems: "center" },
  batteryInfoLabel: { color: colors.muted, fontSize: 11, marginBottom: 4 },
  batteryInfoValue: { fontSize: 14, fontWeight: "700" },

  // Mana flow card
  manaFlowCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  manaFlowTitle: {
    color: colors.textDim,
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
    borderTopColor: colors.border,
    marginTop: 6,
    paddingTop: 8,
  },
  manaFlowLabel: { color: colors.muted, fontSize: 14 },
  manaFlowValue: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },

  // Projected result
  projectedCard: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  projectedLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  projectedValue: { fontSize: 24, fontWeight: "700" },
  yieldBreakdown: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  yieldBase: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  yieldBonus: { color: colors.gold, fontSize: 12, fontWeight: "700" },
  breachBadge: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    backgroundColor: alpha(colors.danger, "18"),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },

  channelBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  channelBtnDanger: {
    backgroundColor: colors.danger,
  },
  channelBtnOverload: {
    backgroundColor: colors.warning,
  },
  channelBtnText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  overloadWarning: {
    color: colors.warning,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
