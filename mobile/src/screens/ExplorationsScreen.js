import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import LoadingButton from "../components/LoadingButton";
import { LoadingState, ProgressBar } from "../components/ui";
import { useDrawer } from "../components/GameHubShell";
import { CompactShell, StatStrip, CompactNote } from "../components/DrawerCompact";
import { ui as art, unitImage } from "../assets";
import { colors, alpha } from "../theme";

const { width: RAW_W } = Dimensions.get("window");
const SCREEN_W = Platform.OS === "web" ? Math.min(RAW_W, 480) : RAW_W;
const GRID_COLS = 4;
const GRID_GAP = 8;
const TILE_W = (SCREEN_W - 24 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

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

function formatClock(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dangerMeta(pct) {
  if (pct <= 0) return { label: "Safe", color: colors.success };
  if (pct < 10) return { label: "Low Risk", color: colors.info };
  if (pct < 20) return { label: "Moderate", color: colors.warning };
  return { label: "Dangerous", color: colors.danger };
}

function eventColor(text) {
  if (!text) return colors.muted;
  const lower = text.toLowerCase();
  if (lower.includes("combat") || lower.includes("ambush") || lower.includes("attacked") || lower.includes("fought")) return colors.danger;
  if (lower.includes("discover") || lower.includes("found") || lower.includes("treasure") || lower.includes("fertile")) return colors.success;
  if (lower.includes("lost") || lower.includes("collapse") || lower.includes("setback") || lower.includes("trap")) return colors.warning;
  return colors.muted;
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

function rewardParts(e) {
  const parts = [];
  const res = e.resources_found || {};
  const land = res.land || e.land_reward;
  if (land) parts.push(`🏔 +${land} land`);
  if (res.gold) parts.push(`💰 +${res.gold}`);
  if (res.mana) parts.push(`🔮 +${res.mana}`);
  if (Array.isArray(res.units_found)) {
    res.units_found.forEach((u) => {
      parts.push(`🗡 +${u.amount} ${(u.slug || "unit").replace(/_/g, " ")}`);
    });
  }
  return parts;
}

/* ================================================================
   HERO — full-width art with overlaid title/status + scrim.
   ================================================================ */
function Hero({ title, subtitle, accent = colors.gold, onHistory, historyCount }) {
  return (
    <View style={styles.hero}>
      <Image source={art.expeditionMap} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.heroTint} />

      {historyCount > 0 && (
        <TouchableOpacity style={styles.historyFab} onPress={onHistory} activeOpacity={0.8}>
          <Text style={styles.historyFabTxt}>📜</Text>
        </TouchableOpacity>
      )}

      <View style={styles.heroScrim}>
        <Text style={[styles.heroTitle, { color: accent }]}>{title}</Text>
        {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/* ================================================================
   MAIN SCREEN
   ================================================================ */
export default function ExplorationsScreen() {
  const drawer = useDrawer();
  const expanded = drawer ? drawer.expanded : true;
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null); // null = solo
  const [sliderValue, setSliderValue] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [dispatching, setDispatching] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  async function loadData() {
    try {
      const d = await api.getExplorations();
      setData(d);
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

  // Single 1s clock drives countdown + progress; polls when expedition is due.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!data?.active) return;

    let lastPoll = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (new Date(data.active.finishes_at).getTime() <= t && t - lastPoll >= 3000) {
        lastPoll = t;
        loadData();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [data?.active?.id, data?.active?.finishes_at]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  function toggleUnit(unit) {
    if (selectedUnit?.unit_id === unit.unit_id) {
      setSelectedUnit(null);
      setSliderValue(1);
    } else {
      setSelectedUnit(unit);
      setSliderValue(Math.min(Math.max(1, Math.ceil(unit.available / 2)), unit.available));
    }
  }

  async function handleDispatch() {
    if (dispatching) return;
    setDispatching(true);
    try {
      const unitId = selectedUnit ? selectedUnit.unit_id : null;
      const qty = selectedUnit ? sliderValue : 0;
      await api.startExploration(unitId, qty);
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

  if (!data) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  const historyCount = data.claimed?.length || 0;

  /* ── STATE C: RETURNED (claim) ── */
  if (data.completed.length > 0) {
    const e = data.completed[0];
    const res = e.resources_found || {};
    const survived = res.survivors != null ? res.survivors : e.quantity;
    const isFailed = (e.events || []).some((ev) => typeof ev === "string" && ev.includes("FAILURE"));
    const parts = rewardParts(e);
    const moreWaiting = data.completed.length - 1;
    const events = e.events || [];

    // Collapsed: outcome + rewards + claim, one tap. Log lives above.
    if (!expanded) {
      return (
        <CompactShell hint="Pull up for the expedition log">
          <CompactNote color={isFailed ? colors.danger : colors.gold}>
            {isFailed ? "💀 Expedition lost" : "🏆 Expedition returned!"}
            {e.quantity > 0 ? ` · ${survived}/${e.quantity} escorts survived` : ""}
          </CompactNote>
          <CompactNote color={colors.text}>{parts.length > 0 ? parts.join("   ") : "No rewards recovered"}</CompactNote>
          <LoadingButton style={[styles.actionBtn, styles.actionBtnCompact, { backgroundColor: colors.success }]} onPress={() => handleClaim(e.id)}>
            <Text style={styles.actionBtnTxt}>🎁 Claim & Recover</Text>
          </LoadingButton>
          {moreWaiting > 0 && (
            <CompactNote>+{moreWaiting} more expedition{moreWaiting > 1 ? "s" : ""} waiting</CompactNote>
          )}
        </CompactShell>
      );
    }

    return (
      <View style={styles.container}>
        <Hero
          title={isFailed ? "💀 Expedition Lost" : "🏆 Expedition Returned!"}
          subtitle={e.unit_name ? `${e.unit_name} party` : "Unescorted party"}
          accent={isFailed ? colors.danger : colors.gold}
          onHistory={() => setShowHistory(true)}
          historyCount={historyCount}
        />

        <View style={styles.content}>
          {/* Rewards */}
          <View style={styles.rewardRow}>
            {parts.length > 0 ? (
              parts.map((p, i) => (
                <View key={i} style={[styles.rewardChip, isFailed && { borderColor: alpha(colors.danger, "55") }]}>
                  <Text style={styles.rewardChipTxt}>{p}</Text>
                </View>
              ))
            ) : (
              <View style={styles.rewardChip}>
                <Text style={styles.rewardChipTxt}>No rewards recovered</Text>
              </View>
            )}
          </View>

          {e.quantity > 0 && (
            <Text style={[styles.survivorLine, { color: survived >= e.quantity ? colors.success : colors.warning }]}>
              {survived >= e.quantity
                ? `All ${e.quantity} escorts returned safely`
                : `${survived} of ${e.quantity} escorts survived`}
            </Text>
          )}

          {/* Journal — fixed window, scrolls internally */}
          {events.length > 0 && (
            <View style={styles.journal}>
              <Text style={styles.journalTitle}>📜 Expedition Log</Text>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 6 }}>
                {events.map((ev, i) => {
                  const text = typeof ev === "string" ? ev : ev.description || ev.text || "";
                  const isIndented = text.startsWith("  ");
                  return (
                    <View key={i} style={[styles.logEntry, isIndented && { marginLeft: 14 }]}>
                      {!isIndented && <View style={[styles.logDot, { backgroundColor: eventColor(text) }]} />}
                      <Text style={[styles.logText, { color: eventColor(text) }]}>{text}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.actionBar}>
          {moreWaiting > 0 && (
            <Text style={styles.moreWaiting}>+{moreWaiting} more expedition{moreWaiting > 1 ? "s" : ""} waiting</Text>
          )}
          <LoadingButton style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => handleClaim(e.id)}>
            <Text style={styles.actionBtnTxt}>🎁 Claim & Recover</Text>
          </LoadingButton>
        </View>

        {renderHistoryModal()}
      </View>
    );
  }

  /* ── STATE B: UNDERWAY ── */
  if (data.active) {
    const e = data.active;
    const startMs = new Date(e.started_at).getTime();
    const endMs = new Date(e.finishes_at).getTime();
    const frac = Math.max(0, Math.min(1, (now - startMs) / Math.max(1, endMs - startMs)));
    const pct = Math.round(frac * 100);
    const returning = now >= endMs;
    const countdown = formatCountdown(endMs - now);
    const partyLabel = e.unit_name ? `${e.quantity}× ${e.unit_name}` : "Unescorted Party";
    const potential = e.resources_found?.potential_land || "?";
    const partyEmoji = e.unit_name ? "🐎" : "🚶";

    // Collapsed: the trail + countdown — the only things that matter while
    // the party is out. Nothing to act on until they return.
    if (!expanded) {
      return (
        <CompactShell hint="Pull up for expedition details">
          <CompactNote color={colors.gold}>
            🧭 {partyLabel} · {returning ? "returning home…" : `back in ${countdown}`}
          </CompactNote>
          <View style={styles.trailRow}>
            <Text style={styles.trailEnd}>🏰</Text>
            <View style={styles.trailBarWrap}>
              <ProgressBar percent={pct} color={colors.gold} height={8} />
              <Text style={[styles.trailMarker, { left: `${Math.min(94, Math.max(0, pct))}%` }]}>{partyEmoji}</Text>
            </View>
            <Text style={styles.trailEnd}>🏔</Text>
          </View>
          <CompactNote>
            🏔 ~{potential} land potential · returns at {formatClock(e.finishes_at)}
          </CompactNote>
        </CompactShell>
      );
    }

    return (
      <View style={styles.container}>
        <Hero
          title="🧭 Expedition Underway"
          subtitle={partyLabel}
          accent={colors.gold}
          onHistory={() => setShowHistory(true)}
          historyCount={historyCount}
        />

        <View style={[styles.content, { justifyContent: "center" }]}>
          <View style={styles.badgeRow}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Text style={styles.badgeTxt}>{returning ? "RETURNING HOME" : "IN THE WILDS"}</Text>
          </View>

          <Text style={styles.countdown}>{returning ? "..." : countdown}</Text>

          {/* Journey trail — marker walks from castle to peaks */}
          <View style={styles.trailBox}>
            <View style={styles.trailRow}>
              <Text style={styles.trailEnd}>🏰</Text>
              <View style={styles.trailBarWrap}>
                <ProgressBar percent={pct} color={colors.gold} height={10} />
                <Text style={[styles.trailMarker, { left: `${Math.min(94, Math.max(0, pct))}%` }]}>
                  {partyEmoji}
                </Text>
              </View>
              <Text style={styles.trailEnd}>🏔</Text>
            </View>
            <Text style={styles.trailPct}>{pct}% of the journey complete</Text>
          </View>

          <View style={styles.statChipRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipTxt}>🏔 ~{potential} land</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipTxt}>🕐 left {timeAgo(e.started_at)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionBar}>
          <View style={[styles.actionBtn, styles.actionBtnGhost]}>
            <Text style={styles.actionGhostTxt}>
              {returning ? "Tallying the spoils…" : `Party returns at ${formatClock(e.finishes_at)}`}
            </Text>
          </View>
        </View>

        {renderHistoryModal()}
      </View>
    );
  }

  /* ── STATE A: MUSTER ── */
  const land = data.land || 0;
  const escorted = selectedUnit != null;
  const speed = selectedUnit?.speed || 5;
  const previewDuration = calcDuration(land, speed, escorted);
  const previewPotential = calcPotential(escorted ? sliderValue : 0, speed);
  const previewDanger = calcDanger(land, escorted);
  const danger = dangerMeta(previewDanger);

  // Collapsed: no expedition out — just the standing facts and an Explore
  // button that OPENS the full drawer to build a party. Deliberately no
  // preview stats (danger/trip time depend on a selection that hasn't been
  // made yet) and no one-tap dispatch (too easy to send a solo scout by
  // accident).
  if (!expanded) {
    return (
      <CompactShell hint="Pull up to muster a party">
        <StatStrip
          items={[
            { value: `🏔 ${land}`, label: "Acres held" },
            { value: `${data.available_units.length}`, label: "Escort types" },
            { value: `${historyCount}`, label: "Past treks" },
          ]}
        />
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnCompact, { backgroundColor: colors.gold }]}
          activeOpacity={0.85}
          onPress={drawer?.expand}
        >
          <Text style={[styles.actionBtnTxt, { color: colors.bg }]}>🧭 Explore the Wilds</Text>
        </TouchableOpacity>
      </CompactShell>
    );
  }

  return (
    <View style={styles.container}>
      <Hero
        title="🗺 Explore the Wilds"
        subtitle={`${land} acres held · choose your expedition party`}
        accent={colors.gold}
        onHistory={() => setShowHistory(true)}
        historyCount={historyCount}
      />

      <View style={styles.content}>
        <Text style={styles.gridLabel}>Expedition Party</Text>

        {/* Inventory grid — scrolls within its own window */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {/* Solo tile */}
          <TouchableOpacity
            style={[styles.tile, !escorted && styles.tileSelected]}
            onPress={() => { setSelectedUnit(null); setSliderValue(1); }}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>🚶</Text>
            <Text style={styles.tileName} numberOfLines={1}>Solo</Text>
            {!escorted && <View style={styles.tileCheck}><Text style={styles.tileCheckTxt}>✓</Text></View>}
          </TouchableOpacity>

          {data.available_units.map((u) => {
            const isSel = selectedUnit?.unit_id === u.unit_id;
            const img = unitImage(u.slug);
            return (
              <TouchableOpacity
                key={u.unit_id}
                style={[styles.tile, isSel && styles.tileSelected]}
                onPress={() => toggleUnit(u)}
                activeOpacity={0.8}
              >
                {img ? (
                  <Image source={img} resizeMode="contain" style={styles.tileArt} />
                ) : (
                  <Text style={styles.tileEmoji}>🪖</Text>
                )}
                <Text style={styles.tileName} numberOfLines={1}>{u.name}</Text>
                <View style={styles.tileCount}>
                  <Text style={styles.tileCountTxt}>{u.available}</Text>
                </View>
                {isSel && <View style={styles.tileCheck}><Text style={styles.tileCheckTxt}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Party size — compact single row */}
        {escorted && selectedUnit.available > 0 && (
          <View style={styles.sizeRow}>
            <Text style={styles.sizeValue}>{sliderValue}</Text>
            <Slider
              style={{ flex: 1, height: 34 }}
              minimumValue={1}
              maximumValue={selectedUnit.available}
              step={1}
              value={sliderValue}
              onValueChange={setSliderValue}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.gold}
            />
            <TouchableOpacity onPress={() => setSliderValue(selectedUnit.available)}>
              <Text style={styles.maxBtn}>MAX</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Mission strip + dispatch */}
      <View style={styles.actionBar}>
        <View style={styles.missionStrip}>
          <View style={styles.missionStat}>
            <Text style={styles.missionValue}>⏱ {formatDuration(previewDuration)}</Text>
            <Text style={styles.missionLabel}>Duration</Text>
          </View>
          <View style={styles.missionDivider} />
          <View style={styles.missionStat}>
            <Text style={[styles.missionValue, { color: colors.success }]}>🏔 ~{previewPotential}</Text>
            <Text style={styles.missionLabel}>Max Land</Text>
          </View>
          <View style={styles.missionDivider} />
          <View style={styles.missionStat}>
            <Text style={[styles.missionValue, { color: danger.color }]}>⚔️ {previewDanger}%</Text>
            <Text style={[styles.missionLabel, { color: danger.color }]}>{danger.label}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.gold }, dispatching && { opacity: 0.5 }]}
          onPress={handleDispatch}
          disabled={dispatching}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionBtnTxt, { color: colors.bg }]}>
            {dispatching
              ? "Dispatching…"
              : escorted
                ? `⚔️ Dispatch ${sliderValue}× ${selectedUnit.name}`
                : "⚔️ Dispatch Solo Expedition"}
          </Text>
        </TouchableOpacity>
      </View>

      {renderHistoryModal()}
    </View>
  );

  /* ── history bottom sheet ── */
  function renderHistoryModal() {
    return (
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📜 Expedition History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingTop: 8 }}>
              {(data.claimed || []).map((e) => (
                <View key={e.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyUnit}>
                      {e.unit_name ? `${e.quantity}× ${e.unit_name}` : "Unescorted"}
                    </Text>
                    <Text style={styles.historyTime}>{timeAgo(e.updated_at || e.started_at)}</Text>
                  </View>
                  <Text style={styles.historyRewards}>{rewardParts(e).join("   ") || "No rewards"}</Text>
                </View>
              ))}
              {historyCount === 0 && <Text style={styles.emptyText}>No expedition history yet.</Text>}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

/* ================================================================
   STYLES
   ================================================================ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {}),
  },

  /* hero */
  hero: {
    height: "34%",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: alpha(colors.bg, "33") },
  heroScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.bg, "cc"),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  historyFab: {
    position: "absolute",
    top: 10,
    right: 12,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.bg, "aa"),
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  historyFabTxt: { fontSize: 16 },

  /* content zone */
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },

  /* inventory grid */
  gridLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingBottom: 10,
  },
  tile: {
    width: TILE_W,
    height: TILE_W + 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  tileSelected: {
    borderColor: colors.gold,
    backgroundColor: alpha(colors.gold, "14"),
  },
  tileArt: { width: TILE_W * 0.62, height: TILE_W * 0.62 },
  tileEmoji: { fontSize: TILE_W * 0.4, height: TILE_W * 0.62, textAlignVertical: "center" },
  tileName: { color: colors.textDim, fontSize: 10, marginTop: 3, paddingHorizontal: 3 },
  tileCount: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: alpha(colors.bg, "dd"),
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileCountTxt: { color: colors.gold, fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
  tileCheck: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCheckTxt: { color: colors.bg, fontSize: 10, fontWeight: "900" },

  /* party size row */
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  sizeValue: { color: colors.gold, fontSize: 20, fontWeight: "800", minWidth: 44, textAlign: "center", fontVariant: ["tabular-nums"] },
  maxBtn: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 6,
  },

  /* underway */
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginRight: 8 },
  badgeTxt: { color: colors.gold, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  countdown: {
    color: colors.text,
    fontSize: 52,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginBottom: 14,
  },
  trailBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trailEnd: { fontSize: 20 },
  trailBarWrap: { flex: 1, justifyContent: "center" },
  trailMarker: {
    position: "absolute",
    top: -14,
    fontSize: 16,
    marginLeft: -8,
  },
  trailPct: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 10 },
  statChipRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  statChip: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statChipTxt: { color: colors.textDim, fontSize: 12, fontWeight: "600" },

  /* returned */
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  rewardChip: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.success, "55"),
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rewardChipTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
  survivorLine: { fontSize: 12, fontWeight: "600", marginBottom: 10 },
  journal: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 4,
  },
  journalTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  logEntry: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 3 },
  logDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, marginRight: 8 },
  logText: { fontSize: 12, flex: 1, lineHeight: 17 },

  /* pinned action bar */
  actionBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  missionStrip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    marginBottom: 8,
  },
  missionStat: { flex: 1, alignItems: "center" },
  missionValue: { color: colors.text, fontSize: 14, fontWeight: "800" },
  missionLabel: { color: colors.muted, fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  missionDivider: { width: 1, backgroundColor: colors.border },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnTxt: { color: colors.white, fontSize: 15, fontWeight: "800" },
  actionBtnCompact: { paddingVertical: 7, borderRadius: 9 },
  actionBtnGhost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionGhostTxt: { color: colors.textDim, fontSize: 14, fontWeight: "600" },
  moreWaiting: { color: colors.gold, fontSize: 12, textAlign: "center", marginBottom: 6, fontWeight: "600" },

  /* history sheet */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "75%",
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.gold, fontSize: 17, fontWeight: "700" },
  modalClose: { color: colors.muted, fontSize: 22, padding: 4 },
  historyCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardAlt,
  },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  historyUnit: { color: colors.textDim, fontSize: 14, fontWeight: "600" },
  historyTime: { color: colors.faint, fontSize: 12 },
  historyRewards: { color: colors.muted, fontSize: 13 },
  emptyText: { color: colors.faint, textAlign: "center", padding: 20 },
});
