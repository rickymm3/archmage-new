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

export default function ActiveSpellsScreen() {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      setData(await api.getActiveSpells());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handleCancel(id, type) {
    try {
      const result = await api.cancelActiveSpell(id, type);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}
    >
      {data.active_spells.length > 0 && (
        <Text style={styles.sectionTitle}>Timed Enchantments</Text>
      )}
      {data.active_spells.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.name}>{s.spell_name}</Text>
            <Text style={styles.stack}>x{s.stack_count}</Text>
          </View>
          <Text style={styles.meta}>{s.spell_type} • Expires: {new Date(s.expires_at).toLocaleTimeString()}</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(s.id)}>
            <Text style={styles.cancelText}>Dispel</Text>
          </TouchableOpacity>
        </View>
      ))}

      {data.sustained_spells.length > 0 && (
        <Text style={styles.sectionTitle}>Sustained Spells</Text>
      )}
      {data.sustained_spells.map((s) => (
        <View key={`s-${s.id}`} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.name}>{s.spell_name}</Text>
            <Text style={styles.sustained}>Sustained</Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(s.id, "sustained")}>
            <Text style={styles.cancelText}>Deactivate</Text>
          </TouchableOpacity>
        </View>
      ))}

      {data.active_spells.length === 0 && data.sustained_spells.length === 0 && (
        <Text style={styles.emptyText}>No active spells</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  sectionTitle: { color: "#7c5cbf", fontSize: 16, fontWeight: "600", padding: 14, paddingBottom: 6 },
  card: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
  stack: { color: "#7c5cbf", fontSize: 16, fontWeight: "bold" },
  sustained: { color: "#2ecc71", fontSize: 13 },
  meta: { color: "#888", fontSize: 12, marginTop: 4 },
  cancelBtn: { borderWidth: 1, borderColor: "#e74c3c", paddingVertical: 6, borderRadius: 6, alignItems: "center", marginTop: 10 },
  cancelText: { color: "#e74c3c", fontSize: 13 },
  emptyText: { color: "#666", textAlign: "center", padding: 24 },
});
