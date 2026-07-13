import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as api from "../services/api";
import { LoadingState, ProgressBar } from "../components/ui";
import LoadingButton from "../components/LoadingButton";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

function formatCountdown(isoDate, now) {
  const diff = Math.max(0, new Date(isoDate).getTime() - now);
  const total = Math.ceil(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function moraleColor(m) {
  if (m >= 75) return colors.success;
  if (m >= 20) return colors.gold;
  return colors.danger;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [collectingId, setCollectingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  async function loadDashboard() {
    try {
      const result = await api.getDashboard();
      setData(result);
    } catch (e) {
      if (e.message === "UNAUTHORIZED") return;
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      pollRef.current = setInterval(loadDashboard, 10000); // refresh data
      tickRef.current = setInterval(() => setNow(Date.now()), 1000); // countdowns
      return () => {
        clearInterval(pollRef.current);
        clearInterval(tickRef.current);
      };
    }, [])
  );

  if (!data) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  const p = data.player;
  const rates = data.production_rates || {};
  const army = data.army_summary || {};
  const spells = data.active_spells || [];
  const orders = data.active_orders || [];
  const activeExp = data.exploration?.active;
  const completedExp = data.exploration?.completed || [];
  const morale = Math.round(p.morale || 0);
  const unread = data.unread_notifications || 0;

  const hasActivity = orders.length > 0 || activeExp || completedExp.length > 0;

  /* ── activity cards ── */

  function renderOrderCard(order) {
    const pct = order.progress_percent || 0;
    const done = pct >= 100;
    return (
      <View key={`order-${order.id}`} style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>📯 Recruiting {order.unit_name}</Text>
          <Text style={styles.activityCount}>
            {order.accepted_quantity}/{order.total_quantity}
          </Text>
        </View>
        <ProgressBar percent={pct} color={colors.success} height={6} style={{ marginVertical: 8 }} />
        <View style={styles.activityFooter}>
          <Text style={styles.activityMeta}>
            {done ? "All arrived!" : `Done in ${formatCountdown(order.estimated_completion, now)}`}
          </Text>
          {order.available_to_accept > 0 && (
            <LoadingButton
              style={styles.smallBtn}
              onPress={async () => {
                setCollectingId(order.id);
                try {
                  await api.acceptRecruitOrder(order.id);
                  await loadDashboard();
                } catch (e) {}
                setCollectingId(null);
              }}
              disabled={collectingId === order.id}
            >
              <Text style={styles.smallBtnTxt}>Collect {order.available_to_accept}</Text>
            </LoadingButton>
          )}
        </View>
      </View>
    );
  }

  function renderActiveExpedition() {
    const e = activeExp;
    const startMs = new Date(e.started_at).getTime();
    const endMs = new Date(e.finishes_at).getTime();
    const pct = Math.round(Math.max(0, Math.min(1, (now - startMs) / Math.max(1, endMs - startMs))) * 100);
    const label = e.unit_name ? `${e.quantity}× ${e.unit_name}` : "Unescorted party";
    return (
      <TouchableOpacity
        key="exp-active"
        style={styles.activityCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("War", { subTab: "explore" })}
      >
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>🧭 Expedition · {label}</Text>
          <Text style={[styles.activityCount, { color: colors.gold }]}>
            {now >= endMs ? "…" : formatCountdown(e.finishes_at, now)}
          </Text>
        </View>
        <View style={styles.trailRow}>
          <Text style={styles.trailEnd}>🏰</Text>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ProgressBar percent={pct} color={colors.gold} height={6} />
            <Text style={[styles.trailMarker, { left: `${Math.min(94, pct)}%` }]}>
              {e.unit_name ? "🐎" : "🚶"}
            </Text>
          </View>
          <Text style={styles.trailEnd}>🏔</Text>
        </View>
        <Text style={styles.activityMeta}>
          ~{e.potential_land ?? "?"} land potential · tap to view
        </Text>
      </TouchableOpacity>
    );
  }

  function renderCompletedExpedition(e) {
    const rewards = [];
    if (e.land_reward) rewards.push(`🏔 +${e.land_reward}`);
    if (e.gold_reward) rewards.push(`💰 +${e.gold_reward}`);
    if (e.mana_reward) rewards.push(`🔮 +${e.mana_reward}`);
    return (
      <TouchableOpacity
        key={`exp-${e.id}`}
        style={[styles.activityCard, { borderColor: alpha(colors.success, "66") }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("War", { subTab: "explore" })}
      >
        <View style={styles.activityHeader}>
          <Text style={[styles.activityTitle, { color: colors.success }]}>✅ Expedition returned!</Text>
          <Text style={styles.activityCount}>{rewards.join("  ") || "no spoils"}</Text>
        </View>
        <Text style={styles.activityMeta}>Tap to claim your rewards</Text>
      </TouchableOpacity>
    );
  }

  function renderIdleCTAs() {
    return (
      <>
        <TouchableOpacity
          style={styles.ctaCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("War", { subTab: "explore" })}
        >
          <Text style={styles.ctaIcon}>🧭</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Explore the Wilds</Text>
            <Text style={styles.ctaSub}>Send a party to discover new land</Text>
          </View>
          <Text style={styles.ctaArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("Army", { subTab: "recruit" })}
        >
          <Text style={styles.ctaIcon}>📯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Recruit Soldiers</Text>
            <Text style={styles.ctaSub}>Grow your army at the barracks</Text>
          </View>
          <Text style={styles.ctaArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("War", { subTab: "attack" })}
        >
          <Text style={styles.ctaIcon}>⚔️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Raid a Kingdom</Text>
            <Text style={styles.ctaSub}>Scout enemies and seize their land</Text>
          </View>
          <Text style={styles.ctaArrow}>›</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── HERO ── */}
      <View style={styles.hero}>
        <Image source={art.kingdomBanner} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={styles.heroTint} />

        {/* floating badges */}
        <View style={styles.heroTopRow}>
          {p.under_protection ? (
            <View style={styles.shieldBadge}>
              <Text style={styles.shieldTxt}>🛡 Protected</Text>
            </View>
          ) : <View />}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* EXPERIMENTAL: pannable map home entry */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate("KingdomMap")}
              activeOpacity={0.8}
            >
              <Text style={styles.bellIcon}>🗺</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.8}
            >
              <Text style={styles.bellIcon}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate("Notifications")}
              activeOpacity={0.8}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {unread > 0 && (
                <View style={styles.bellDot}>
                  <Text style={styles.bellDotTxt}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroScrim}>
          <Text style={styles.heroTitle}>{p.kingdom_name || p.username}</Text>
          <Text style={styles.heroSub}>
            {p.affinity} · 💪 {Number(p.net_power).toLocaleString()} power
          </Text>
        </View>
      </View>

      {/* ── RESOURCE STRIP — each cell jumps to its Kingdom section ── */}
      <View style={styles.resourceStrip}>
        <TouchableOpacity
          style={styles.resItem}
          activeOpacity={0.6}
          onPress={() => navigation.navigate("Kingdom", { subTab: "tax" })}
        >
          <Text style={[styles.resValue, { color: colors.gold }]}>💰 {Number(p.gold).toLocaleString()}</Text>
          <Text style={styles.resHint}>+{rates.gold || 0}/hr · tax</Text>
        </TouchableOpacity>
        <View style={styles.resDivider} />
        <TouchableOpacity
          style={styles.resItem}
          activeOpacity={0.6}
          onPress={() => navigation.navigate("Kingdom", { subTab: "mana" })}
        >
          <Text style={[styles.resValue, { color: colors.info }]}>🔮 {Number(p.mana).toLocaleString()}</Text>
          <Text style={styles.resHint}>
            battery {Math.round((p.mana_charge || 0) * 100)}% · channel
          </Text>
        </TouchableOpacity>
        <View style={styles.resDivider} />
        <TouchableOpacity
          style={styles.resItem}
          activeOpacity={0.6}
          onPress={() => navigation.navigate("Kingdom", { subTab: "town" })}
        >
          <Text style={[styles.resValue, { color: colors.success }]}>🏔 {p.free_land}</Text>
          <Text style={styles.resHint}>of {p.land} free · build</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportBtn} activeOpacity={0.7} onPress={() => setShowReport(true)}>
          <Text style={styles.reportBtnTxt}>📜</Text>
        </TouchableOpacity>
      </View>

      {/* ── VITALS ROW ── */}
      <View style={styles.vitalsRow}>
        <View style={styles.moraleBox}>
          <View style={styles.moraleTop}>
            <Text style={styles.vitalLabel}>Morale</Text>
            <Text style={[styles.moraleVal, { color: moraleColor(morale) }]}>{morale}%</Text>
          </View>
          <ProgressBar percent={morale} color={moraleColor(morale)} height={5} />
        </View>
        <TouchableOpacity
          style={styles.spellChip}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("Magic", { subTab: "active" })}
        >
          <Text style={styles.spellChipIcon}>✨</Text>
          <Text style={styles.spellChipTxt}>{spells.length}</Text>
          <Text style={styles.spellChipLabel}>{spells.length === 1 ? "spell" : "spells"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── HAPPENING NOW (fixed window, internal scroll) ── */}
      <Text style={styles.sectionLabel}>{hasActivity ? "Happening Now" : "What Next?"}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.activityList}>
        {completedExp.map(renderCompletedExpedition)}
        {orders.map(renderOrderCard)}
        {activeExp && renderActiveExpedition()}
        {!hasActivity && renderIdleCTAs()}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* ── KINGDOM REPORT SHEET ── */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowReport(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>📜 Kingdom Report</Text>

            <Text style={styles.reportSection}>Economy</Text>
            <ReportRow label="Gold production" value={`+${rates.gold || 0} / hr`} />
            <ReportRow label="Mana production" value={`+${rates.mana || 0} / hr`} />
            <ReportRow label="Mana battery charge" value={`${Math.round((p.mana_charge || 0) * 100)}%`} />
            <ReportRow label="Land" value={`${p.land - p.free_land} used · ${p.free_land} free · ${p.land} total`} />

            <Text style={styles.reportSection}>Might</Text>
            <ReportRow label="Net power" value={Number(p.net_power).toLocaleString()} />
            <ReportRow label="Magic power" value={p.magic_power} />
            <ReportRow label="Army" value={`${army.total_units || 0} units · ${Number(army.total_strength || 0).toLocaleString()} strength`} />
            <ReportRow label="Army upkeep" value={`💰 ${Number(army.total_upkeep || 0).toLocaleString()} / day`} />
            <ReportRow label="Morale" value={`${morale}%`} valueColor={moraleColor(morale)} />

            {p.under_protection && (
              <>
                <Text style={styles.reportSection}>Status</Text>
                <ReportRow
                  label="Magical protection"
                  value={`until ${new Date(p.protection_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  valueColor={colors.success}
                />
              </>
            )}

            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowReport(false)}>
              <Text style={styles.sheetCloseTxt}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ReportRow({ label, value, valueColor = colors.text }) {
  return (
    <View style={styles.reportRow}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={[styles.reportValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {}),
  },

  /* hero */
  hero: {
    height: "26%",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: alpha(colors.bg, "33") },
  heroTopRow: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shieldBadge: {
    backgroundColor: alpha(colors.success, "33"),
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  shieldTxt: { color: colors.success, fontSize: 11, fontWeight: "700" },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.bg, "aa"),
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { fontSize: 16 },
  bellDot: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDotTxt: { color: colors.white, fontSize: 10, fontWeight: "800" },
  heroScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.bg, "cc"),
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSub: { color: colors.textDim, fontSize: 12, marginTop: 2, textTransform: "capitalize" },

  /* resource strip */
  resourceStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingRight: 10,
  },
  resItem: { flex: 1, alignItems: "center" },
  resValue: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  resHint: { color: colors.muted, fontSize: 9, marginTop: 1 },
  resDivider: { width: 1, height: 22, backgroundColor: colors.border },
  reportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    justifyContent: "center",
  },
  reportBtnTxt: { fontSize: 16 },

  /* vitals */
  vitalsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    alignItems: "stretch",
  },
  moraleBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  moraleTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  vitalLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  moraleVal: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  spellChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.accent, "66"),
    paddingHorizontal: 12,
  },
  spellChipIcon: { fontSize: 14 },
  spellChipTxt: { color: colors.accent, fontSize: 16, fontWeight: "800" },
  spellChipLabel: { color: colors.muted, fontSize: 10 },

  /* activity zone */
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  activityList: { paddingHorizontal: 12 },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: "700", flex: 1 },
  activityCount: { color: colors.muted, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  activityFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activityMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  smallBtn: {
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallBtnTxt: { color: colors.white, fontSize: 12, fontWeight: "700" },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 10 },
  trailEnd: { fontSize: 14 },
  trailMarker: { position: "absolute", top: -11, fontSize: 13, marginLeft: -7 },

  /* idle CTAs */
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  ctaIcon: { fontSize: 24, marginRight: 12 },
  ctaTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  ctaSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  ctaArrow: { color: colors.accent, fontSize: 22, fontWeight: "700" },

  /* kingdom report sheet */
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingBottom: 26,
  },
  sheetGrip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetTitle: { color: colors.gold, fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  reportSection: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.border, "77"),
  },
  reportLabel: { color: colors.muted, fontSize: 13 },
  reportValue: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sheetClose: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  sheetCloseTxt: { color: colors.muted, fontSize: 14 },
});
