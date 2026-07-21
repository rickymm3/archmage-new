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
import { LoadingState } from "../components/ui";
import { useDrawer } from "../components/GameHubShell";
import { CompactShell } from "../components/DrawerCompact";
import { colors } from "../theme";

export default function RankingsScreen() {
  const drawer = useDrawer();
  const expanded = drawer ? drawer.expanded : true;
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
    return <View style={styles.container}><LoadingState /></View>;
  }

  // Collapsed drawer: the podium — top three kingdoms in slim rows.
  if (!expanded) {
    return (
      <CompactShell hint="Pull up for the full rankings">
        {data.rankings.slice(0, 3).map((r) => (
          <View key={r.id} style={styles.compactRow}>
            <Text style={[styles.rank, r.rank <= 3 && styles.topRank, { width: 26, fontSize: 14 }]}>{r.rank}</Text>
            <Text style={[styles.username, { flex: 1, fontSize: 13 }]} numberOfLines={1}>
              {r.has_fog ? "???" : (r.kingdom_name || r.username)}
            </Text>
            <Text style={[styles.power, { fontSize: 12 }]}>{r.has_fog ? "???" : r.power}</Text>
          </View>
        ))}
      </CompactShell>
    );
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
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCol: { color: colors.muted, fontSize: 12, fontWeight: "bold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.card,
  },
  rank: { color: colors.muted, fontSize: 16, fontWeight: "bold", width: 30 },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  topRank: { color: colors.gold },
  username: { color: colors.text, fontSize: 15, fontWeight: "600" },
  affinity: { color: colors.accent, fontSize: 11, marginTop: 1 },
  power: { color: colors.text, fontSize: 14, width: 70, textAlign: "right" },
  land: { color: colors.muted, fontSize: 14, width: 50, textAlign: "right" },
});
