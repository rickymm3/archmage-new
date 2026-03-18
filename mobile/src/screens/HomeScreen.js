import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen() {
  const { logout } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
        <Text style={styles.loadingText}>Loading...</Text>
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

      {/* Notifications */}
      {data.unread_notifications > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationText}>
            📬 {data.unread_notifications} unread notification{data.unread_notifications !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loadingText: { color: "#666", textAlign: "center", marginTop: 60 },
  card: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  cardTitle: { color: "#e0e0e0", fontSize: 24, fontWeight: "bold" },
  affinity: { color: "#7c5cbf", fontSize: 14, marginTop: 2 },
  protectionBadge: {
    backgroundColor: "#2ecc7133",
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  protectionText: { color: "#2ecc71", fontSize: 12 },
  sectionTitle: {
    color: "#7c5cbf",
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
  statValue: { color: "#e0e0e0", fontSize: 16, fontWeight: "bold" },
  statLabel: { color: "#888", fontSize: 11, marginTop: 2 },
  spellRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  spellName: { color: "#e0e0e0", fontSize: 14 },
  spellMeta: { color: "#7c5cbf", fontSize: 14 },
  notificationBadge: {
    backgroundColor: "#e74c3c33",
    margin: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  notificationText: { color: "#e74c3c", fontSize: 14 },
  logoutButton: {
    margin: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
    marginBottom: 32,
  },
  logoutText: { color: "#999", fontSize: 16 },
});
