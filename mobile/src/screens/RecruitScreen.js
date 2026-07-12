import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import LoadingButton from "../components/LoadingButton";
import { LoadingState, ArtPlaceholder } from "../components/ui";
import { unitImage } from "../assets";
import { colors, alpha } from "../theme";

// Recruitment tiers: how much gold to invest in one order. Bigger batches
// cost proportionally more and yield proportionally more soldiers.
const TIERS = [
  { key: "cautious",     label: "Cautious",     batch: "½× batch", desc: "Dip a toe in — small, cheap batch" },
  { key: "standard",     label: "Standard",     batch: "1× batch", desc: "The usual muster" },
  { key: "aggressive",   label: "Aggressive",   batch: "2× batch", desc: "Double investment, double soldiers" },
  { key: "conscription", label: "Conscription", batch: "4× batch", desc: "Empty the villages — maximum muster" },
];

function formatCountdown(ms) {
  if (ms <= 0) return "Ready";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getOrderProgress(order) {
  const now = Date.now();
  const startedMs = new Date(order.started_at).getTime();
  const durationMs = order.duration_seconds * 1000;
  const elapsed = now - startedMs;
  const fraction = Math.min(elapsed / durationMs, 1.0);
  const arrived = Math.floor(order.total_quantity * fraction);
  const available = Math.max(arrived - order.accepted_quantity, 0);
  const remaining = Math.max(startedMs + durationMs - now, 0);
  const nextUnitFraction = arrived < order.total_quantity
    ? (arrived + 1) / order.total_quantity
    : 1;
  const nextUnitMs = Math.max(startedMs + durationMs * nextUnitFraction - now, 0);
  return { fraction, arrived, available, remaining, nextUnitMs, percent: Math.round(fraction * 100) };
}

// Pulsing green dot for active recruitment
function PulsingDot() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[styles.pulsingDot, { opacity: pulse }]} />;
}

// Pulsing green strip on left edge of active card
function PulsingStrip() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ opacity: pulse, width: 5, alignSelf: "stretch" }}>
      <View style={styles.activeStrip} />
    </Animated.View>
  );
}

export default function RecruitScreen() {
  const { showAlert, showConfirm } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  const [tierModal, setTierModal] = useState(null); // unit whose tier is being picked

  const activeOrders = data?.active_orders || [];

  // Tick every 2s to update countdowns
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (activeOrders.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, [activeOrders.length]);

  async function loadData() {
    try {
      setData(await api.getRecruitableUnits());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Tap "Recruit" → pick a tier (batch size), then start the order.
  async function startWithTier(unit, tierKey) {
    if (recruiting) return;
    setTierModal(null);
    setRecruiting(true);
    try {
      const result = await api.recruitUnits(unit.id, tierKey);
      showAlert("Muster Begun!", result.message);
      loadData();
    } catch (e) {
      showAlert("Can't Recruit", e.message);
    } finally {
      setRecruiting(false);
    }
  }

  // Collect arrived units
  async function handleCollect(orderId) {
    try {
      const result = await api.acceptRecruitOrder(orderId);
      showAlert("Collected!", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  // Stop recruiting
  async function handleStop(orderId) {
    const confirmed = await showConfirm(
      "Stop Recruiting?",
      "Arrived units will be added to your army. 50% of remaining gold is refunded.",
      { confirmText: "Stop", destructive: true }
    );
    if (!confirmed) return;
    try {
      const result = await api.cancelRecruitOrder(orderId);
      showAlert("Stopped", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  // Map unitId → active order so state shows inline on the card
  const orderByUnit = {};
  activeOrders.forEach((o) => { orderByUnit[o.unit.id] = o; });

  const unlocked = data.units.filter((u) => u.unlocked);
  const locked = data.units.filter((u) => !u.unlocked);
  const slotsUsed = data.used_slots || 0;
  const slotsMax = data.max_slots || 1;
  const slotsFull = slotsUsed >= slotsMax;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>Barracks</Text>
            <Text style={styles.headerValue}>🏰 Lvl {data.barracks_level}</Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>Recruiting</Text>
            <Text style={[styles.headerValue, { color: slotsFull ? colors.danger : colors.info }]}>
              {slotsUsed}/{slotsMax}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>Gold</Text>
            <Text style={styles.headerValueGold}>💰 {data.gold?.toLocaleString()}</Text>
          </View>
        </View>

        {data.recruit_bonus > 0 && (
          <View style={styles.bonusBanner}>
            <Text style={styles.bonusText}>
              ✨ Spell bonus: +{Math.round(data.recruit_bonus * 100)}% recruits
            </Text>
          </View>
        )}

        {/* Unit cards — active state renders inline */}
        <Text style={styles.sectionLabel}>Units</Text>
        {unlocked.length === 0 && (
          <Text style={styles.emptyText}>Build a Barracks to unlock recruitment.</Text>
        )}

        {unlocked.map((u) => {
          const order = orderByUnit[u.id];
          const isActive = !!order;
          const prog = isActive ? getOrderProgress(order) : null;
          const hasReady = prog && prog.available > 0;
          const allArrived = prog && prog.fraction >= 1.0;
          // Cheapest tier (cautious) gates the button; the picker shows the rest.
          const cheapest = u.tier_costs?.cautious ?? (u.base_cost * 5);
          const canStart = !isActive && !slotsFull && data.gold >= cheapest;

          return (
            <View key={u.id} style={[styles.unitCard, isActive && styles.unitCardActive]}>
              {/* Pulsing green strip on active cards */}
              {isActive && <PulsingStrip />}

              <View style={styles.unitBody}>
                {/* Name + status */}
                <View style={styles.unitTop}>
                  <ArtPlaceholder emoji="🪖" label={null} size={44} source={unitImage(u.slug)} style={{ marginRight: 10 }} />
                  <View style={styles.unitInfo}>
                    <View style={styles.unitNameRow}>
                      {isActive && <PulsingDot />}
                      <Text style={styles.unitName}>{u.name}</Text>
                    </View>
                    <Text style={styles.unitType}>
                      {u.element ? `${u.element} ` : ""}{u.unit_type || "infantry"}
                      {u.owned_quantity > 0 ? `  ·  Owned: ${u.owned_quantity}` : ""}
                    </Text>
                  </View>
                  {!isActive && (
                    <View style={styles.costBadge}>
                      <Text style={styles.costBadgeLabel}>Cost</Text>
                      <Text style={styles.costBadgeValue}>💰 {(u.base_cost * 10).toLocaleString()}</Text>
                    </View>
                  )}
                  {isActive && (
                    <View style={styles.investedBadge}>
                      <Text style={styles.investedLabel}>Invested</Text>
                      <Text style={styles.investedValue}>💰 {order.gold_invested?.toLocaleString()}</Text>
                    </View>
                  )}
                </View>

                {/* Stats */}
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>ATK</Text>
                    <Text style={styles.statValue}>{u.attack}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>DEF</Text>
                    <Text style={styles.statValue}>{u.defense}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>SPD</Text>
                    <Text style={styles.statValue}>{u.speed}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>UPKEEP</Text>
                    <Text style={styles.statValueWarn}>{u.upkeep_cost}/d</Text>
                  </View>
                </View>

                {/* ── ACTIVE: progress + collect ── */}
                {isActive && (
                  <View style={styles.activeSection}>
                    {/* Progress bar */}
                    <View style={styles.progressRow}>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${prog.percent}%` }]} />
                      </View>
                      <Text style={styles.progressCount}>{prog.arrived}/{order.total_quantity}</Text>
                    </View>

                    {/* Status */}
                    <View style={styles.statusRow}>
                      {allArrived ? (
                        <Text style={styles.statusDone}>All units have arrived!</Text>
                      ) : (
                        <Text style={styles.statusTimer}>
                          Next unit in {formatCountdown(prog.nextUnitMs)}  ·  Done in {formatCountdown(prog.remaining)}
                        </Text>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                      {hasReady ? (
                        <LoadingButton
                          style={styles.collectBtn}
                          onPress={() => handleCollect(order.id)}
                        >
                          <Text style={styles.collectBtnText}>
                            Collect {prog.available} {prog.available === 1 ? "Unit" : "Units"}
                          </Text>
                        </LoadingButton>
                      ) : (
                        <View style={styles.waitingPill}>
                          <Text style={styles.waitingText}>Recruiting...</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.stopBtn}
                        onPress={() => handleStop(order.id)}
                      >
                        <Text style={styles.stopBtnText}>Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── IDLE: start button opens the tier picker ── */}
                {!isActive && (
                  <TouchableOpacity
                    style={[styles.startBtn, !canStart && styles.btnDisabled]}
                    onPress={() => setTierModal(u)}
                    disabled={!canStart}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.startBtnText}>
                      {slotsFull
                        ? "All Slots Full"
                        : data.gold < cheapest
                          ? `Need 💰 ${cheapest.toLocaleString()}`
                          : `📯 Recruit  ·  from ${cheapest.toLocaleString()} gold`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Locked units */}
        {locked.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Locked</Text>
            {locked.map((u) => (
              <View key={u.id} style={[styles.unitCard, styles.unitCardLocked]}>
                <View style={styles.unitBody}>
                  <View style={styles.unitTop}>
                    <View style={styles.unitInfo}>
                      <Text style={[styles.unitName, styles.textLocked]}>{u.name}</Text>
                      <Text style={[styles.unitType, styles.textLocked]}>
                        {u.element ? `${u.element} ` : ""}{u.unit_type || "infantry"}
                      </Text>
                    </View>
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockBadgeText}>🔒 Barracks {u.required_level}</Text>
                    </View>
                  </View>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>ATK</Text>
                      <Text style={[styles.statValue, styles.textLocked]}>{u.attack}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>DEF</Text>
                      <Text style={[styles.statValue, styles.textLocked]}>{u.defense}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>SPD</Text>
                      <Text style={[styles.statValue, styles.textLocked]}>{u.speed}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── TIER PICKER ── */}
      {tierModal && (
        <Modal transparent visible animationType="slide" onRequestClose={() => setTierModal(null)}>
          <View style={styles.tierOverlay}>
            <View style={styles.tierSheet}>
              <View style={styles.tierGrip} />
              <Text style={styles.tierTitle}>Recruit {tierModal.name}</Text>
              <Text style={styles.tierSub}>
                💰 {data.gold?.toLocaleString()} available · bigger batches take the same time
              </Text>

              {TIERS.map((t) => {
                const cost = tierModal.tier_costs?.[t.key] ?? 0;
                const affordable = data.gold >= cost && cost > 0;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tierOption, !affordable && styles.tierOptionDisabled]}
                    onPress={() => startWithTier(tierModal, t.key)}
                    disabled={!affordable || recruiting}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.tierNameRow}>
                        <Text style={[styles.tierName, !affordable && styles.tierTextDisabled]}>{t.label}</Text>
                        <View style={styles.tierBatchBadge}>
                          <Text style={styles.tierBatchTxt}>{t.batch}</Text>
                        </View>
                      </View>
                      <Text style={[styles.tierDesc, !affordable && styles.tierTextDisabled]}>{t.desc}</Text>
                    </View>
                    <Text style={[styles.tierCost, !affordable && { color: colors.danger }]}>
                      💰 {cost.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.tierCancel} onPress={() => setTierModal(null)}>
                <Text style={styles.tierCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },

  // Header
  headerBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 14,
  },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { flex: 1, alignItems: "flex-end" },
  headerLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  headerValueGold: { color: colors.gold, fontSize: 18, fontWeight: "700" },

  bonusBanner: {
    backgroundColor: alpha(colors.success, "22"),
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.success,
  },
  bonusText: { color: colors.success, fontSize: 13, fontWeight: "600", textAlign: "center" },

  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: { color: colors.faint, fontSize: 14, paddingHorizontal: 14, fontStyle: "italic" },

  // Unit card
  unitCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    flexDirection: "row",
  },
  unitCardActive: {
    borderColor: colors.success,
  },
  unitCardLocked: { opacity: 0.4 },
  unitBody: { flex: 1, padding: 14 },

  // Pulsing indicators
  activeStrip: {
    flex: 1,
    backgroundColor: colors.success,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },

  unitTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  unitInfo: { flex: 1 },
  unitNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unitName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  unitType: { color: colors.accent, fontSize: 12, fontWeight: "500", marginTop: 2 },
  costBadge: {
    alignItems: "flex-end",
  },
  costBadgeLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  costBadgeValue: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  investedBadge: {
    alignItems: "flex-end",
  },
  investedLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  investedValue: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },

  // Stats
  statRow: { flexDirection: "row", gap: 3, marginBottom: 10 },
  statItem: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: "center",
  },
  statLabel: {
    color: colors.faint,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statValueWarn: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  textLocked: { color: colors.faint },
  lockBadge: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockBadgeText: { color: colors.muted, fontSize: 12, fontWeight: "600" },

  // Active section (inside card)
  activeSection: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 12,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressCount: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
  },
  statusRow: {
    marginBottom: 10,
  },
  statusDone: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "600",
  },
  statusTimer: {
    color: colors.muted,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  collectBtn: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  collectBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  waitingPill: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitingText: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "600",
  },
  stopBtn: {
    backgroundColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  stopBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },

  // Start button (idle)
  startBtn: {
    backgroundColor: alpha(colors.success, "22"),
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success,
  },
  startBtnText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.3,
    borderColor: colors.border,
  },

  /* tier picker (bottom sheet) */
  tierOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  tierSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingBottom: 28,
  },
  tierGrip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  tierTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  tierSub: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 14 },
  tierOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    marginBottom: 8,
  },
  tierOptionDisabled: { opacity: 0.5 },
  tierNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tierBatchBadge: {
    backgroundColor: alpha(colors.accent, "33"),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tierBatchTxt: { color: colors.accent, fontSize: 10, fontWeight: "800" },
  tierDesc: { color: colors.muted, fontSize: 11, marginTop: 3 },
  tierCost: { color: colors.gold, fontSize: 14, fontWeight: "800", marginLeft: 10, fontVariant: ["tabular-nums"] },
  tierTextDisabled: { color: colors.faint },
  tierCancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  tierCancelTxt: { color: colors.muted, fontSize: 14 },
});
