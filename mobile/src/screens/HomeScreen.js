import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { LoadingState, ArtPlaceholder } from "../components/ui";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

export default function HomeScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collectingId, setCollectingId] = useState(null);
  const [claimingExplorationId, setClaimingExplorationId] = useState(null);
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
      // Tick every 10s to update progress bars while orders are active
      tickRef.current = setInterval(loadDashboard, 10000);
      return () => clearInterval(tickRef.current);
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  const p = data.player;
  const rates = data.production_rates;
  const army = data.army_summary;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Player Stats */}
      <View style={styles.card}>
        <ArtPlaceholder emoji="🏰" label="Kingdom banner" aspect={3} source={art.kingdomBanner} style={styles.bannerArt} />
        <Text style={styles.cardTitle}>{p.kingdom_name || p.username}</Text>
        <Text style={styles.affinity}>{p.affinity}</Text>
        {p.under_protection && (
          <View style={styles.protectionBadge}>
            <Text style={styles.protectionText}>🛡 Under Protection</Text>
          </View>
        )}
      </View>

      {/* Resources */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resources</Text>
        <View style={styles.statRow}>
          <StatItem label="Gold" value={p.gold} icon="💰" />
          <StatItem label="Mana" value={`${p.mana}/${p.max_mana}`} icon="🔮" />
          <StatItem label="Land" value={`${p.land - p.free_land}/${p.land}`} icon="🏔" />
        </View>
        <View style={styles.statRow}>
          <StatItem label="Morale" value={Math.round(p.morale)} icon="😇" />
          <StatItem label="Power" value={p.net_power} icon="💪" />
          <StatItem label="Magic" value={p.magic_power} icon="✨" />
        </View>
      </View>

      {/* Production */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Production / hr</Text>
        <View style={styles.statRow}>
          <StatItem label="Gold" value={`+${rates.gold || 0}`} icon="💰" />
          <StatItem label="Mana" value={`+${rates.mana || 0}`} icon="🔮" />
        </View>
      </View>

      {/* Army Summary */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Army</Text>
        <View style={styles.statRow}>
          <StatItem label="Units" value={army.total_units} icon="⚔️" />
          <StatItem label="Strength" value={army.total_strength} icon="💪" />
          <StatItem label="Upkeep" value={army.total_upkeep} icon="💰" />
        </View>
      </View>

      {/* Active Recruitment Orders */}
      {data.active_orders && data.active_orders.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recruiting</Text>
          {data.active_orders.map((order) => (
            <RecruitOrderWidget
              key={order.id}
              order={order}
              collecting={collectingId === order.id}
              onCollect={async () => {
                setCollectingId(order.id);
                try {
                  await api.acceptRecruitOrder(order.id);
                  await loadDashboard();
                } catch (e) {}
                setCollectingId(null);
              }}
            />
          ))}
        </View>
      )}

      {/* Active Spells */}
      {data.active_spells.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active Spells</Text>
          {data.active_spells.map((spell) => (
            <View key={spell.id} style={styles.spellRow}>
              <Text style={styles.spellName}>{spell.spell_name}</Text>
              <Text style={styles.spellMeta}>x{spell.stack_count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Exploration */}
      <ExplorationWidget
        exploration={data.exploration}
        navigation={navigation}
        claimingId={claimingExplorationId}
        onClaim={async (id) => {
          setClaimingExplorationId(id);
          try {
            await api.claimExploration(id);
            await loadDashboard();
          } catch (e) {}
          setClaimingExplorationId(null);
        }}
      />

      {/* Notifications */}
      {data.unread_notifications > 0 && (
        <TouchableOpacity
          style={styles.notificationBadge}
          onPress={() => navigation.navigate("More", { screen: "Notifications" })}
          activeOpacity={0.7}
        >
          <Text style={styles.notificationText}>
            📬 {data.unread_notifications} unread notification{data.unread_notifications !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function RecruitOrderWidget({ order, collecting, onCollect }) {
  const available = order.available_to_accept;
  const pct = order.progress_percent;
  const remaining = formatTimeLeft(order.estimated_completion);

  return (
    <View style={styles.recruitOrder}>
      <View style={styles.recruitHeader}>
        <Text style={styles.recruitUnit}>⚔️ {order.unit_name}</Text>
        <Text style={styles.recruitCount}>
          {order.accepted_quantity}/{order.total_quantity}
        </Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.recruitFooter}>
        <Text style={styles.recruitTime}>
          {pct >= 100 ? "Complete" : remaining}
        </Text>
        {available > 0 && (
          <TouchableOpacity
            style={styles.collectButton}
            onPress={onCollect}
            disabled={collecting}
          >
            {collecting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.collectText}>Collect {available}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function formatTimeLeft(isoDate) {
  const diff = Math.max(0, new Date(isoDate) - Date.now());
  const mins = Math.ceil(diff / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
  }
  return `${mins}m left`;
}

function formatCountdown(isoDate) {
  const diff = Math.max(0, new Date(isoDate).getTime() - Date.now());
  const total = Math.ceil(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function ExplorationWidget({ exploration, navigation, claimingId, onClaim }) {
  const [countdown, setCountdown] = useState("");
  const timerRef = useRef(null);

  const active = exploration?.active;
  const completed = exploration?.completed || [];

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!active) { setCountdown(""); return; }

    const tick = () => {
      const diff = new Date(active.finishes_at).getTime() - Date.now();
      setCountdown(diff <= 0 ? "Returning..." : formatCountdown(active.finishes_at));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [active?.id, active?.finishes_at]);

  if (!active && completed.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🧭 Exploration</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("Explorations")}
        >
          <Text style={styles.actionIcon}>🧭</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionText}>Explore the Wilds</Text>
            <Text style={styles.actionSub}>Send scouts to discover land and treasure</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>🧭 Exploration</Text>

      {active && (
        <View style={styles.explorationActive}>
          <View style={styles.explorationActiveHeader}>
            <View style={styles.explorationBadge}>
              <Text style={styles.explorationBadgeText}>IN PROGRESS</Text>
            </View>
            <Text style={styles.explorationCountdown}>{countdown}</Text>
          </View>
          <View style={styles.explorationDetails}>
            <Text style={styles.explorationDetailText}>
              🛡 {active.unit_name ? `${active.quantity}× ${active.unit_name}` : "Unescorted"}
            </Text>
            <Text style={styles.explorationDetailText}>
              🏔 ~{active.potential_land} land
            </Text>
          </View>
          <TouchableOpacity
            style={styles.explorationViewBtn}
            onPress={() => navigation.navigate("Explorations")}
          >
            <Text style={styles.explorationViewBtnText}>View Expedition</Text>
          </TouchableOpacity>
        </View>
      )}

      {completed.map((exp) => {
        const casualties = exp.quantity - (exp.survivors || exp.quantity);
        return (
          <View key={exp.id} style={styles.explorationCompleted}>
            <View style={{ flex: 1 }}>
              <View style={styles.explorationCompletedHeader}>
                <Text style={styles.explorationCompletedTitle}>✅ Expedition Returned</Text>
              </View>
              <View style={styles.explorationRewards}>
                <Text style={styles.explorationRewardText}>🏔 {exp.land_reward} land</Text>
                {exp.gold_reward > 0 && (
                  <Text style={styles.explorationRewardText}>💰 {exp.gold_reward} gold</Text>
                )}
                {exp.mana_reward > 0 && (
                  <Text style={styles.explorationRewardText}>🔮 {exp.mana_reward} mana</Text>
                )}
                {casualties > 0 && (
                  <Text style={[styles.explorationRewardText, { color: colors.danger }]}>
                    💀 {casualties} lost
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.explorationClaimBtn}
              onPress={() => onClaim(exp.id)}
              disabled={claimingId === exp.id}
            >
              {claimingId === exp.id ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.explorationClaimText}>🎁 Claim</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function StatItem({ label, value, icon }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingText: { color: colors.faint, textAlign: "center", marginTop: 60 },
  card: {
    backgroundColor: colors.card,
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerArt: { marginBottom: 12 },
  cardTitle: { color: colors.text, fontSize: 24, fontWeight: "bold" },
  affinity: { color: colors.accent, fontSize: 14, marginTop: 2 },
  protectionBadge: {
    backgroundColor: alpha(colors.success, "33"),
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  protectionText: { color: colors.success, fontSize: 12 },
  sectionTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  statItem: { alignItems: "center", flex: 1 },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "bold" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  spellRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  spellName: { color: colors.text, fontSize: 14 },
  spellMeta: { color: colors.accent, fontSize: 14 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  actionIcon: { fontSize: 24, marginRight: 12 },
  actionText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  actionSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  actionArrow: { color: colors.accent, fontSize: 24, fontWeight: "bold" },
  notificationBadge: {
    backgroundColor: alpha(colors.danger, "33"),
    margin: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  notificationText: { color: colors.danger, fontSize: 14 },
  logoutButton: {
    margin: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.faint,
    alignItems: "center",
    marginBottom: 32,
  },
  logoutText: { color: colors.muted, fontSize: 16 },
  recruitOrder: {
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  recruitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recruitUnit: { color: colors.text, fontSize: 14, fontWeight: "600" },
  recruitCount: { color: colors.muted, fontSize: 13 },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.card,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  recruitFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recruitTime: { color: colors.muted, fontSize: 12 },
  collectButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  collectText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  explorationActive: {
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  explorationActiveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  explorationBadge: {
    backgroundColor: alpha(colors.info, "22"),
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  explorationBadgeText: { color: colors.info, fontSize: 10, fontWeight: "bold" },
  explorationCountdown: { color: colors.text, fontSize: 18, fontWeight: "bold" },
  explorationDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  explorationDetailText: { color: colors.muted, fontSize: 13 },
  explorationViewBtn: {
    backgroundColor: alpha(colors.info, "22"),
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  explorationViewBtnText: { color: colors.info, fontSize: 14, fontWeight: "600" },
  explorationCompleted: {
    backgroundColor: alpha(colors.success, "15"),
    borderWidth: 1,
    borderColor: alpha(colors.success, "44"),
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  explorationCompletedHeader: { marginBottom: 4 },
  explorationCompletedTitle: { color: colors.success, fontSize: 14, fontWeight: "bold" },
  explorationRewards: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  explorationRewardText: { color: colors.textDim, fontSize: 12 },
  explorationClaimBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  explorationClaimText: { color: colors.white, fontSize: 14, fontWeight: "bold" },
});
