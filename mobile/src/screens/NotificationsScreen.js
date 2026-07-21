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
import { useAuth } from "../context/AuthContext";
import { LoadingState, EmptyState } from "../components/ui";
import { colors, webColumn } from "../theme";

// Older stored battle reports used initial_quantity / remaining_quantity keys.
function normalizeArmy(army) {
  return {
    ...army,
    stacks: (army.stacks || []).map((s) => ({
      ...s,
      initial: s.initial ?? s.initial_quantity ?? 0,
      remaining: s.remaining ?? s.remaining_quantity ?? 0,
      lost: s.lost ?? 0,
      attack: s.attack ?? 0,
      defense: s.defense ?? 0,
      speed: s.speed ?? 0,
    })),
  };
}

export default function NotificationsScreen({ navigation }) {
  const { showAlert } = useModal();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      setData(await api.getNotifications());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handleMarkAllRead() {
    try {
      await api.markAllNotificationsRead();
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleTap(id) {
    try {
      const result = await api.getNotification(id);
      const n = result.notification;
      const isBattleLike = ["battle", "barbarian"].includes(n.category);
      const battle = isBattleLike ? n.data : null;

      if (battle?.attacker_army?.stacks && battle?.defender_army?.stacks) {
        // Open the full battle report instead of a raw-text alert.
        // Barbarian raids have no real "attacker" user object — the
        // recipient is always the attacker in that flow (settlements never
        // receive notifications), so category alone decides the viewer.
        const viewer =
          n.category === "barbarian" ? "attacker" : battle.attacker?.username === user?.username ? "attacker" : "defender";
        navigation.navigate("BattleResult", {
          result: {
            outcome: battle.winner,
            land_seized: battle.land_seized || 0,
            verdict: battle.verdict,
            log: battle.log || [],
            events: battle.events || [],
            attacker_army: normalizeArmy(battle.attacker_army),
            defender_army: normalizeArmy(battle.defender_army),
          },
          viewer,
        });
      } else {
        showAlert(n.title, n.content);
      }
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>{data.unread_count} unread</Text>
        {data.unread_count > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {data.notifications.map((n) => (
        <TouchableOpacity
          key={n.id}
          style={[styles.card, !n.read && styles.unread]}
          onPress={() => handleTap(n.id)}
        >
          <View style={styles.notifHeader}>
            <Text style={styles.category}>{n.category}</Text>
            <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
          </View>
          <Text style={styles.title}>{n.title}</Text>
          <Text style={styles.content} numberOfLines={2}>{n.content}</Text>
        </TouchableOpacity>
      ))}

      {data.notifications.length === 0 && (
        <EmptyState icon="📭" title="No notifications" subtitle="Battle reports and kingdom events will appear here." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, ...webColumn },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  headerText: { color: colors.text, fontSize: 16 },
  markAllText: { color: colors.info, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  category: { color: colors.accent, fontSize: 11, textTransform: "uppercase" },
  time: { color: colors.faint, fontSize: 11 },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  content: { color: colors.muted, fontSize: 13, marginTop: 4 },
  emptyText: { color: colors.faint, textAlign: "center", padding: 24 },
});
