import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Animated,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";

// ── Preview calculation helpers (mirrors Rails StartService) ──

function calcDuration(land, speed, escorted) {
  const base = Math.ceil(10 * Math.exp(0.08 * land));
  const reduction = escorted ? Math.min(speed * 0.5, 50) : 0;
  return Math.ceil(base * (1 - reduction / 100));
}

function calcPotential(qty, speed) {
  if (qty <= 0) return 1;
  return Math.max(1, Math.ceil(1 + Math.log(qty + 1) * (speed / 20)));
}

function calcDanger(land, escorted) {
  let base = Math.max((land - 20) / 2, 0);
  base = Math.min(base, 40);
  return Math.ceil(base * (escorted ? 0.5 : 1.0));
}

function formatDuration(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatCountdown(diffMs) {
  if (diffMs <= 0) return "00:00";
  const total = Math.ceil(diffMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function dangerMeta(pct) {
  if (pct <= 0) return { label: "Safe", color: "#2ecc71" };
  if (pct < 10) return { label: "Low Risk", color: "#3498db" };
  if (pct < 20) return { label: "Moderate", color: "#f39c12" };
  return { label: "Dangerous", color: "#e74c3c" };
}

function eventColor(text) {
  if (!text) return "#888";
  const lower = text.toLowerCase();
  if (lower.includes("combat") || lower.includes("ambush") || lower.includes("attacked") || lower.includes("fought")) return "#e74c3c";
  if (lower.includes("discover") || lower.includes("found") || lower.includes("treasure") || lower.includes("fertile")) return "#2ecc71";
  if (lower.includes("lost") || lower.includes("collapse") || lower.includes("setback") || lower.includes("trap")) return "#f39c12";
  return "#888";
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ExplorationsScreen() {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null); // null = no escort
  const [sliderValue, setSliderValue] = useState(1);
  const [countdown, setCountdown] = useState("");
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  async function loadData() {
    try {
      const d = await api.getExplorations();
      setData(d);
      if (!d.active) setCountdown("");
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [])
  );

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!data?.active) return;

    const tick = () => {
      const diff = new Date(data.active.finishes_at).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("00:00");
        clearInterval(timerRef.current);
        loadData();
      } else {
        setCountdown(formatCountdown(diff));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [data?.active?.id, data?.active?.finishes_at]);

  // Pulsing animation for active badge
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  function selectUnit(unit) {
    if (selectedUnit?.unit_id === unit.unit_id) {
      setSelectedUnit(null);
      setSliderValue(1);
    } else {
      setSelectedUnit(unit);
      setSliderValue(Math.min(1, unit.available));
    }
  }

  function selectNoEscort() {
    setSelectedUnit(null);
    setSliderValue(0);
  }

  async function handleDispatch() {
    if (dispatching) return;
    setDispatching(true);
    try {
      const unitId = selectedUnit ? selectedUnit.unit_id : null;
      const qty = selectedUnit ? sliderValue : 0;
      const result = await api.startExploration(unitId, qty);
      showAlert("Dispatched!", result.message);
      setSelectedUnit(null);
      setSliderValue(1);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    } finally {
      setDispatching(false);
    }
  }

  async function handleClaim(id) {
    try {
      const result = await api.claimExploration(id);
      showAlert("Claimed!", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  function toggleLog(id) {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const land = data.land || 0;
  const escorted = selectedUnit != null;
  const speed = selectedUnit?.speed || 5;
  const previewDuration = calcDuration(land, speed, escorted);
  const previewPotential = calcPotential(escorted ? sliderValue : 0, speed);
  const previewDanger = calcDanger(land, escorted);
  const danger = dangerMeta(previewDanger);

  // ── Render helpers ──

  function renderPreviewPanel() {
    return (
      <View style={styles.previewPanel}>
        <Text style={styles.previewTitle}>Mission Preview</Text>
        <View style={styles.previewRow}>
          <View style={styles.previewStat}>
            <Text style={styles.previewEmoji}>⏱</Text>
            <Text style={styles.previewValue}>{formatDuration(previewDuration)}</Text>
            <Text style={styles.previewLabel}>Duration</Text>
          </View>
          <View style={[styles.previewStat, styles.previewStatCenter]}>
            <Text style={styles.previewEmoji}>🏔</Text>
            <Text style={[styles.previewValue, { color: "#2ecc71" }]}>~{previewPotential}</Text>
            <Text style={styles.previewLabel}>Max Land</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewEmoji}>⚔️</Text>
            <Text style={[styles.previewValue, { color: danger.color }]}>
              {previewDanger}%
            </Text>
            <Text style={[styles.previewLabel, { color: danger.color }]}>{danger.label}</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderUnitList() {
    return (
      <ScrollView style={styles.unitList} contentContainerStyle={styles.unitListContent}>
        {/* No Escort option */}
        <TouchableOpacity
          style={[styles.unitCard, !escorted && styles.unitCardSelected]}
          onPress={selectNoEscort}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.unitName}>🚶 No Escort</Text>
            <Text style={styles.unitSub}>Higher risk, no speed bonus</Text>
          </View>
        </TouchableOpacity>

        {/* Unit cards */}
        {data.available_units.map((u) => {
          const isSel = selectedUnit?.unit_id === u.unit_id;
          return (
            <TouchableOpacity
              key={u.unit_id}
              style={[styles.unitCard, isSel && styles.unitCardSelected]}
              onPress={() => selectUnit(u)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.unitName}>{u.name}</Text>
                <View style={styles.unitStatsRow}>
                  <Text style={styles.unitStat}>⚡ {u.speed}</Text>
                  <Text style={styles.unitStat}>⚔️ {u.attack}</Text>
                  <Text style={styles.unitStat}>🛡 {u.defense}</Text>
                </View>
              </View>
              <View style={styles.unitRight}>
                <Text style={styles.unitAvail}>{u.available}</Text>
                <Text style={styles.unitAvailLabel}>available</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {data.available_units.length === 0 && (
          <Text style={styles.emptyText}>No units available. Sending unescorted party.</Text>
        )}
      </ScrollView>
    );
  }

  function renderBottomPanel() {
    return (
      <View style={styles.bottomPanel}>
        {/* Slider for selected unit */}
        {selectedUnit && selectedUnit.available > 0 && (
          <View style={styles.sliderBox}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Escort Size</Text>
              <TouchableOpacity onPress={() => setSliderValue(selectedUnit.available)}>
                <Text style={styles.maxBtn}>MAX</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sliderBigNum}>{sliderValue}</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={selectedUnit.available}
              step={1}
              value={sliderValue}
              onValueChange={setSliderValue}
              minimumTrackTintColor="#f1c40f"
              maximumTrackTintColor="#2a2a4a"
              thumbTintColor="#f1c40f"
            />
            <View style={styles.sliderRange}>
              <Text style={styles.sliderRangeText}>1</Text>
              <Text style={styles.sliderRangeText}>{selectedUnit.available}</Text>
            </View>
          </View>
        )}

        {/* Mission Preview */}
        {renderPreviewPanel()}

        {/* Dispatch button */}
        <TouchableOpacity
          style={[styles.dispatchBtn, dispatching && { opacity: 0.5 }]}
          onPress={handleDispatch}
          disabled={dispatching}
        >
          <Text style={styles.dispatchText}>
            {dispatching ? "Dispatching..." : "⚔️  Dispatch Expedition"}
          </Text>
        </TouchableOpacity>

        {renderHistoryButton()}
      </View>
    );
  }

  function renderActiveExploration() {
    const e = data.active;
    const unitLabel = e.unit_name
      ? `${e.quantity}× ${e.unit_name}`
      : "Unescorted Party";
    const potential = e.resources_found?.potential_land || "?";

    return (
      <View style={styles.activeCard}>
        <View style={styles.activeBadgeRow}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <Text style={styles.activeBadge}>IN PROGRESS</Text>
        </View>
        <Text style={styles.activeUnit}>{unitLabel}</Text>
        <Text style={styles.countdownText}>{countdown || "..."}</Text>
        <View style={styles.activeStatsRow}>
          <Text style={styles.activeStat}>🏔 ~{potential} land potential</Text>
          <Text style={styles.activeStat}>🕐 Started {timeAgo(e.started_at)}</Text>
        </View>
      </View>
    );
  }

  function renderRewardsLine(e) {
    const parts = [];
    if (e.land_reward) parts.push(`🏔 +${e.land_reward}`);
    const res = e.resources_found || {};
    if (res.gold) parts.push(`💰 +${res.gold}`);
    if (res.mana) parts.push(`🔮 +${res.mana}`);
    if (res.units_found) parts.push(`🗡 +${res.units_found}`);
    return parts.length > 0 ? parts.join("   ") : "No rewards";
  }

  function renderExpeditionLog(e) {
    const events = e.events || [];
    if (events.length === 0) return null;
    const isExpanded = expandedLogs.has(e.id);

    return (
      <View style={styles.logSection}>
        <TouchableOpacity
          onPress={() => toggleLog(e.id)}
          style={styles.logToggle}
        >
          <Text style={styles.logToggleText}>
            {isExpanded ? "▼" : "▶"} Expedition Log ({events.length})
          </Text>
        </TouchableOpacity>
        {isExpanded &&
          events.map((ev, i) => {
            const text = typeof ev === "string" ? ev : ev.description || ev.text || JSON.stringify(ev);
            return (
              <View key={i} style={styles.logEntry}>
                <View style={[styles.logDot, { backgroundColor: eventColor(text) }]} />
                <Text style={[styles.logText, { color: eventColor(text) }]}>{text}</Text>
              </View>
            );
          })}
      </View>
    );
  }

  function renderCompletedExplorations() {
    if (data.completed.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✅ Ready to Claim</Text>
        {data.completed.map((e) => {
          const survived = e.quantity - (e.resources_found?.losses || 0);
          const allSurvived = survived >= e.quantity;
          return (
            <View key={e.id} style={styles.completedCard}>
              <View style={styles.completedHeader}>
                <Text style={styles.completedUnit}>
                  {e.unit_name ? `${e.unit_name}` : "Unescorted"}
                </Text>
                {e.quantity > 0 && (
                  <Text
                    style={[
                      styles.survivorText,
                      { color: allSurvived ? "#2ecc71" : "#f39c12" },
                    ]}
                  >
                    {survived}/{e.quantity} survived
                  </Text>
                )}
              </View>
              <Text style={styles.rewardsText}>{renderRewardsLine(e)}</Text>
              {renderExpeditionLog(e)}
              <TouchableOpacity
                style={styles.claimButton}
                onPress={() => handleClaim(e.id)}
              >
                <Text style={styles.claimText}>Claim & Recover</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  }

  function renderHistoryButton() {
    if (!data.claimed || data.claimed.length === 0) return null;
    return (
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => setShowHistory(true)}
      >
        <Text style={styles.historyBtnText}>📜  Expedition History ({data.claimed.length})</Text>
      </TouchableOpacity>
    );
  }

  function renderHistoryModal() {
    return (
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📜 Expedition History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {(data.claimed || []).map((e) => (
                <View key={e.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyUnit}>
                      {e.unit_name
                        ? `${e.quantity}× ${e.unit_name}`
                        : "Unescorted"}
                    </Text>
                    <Text style={styles.historyTime}>{timeAgo(e.updated_at || e.started_at)}</Text>
                  </View>
                  <Text style={styles.historyRewards}>{renderRewardsLine(e)}</Text>
                  {renderExpeditionLog(e)}
                  <View style={styles.claimedBadge}>
                    <Text style={styles.claimedBadgeText}>Claimed</Text>
                  </View>
                </View>
              ))}
              {data.claimed.length === 0 && (
                <Text style={styles.emptyText}>No expedition history yet.</Text>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // When dispatching: use flex layout with unit list filling space and bottom panel pinned
  if (!data.active && data.completed.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>🗺  Send Exploration Party</Text>
        {renderUnitList()}
        {renderBottomPanel()}
        {renderHistoryModal()}
      </View>
    );
  }

  // Otherwise: scrollable view for active/completed states
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadData();
            setRefreshing(false);
          }}
          tintColor="#f1c40f"
        />
      }
    >
      {data.active && renderActiveExploration()}
      {renderCompletedExplorations()}
      {renderHistoryButton()}
      <View style={{ height: 40 }} />
      {renderHistoryModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  section: { marginTop: 8 },
  sectionTitle: {
    color: "#f1c40f",
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // ── Unit selection cards (vertical scroll) ──
  unitList: { flex: 1 },
  unitListContent: { paddingHorizontal: 12, paddingBottom: 8 },
  unitCard: {
    backgroundColor: "#1a1a2e",
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#2a2a4a",
  },
  unitCardSelected: {
    borderColor: "#f1c40f",
    backgroundColor: "#1f1a30",
  },
  unitName: { color: "#e0e0e0", fontSize: 15, fontWeight: "700" },
  unitSub: { color: "#888", fontSize: 12, marginTop: 2 },
  unitStatsRow: { flexDirection: "row", marginTop: 4, gap: 12 },
  unitStat: { color: "#aaa", fontSize: 12 },
  unitRight: { alignItems: "center", marginLeft: 12 },
  unitAvail: { color: "#f1c40f", fontSize: 18, fontWeight: "700" },
  unitAvailLabel: { color: "#888", fontSize: 10 },
  emptyText: { color: "#666", textAlign: "center", padding: 20 },

  // ── Bottom panel (pinned) ──
  bottomPanel: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
    paddingTop: 8,
    paddingBottom: 8,
  },

  // ── Slider ──
  sliderBox: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: { color: "#ccc", fontSize: 14, fontWeight: "600" },
  maxBtn: {
    color: "#f1c40f",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#f1c40f",
    borderRadius: 4,
  },
  sliderBigNum: {
    color: "#f1c40f",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 4,
  },
  slider: { width: "100%", height: 40 },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderRangeText: { color: "#666", fontSize: 12 },

  // ── Preview panel ──
  previewPanel: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  previewTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-around" },
  previewStat: { alignItems: "center", flex: 1 },
  previewStatCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2a2a4a",
  },
  previewEmoji: { fontSize: 22, marginBottom: 4 },
  previewValue: { color: "#e0e0e0", fontSize: 22, fontWeight: "700" },
  previewLabel: { color: "#888", fontSize: 11, marginTop: 2 },

  // ── Dispatch button ──
  dispatchBtn: {
    backgroundColor: "#f1c40f",
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  dispatchText: { color: "#0f0f1a", fontSize: 16, fontWeight: "700" },

  // ── Active exploration card ──
  activeCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#f1c40f",
  },
  activeBadgeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f1c40f",
    marginRight: 8,
  },
  activeBadge: {
    color: "#f1c40f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  activeUnit: { color: "#e0e0e0", fontSize: 16, fontWeight: "600", marginBottom: 8 },
  countdownText: {
    color: "#f1c40f",
    fontSize: 38,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 8,
    fontVariant: ["tabular-nums"],
  },
  activeStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  activeStat: { color: "#aaa", fontSize: 13 },

  // ── Completed cards ──
  completedCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2ecc71",
  },
  completedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  completedUnit: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  survivorText: { fontSize: 13, fontWeight: "600" },
  rewardsText: { color: "#e0e0e0", fontSize: 14, marginBottom: 8 },
  claimButton: {
    backgroundColor: "#2ecc71",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  claimText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // ── Expedition log ──
  logSection: { marginTop: 4, marginBottom: 4 },
  logToggle: { paddingVertical: 6 },
  logToggleText: { color: "#888", fontSize: 13, fontWeight: "600" },
  logEntry: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 3, paddingLeft: 4 },
  logDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, marginRight: 8 },
  logText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // ── History button ──
  historyBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  historyBtnText: { color: "#aaa", fontSize: 14, fontWeight: "600" },

  // ── History modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0f0f1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  modalTitle: { color: "#f1c40f", fontSize: 17, fontWeight: "700" },
  modalClose: { color: "#888", fontSize: 22, padding: 4 },
  modalScroll: { paddingTop: 8 },

  // ── Claimed history cards ──
  historyCard: {
    backgroundColor: "#151528",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#222240",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyUnit: { color: "#aaa", fontSize: 14, fontWeight: "600" },
  historyTime: { color: "#666", fontSize: 12 },
  historyRewards: { color: "#999", fontSize: 13, marginBottom: 4 },
  claimedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#2a2a4a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  claimedBadgeText: { color: "#888", fontSize: 11, fontWeight: "600" },
});
