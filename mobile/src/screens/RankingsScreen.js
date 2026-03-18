import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";

export default function RankingsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      setData(await api.getRankings());
    } catch (e) {
      // silent
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  if (!data) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCol, { width: 30 }]}>#</Text>
        <Text style={[styles.headerCol, { flex: 1 }]}>Player</Text>
        <Text style={[styles.headerCol, { width: 70, textAlign: "right" }]}>Power</Text>
        <Text style={[styles.headerCol, { width: 50, textAlign: "right" }]}>Land</Text>
      </View>

      {data.rankings.map((r) => (
        <View key={r.id} style={styles.row}>
          <Text style={[styles.rank, r.rank <= 3 && styles.topRank]}>{r.rank}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>
              {r.has_fog ? "???" : (r.kingdom_name || r.username)}
            </Text>
            <Text style={styles.affinity}>{r.affinity}</Text>
          </View>
          <Text style={styles.power}>{r.has_fog ? "???" : r.power}</Text>
          <Text style={styles.land}>{r.has_fog ? "?" : r.land}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#1a1a2e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  headerCol: { color: "#888", fontSize: 12, fontWeight: "bold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  rank: { color: "#888", fontSize: 16, fontWeight: "bold", width: 30 },
  topRank: { color: "#f1c40f" },
  username: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  affinity: { color: "#7c5cbf", fontSize: 11, marginTop: 1 },
  power: { color: "#e0e0e0", fontSize: 14, width: 70, textAlign: "right" },
  land: { color: "#999", fontSize: 14, width: 50, textAlign: "right" },
});
