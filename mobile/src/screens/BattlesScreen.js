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
import { LoadingState, EmptyState } from "../components/ui";
import { colors } from "../theme";

export default function BattlesScreen({ navigation }) {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadBattles() {
    try {
      setData(await api.getBattles());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadBattles(); }, []));

  async function handleScout() {
    try {
      const result = await api.scout();
      setData(result);
      showAlert("Scouted", result.message);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadBattles(); setRefreshing(false); }} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Scouted Targets</Text>
        <TouchableOpacity
          style={[styles.scoutButton, !data.can_refresh && styles.disabled]}
          onPress={handleScout}
          disabled={!data.can_refresh}
        >
          <Text style={styles.scoutText}>🔍 Scout</Text>
        </TouchableOpacity>
      </View>

      {(data.targets || []).map((target, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.targetHeader}>
            <Text style={styles.targetName}>{target.name || target.username}</Text>
            <Text style={styles.targetPower}>⚡ {target.power_estimate || target.net_power || target.power}</Text>
          </View>
          <Text style={styles.meta}>
            🏔 {target.land} land • ⚔️ {target.army_strength || "?"} army
          </Text>
          {target.under_protection ? (
            <Text style={styles.protected}>🛡 Protected</Text>
          ) : (
            <TouchableOpacity
              style={styles.attackButton}
              onPress={() =>
                navigation.navigate("AttackSetup", {
                  targetId: target.id,
                  targetName: target.name || target.username,
                })
              }
            >
              <Text style={styles.attackText}>Attack</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {(!data.targets || data.targets.length === 0) && (
        <EmptyState icon="🔭" title="No targets scouted" subtitle="Tap Scout to find enemy kingdoms to raid." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  headerText: { color: colors.text, fontSize: 18, fontWeight: "bold" },
  scoutButton: { backgroundColor: colors.info, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  disabled: { opacity: 0.4 },
  scoutText: { color: colors.white, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetHeader: { flexDirection: "row", justifyContent: "space-between" },
  targetName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  targetPower: { color: colors.gold, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  protected: { color: colors.success, fontSize: 12, marginTop: 6 },
  attackButton: { backgroundColor: colors.danger, paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 10 },
  attackText: { color: colors.white, fontWeight: "600" },
  emptyText: { color: colors.faint, textAlign: "center", padding: 24 },
});
