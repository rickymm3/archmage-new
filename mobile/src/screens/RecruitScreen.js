import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";

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
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recruiting, setRecruiting] = useState(false);

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

  // Start recruiting (standard tier, one tap)
  async function handleStart(unit) {
    if (recruiting) return;
    setRecruiting(true);
    try {
      await api.recruitUnits(unit.id, "standard");
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
  function handleStop(orderId) {
    Alert.alert(
      "Stop Recruiting?",
      "Arrived units will be added to your army. 50% of remaining gold is refunded.",
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await api.cancelRecruitOrder(orderId);
              showAlert("Stopped", result.message);
              loadData();
            } catch (e) {
              showAlert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  if (!data) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
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
            tintColor="#f1c40f"
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
            <Text style={[styles.headerValue, { color: slotsFull ? "#e74c3c" : "#3498db" }]}>
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
          const canStart = !isActive && !slotsFull && data.gold >= (u.base_cost * 10);

          return (
            <View key={u.id} style={[styles.unitCard, isActive && styles.unitCardActive]}>
              {/* Pulsing green strip on active cards */}
              {isActive && <PulsingStrip />}

              <View style={styles.unitBody}>
                {/* Name + status */}
                <View style={styles.unitTop}>
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
                        <TouchableOpacity
                          style={styles.collectBtn}
                          onPress={() => handleCollect(order.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.collectBtnText}>
                            Collect {prog.available} {prog.available === 1 ? "Unit" : "Units"}
                          </Text>
                        </TouchableOpacity>
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

                {/* ── IDLE: start button ── */}
                {!isActive && (
                  <TouchableOpacity
                    style={[styles.startBtn, !canStart && styles.btnDisabled]}
                    onPress={() => canStart && handleStart(u)}
                    activeOpacity={canStart ? 0.7 : 1}
                    disabled={!canStart}
                  >
                    <Text style={styles.startBtnText}>
                      {slotsFull
                        ? "All Slots Full"
                        : data.gold < (u.base_cost * 10)
                          ? "Not Enough Gold"
                          : `Start Recruiting  ·  ${(u.base_cost * 10).toLocaleString()} gold`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },

  // Header
  headerBar: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
    padding: 14,
  },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { flex: 1, alignItems: "flex-end" },
  headerLabel: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerValue: { color: "#e0e0e0", fontSize: 18, fontWeight: "700" },
  headerValueGold: { color: "#f1c40f", fontSize: 18, fontWeight: "700" },

  bonusBanner: {
    backgroundColor: "#1a2e1a",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2ecc71",
  },
  bonusText: { color: "#2ecc71", fontSize: 13, fontWeight: "600", textAlign: "center" },

  sectionLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: { color: "#666", fontSize: 14, paddingHorizontal: 14, fontStyle: "italic" },

  // Unit card
  unitCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    backgroundColor: "#1a1a2e",
    overflow: "hidden",
    flexDirection: "row",
  },
  unitCardActive: {
    borderColor: "#2ecc71",
  },
  unitCardLocked: { opacity: 0.4 },
  unitBody: { flex: 1, padding: 14 },

  // Pulsing indicators
  activeStrip: {
    flex: 1,
    backgroundColor: "#2ecc71",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2ecc71",
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
  unitName: { color: "#e0e0e0", fontSize: 16, fontWeight: "700" },
  unitType: { color: "#7c5cbf", fontSize: 12, fontWeight: "500", marginTop: 2 },
  costBadge: {
    alignItems: "flex-end",
  },
  costBadgeLabel: {
    color: "#888",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  costBadgeValue: {
    color: "#f1c40f",
    fontSize: 16,
    fontWeight: "700",
  },
  investedBadge: {
    alignItems: "flex-end",
  },
  investedLabel: {
    color: "#888",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  investedValue: {
    color: "#f1c40f",
    fontSize: 16,
    fontWeight: "700",
  },

  // Stats
  statRow: { flexDirection: "row", gap: 3, marginBottom: 10 },
  statItem: {
    flex: 1,
    backgroundColor: "#12122a",
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: "center",
  },
  statLabel: {
    color: "#666",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  statValue: { color: "#e0e0e0", fontSize: 14, fontWeight: "700" },
  statValueWarn: { color: "#e74c3c", fontSize: 14, fontWeight: "700" },
  textLocked: { color: "#666" },
  lockBadge: {
    backgroundColor: "#2a2a4a",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockBadgeText: { color: "#888", fontSize: 12, fontWeight: "600" },

  // Active section (inside card)
  activeSection: {
    backgroundColor: "#12122a",
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
    backgroundColor: "#0a0a1a",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#2ecc71",
    borderRadius: 4,
  },
  progressCount: {
    color: "#2ecc71",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
  },
  statusRow: {
    marginBottom: 10,
  },
  statusDone: {
    color: "#2ecc71",
    fontSize: 13,
    fontWeight: "600",
  },
  statusTimer: {
    color: "#888",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  collectBtn: {
    flex: 1,
    backgroundColor: "#2ecc71",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  collectBtnText: {
    color: "#0f0f1a",
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
    borderColor: "#2a2a4a",
  },
  waitingText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },
  stopBtn: {
    backgroundColor: "#2a2a4a",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  stopBtnText: {
    color: "#e74c3c",
    fontSize: 13,
    fontWeight: "700",
  },

  // Start button (idle)
  startBtn: {
    backgroundColor: "#1a2e1a",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2ecc71",
  },
  startBtnText: {
    color: "#2ecc71",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.3,
    borderColor: "#2a2a4a",
  },
});
