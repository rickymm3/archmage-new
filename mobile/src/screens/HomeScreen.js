import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as api from "../services/api";
import { LoadingState, ProgressBar, FadeSlideIn } from "../components/ui";
import LoadingButton from "../components/LoadingButton";
import { ui as art, submenuIcon } from "../assets";
import { colors, alpha } from "../theme";
import TreasuryScreen from "./TreasuryScreen";
import MarketplaceScreen from "./MarketplaceScreen";
import GameHubShell, { DrawerModeSwitch, DrawerExpandHint } from "../components/GameHubShell";

const HOME_TABS = [
  { key: "overview", iconSource: submenuIcon("home-overview"), label: "Overview" },
  { key: "tax", iconSource: submenuIcon("home-tax"), label: "Collect Tax" },
  { key: "mana", iconSource: submenuIcon("home-mana"), label: "Channel Mana" },
  { key: "market", iconSource: submenuIcon("kingdom-market"), label: "Market" },
];

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

// One system's at-a-glance state in the collapsed drawer: a fixed 2×2 grid
// of these covers every core loop regardless of how much is happening —
// state is AGGREGATED into the tile (counts, next countdown), never a
// variable-length list that could outgrow the fixed drawer.
function StatusTile({ icon, label, status, statusColor, pct, pctColor, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.75} onPress={onPress} disabled={!onPress}>
      <View style={styles.tileTop}>
        <Text style={styles.tileIcon}>{icon}</Text>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.tileStatus, statusColor != null && { color: statusColor }]} numberOfLines={1}>
        {status}
      </Text>
      {pct != null && <ProgressBar percent={pct} color={pctColor || colors.gold} height={3} style={{ marginTop: 3 }} />}
    </TouchableOpacity>
  );
}

export default function HomeScreen({ route }) {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [subTab, setSubTab] = useState("overview");

  // Deep links (e.g. the kingdom map's Black Market node)
  useEffect(() => {
    if (route?.params?.subTab) setSubTab(route.params.subTab);
  }, [route?.params?.subTab]);
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


  async function collectOrder(order) {
    if (collectingId) return;
    setCollectingId(order.id);
    try {
      await api.acceptRecruitOrder(order.id);
      await loadDashboard();
    } catch (e) {}
    setCollectingId(null);
  }

  async function collectAllReady() {
    if (collectingId) return;
    setCollectingId("all");
    try {
      for (const order of orders) {
        if (order.available_to_accept > 0) await api.acceptRecruitOrder(order.id);
      }
      await loadDashboard();
    } catch (e) {}
    setCollectingId(null);
  }

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
              onPress={() => collectOrder(order)}
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
          onPress={() => navigation.navigate("KingdomMap")}
        >
          <Text style={styles.ctaIcon}>🗺</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>View Realm Map</Text>
            <Text style={styles.ctaSub}>Survey your kingdom's lands</Text>
          </View>
          <Text style={styles.ctaArrow}>›</Text>
        </TouchableOpacity>
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

  /* ── overview drawer: fixed collapsed layout ──
     One tile per core loop, always exactly four, each aggregating its
     system's state: actionable (green, tap acts) → in progress (countdown
     + bar) → idle (CTA into that system). */

  function renderCompactOverview() {
    // Expedition tile
    let expTile;
    if (completedExp.length > 0) {
      expTile = { status: `Returned — claim${completedExp.length > 1 ? ` ×${completedExp.length}` : ""}!`, statusColor: colors.success };
    } else if (activeExp) {
      const startMs = new Date(activeExp.started_at).getTime();
      const endMs = new Date(activeExp.finishes_at).getTime();
      const pct = Math.round(Math.max(0, Math.min(1, (now - startMs) / Math.max(1, endMs - startMs))) * 100);
      expTile = {
        status: now >= endMs ? "Returning…" : `Back in ${formatCountdown(activeExp.finishes_at, now)}`,
        statusColor: colors.gold,
        pct,
        pctColor: colors.gold,
      };
    } else {
      expTile = { status: "Send a party", statusColor: colors.muted };
    }

    // Recruitment tile — aggregate across all orders
    const readyTroops = orders.reduce((sum, o) => sum + (o.available_to_accept || 0), 0);
    const inProgress = orders.find((o) => (o.progress_percent || 0) < 100);
    let recruitTile;
    if (readyTroops > 0) {
      recruitTile = {
        status: `Collect ${readyTroops} troops`,
        statusColor: colors.success,
        onPress: collectAllReady,
      };
    } else if (inProgress) {
      recruitTile = {
        status: `${inProgress.accepted_quantity}/${inProgress.total_quantity} · ${formatCountdown(inProgress.estimated_completion, now)}`,
        statusColor: colors.gold,
        pct: inProgress.progress_percent || 0,
        pctColor: colors.success,
      };
    } else {
      recruitTile = { status: "Barracks idle", statusColor: colors.muted };
    }

    // War tile — protection state doubles as the raid CTA's counterpart
    const warTile = p.under_protection
      ? {
          icon: "🛡",
          status: `Protected til ${new Date(p.protection_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          statusColor: colors.success,
        }
      : { icon: "⚔️", status: "Raid a kingdom", statusColor: colors.accent };

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.compactBody} showsVerticalScrollIndicator={false}>
        <View style={styles.tileGrid}>
          <StatusTile
            icon="🧭"
            label="Expedition"
            {...expTile}
            onPress={expTile.onPress || (() => navigation.navigate("War", { subTab: "explore" }))}
          />
          <StatusTile
            icon="📯"
            label="Recruitment"
            {...recruitTile}
            onPress={recruitTile.onPress || (() => navigation.navigate("Army", { subTab: "recruit" }))}
          />
          <StatusTile
            label="War"
            {...warTile}
            onPress={() => navigation.navigate("War", { subTab: "attack" })}
          />
          <StatusTile
            icon="💰"
            label="Economy"
            status={`+${rates.gold || 0}g · +${rates.mana || 0}m /hr`}
            onPress={() => setSubTab("tax")}
          />
        </View>
        <View style={{ flex: 1 }} />
        <DrawerExpandHint label="Pull up for full report" />
      </ScrollView>
    );
  }

  /* ── overview drawer: scrollable expanded layout ── */

  function renderExpandedOverview() {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.activityList}>
        {hasActivity && (
          <>
            <Text style={styles.drawerSection}>Happening Now</Text>
            {completedExp.map(renderCompletedExpedition)}
            {orders.map(renderOrderCard)}
            {activeExp && renderActiveExpedition()}
          </>
        )}
        <Text style={styles.drawerSection}>What Next?</Text>
        {renderIdleCTAs()}
        <Text style={styles.drawerSection}>Kingdom Report</Text>
        <View style={styles.reportCard}>
          <ReportRow label="Gold production" value={`+${rates.gold || 0} / hr`} />
          <ReportRow label="Mana production" value={`+${rates.mana || 0} / hr`} />
          <ReportRow label="Mana battery charge" value={`${Math.round((p.mana_charge || 0) * 100)}%`} />
          <ReportRow label="Land" value={`${p.land - p.free_land} used · ${p.free_land} free · ${p.land} total`} />
          <ReportRow label="Morale" value={`${morale}%`} valueColor={moraleColor(morale)} />
          <ReportRow label="Net power" value={Number(p.net_power).toLocaleString()} />
          <ReportRow label="Magic power" value={p.magic_power} />
          <ReportRow label="Army" value={`${army.total_units || 0} units · ${Number(army.total_strength || 0).toLocaleString()} strength`} />
          <ReportRow label="Army upkeep" value={`💰 ${Number(army.total_upkeep || 0).toLocaleString()} / day`} />
          {p.under_protection && (
            <ReportRow
              label="Protection"
              value={`until ${new Date(p.protection_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              valueColor={colors.success}
            />
          )}
        </View>
        <View style={{ height: 14 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <GameHubShell
        source={art.townPanorama}
        section="Home"
        title={p.kingdom_name || p.username}
        subtitle={`${p.affinity} · ${Number(p.net_power).toLocaleString()} power`}
        tabs={HOME_TABS}
        active={subTab}
        onChange={setSubTab}
        drawerTitle={subTab === "overview" ? "Overview" : subTab === "tax" ? "Royal Tax Office" : subTab === "mana" ? "Mana Conduit" : "Black Market"}
        drawerRatio={0.21}
      >
        {subTab === "overview" ? (
          <View style={{ flex: 1 }}>
            <View style={styles.vitalsRow}>
              <View style={styles.moraleBox}>
                <View style={styles.moraleTop}>
                  <Text style={styles.vitalLabel}>Morale</Text>
                  <Text style={[styles.moraleVal, { color: moraleColor(morale) }]}>{morale}%</Text>
                </View>
                <ProgressBar percent={morale} color={moraleColor(morale)} height={5} />
              </View>
              <TouchableOpacity style={styles.spellChip} onPress={() => navigation.navigate("Magic", { subTab: "active" })}>
                <Text style={styles.spellChipIcon}>✨</Text>
                <Text style={styles.spellChipTxt}>{spells.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.spellChip, unread > 0 && { borderColor: alpha(colors.danger, "88") }]}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Text style={styles.spellChipIcon}>🔔</Text>
                <Text style={[styles.spellChipTxt, unread > 0 && { color: colors.danger }]}>
                  {unread > 9 ? "9+" : unread}
                </Text>
              </TouchableOpacity>
            </View>
            <DrawerModeSwitch compact={renderCompactOverview()} expanded={renderExpandedOverview()} />
          </View>
        ) : subTab === "market" ? (
          <FadeSlideIn key={subTab} style={{ flex: 1 }}>
            <MarketplaceScreen />
          </FadeSlideIn>
        ) : (
          <FadeSlideIn key={subTab} style={{ flex: 1 }}>
            <TreasuryScreen fixedTab={subTab} />
          </FadeSlideIn>
        )}
      </GameHubShell>
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
  // No web maxWidth cap here — GameHubShell lets its scene art span the
  // full (possibly widened) frame and centers the interactive column itself.
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 5,
    alignItems: "stretch",
  },
  moraleBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: "center",
  },
  moraleTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  vitalLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  moraleVal: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  spellChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: alpha(colors.accent, "66"),
    paddingHorizontal: 9,
  },
  spellChipIcon: { fontSize: 12 },
  spellChipTxt: { color: colors.accent, fontSize: 13, fontWeight: "800" },

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

  /* collapsed-drawer fixed layout: 2×2 status tile grid */
  compactBody: { flexGrow: 1, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 2, gap: 5 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tileTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  tileIcon: { fontSize: 11 },
  tileLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tileStatus: { color: colors.text, fontSize: 11, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] },

  /* expanded-drawer sections */
  drawerSection: {
    color: colors.goldDim,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 6,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
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

  /* kingdom report rows (expanded drawer) */
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
});
