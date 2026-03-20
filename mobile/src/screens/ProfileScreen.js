import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import * as api from "../services/api";
import LoadingButton from "../components/LoadingButton";

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const [kingdomName, setKingdomName] = useState(
    user?.has_kingdom_name ? user.kingdom_name : ""
  );

  async function handleSaveKingdomName() {
    const name = kingdomName.trim();
    if (name.length < 3 || name.length > 15) {
      showAlert("Error", "Kingdom name must be 3-15 characters");
      return;
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      showAlert("Error", "Kingdom name can only contain letters, numbers, and spaces");
      return;
    }

    if (user.has_kingdom_name) {
      const confirmed = await showConfirm(
        "Change Kingdom Name",
        `Renaming your kingdom costs 100 gold. Proceed?`,
        { confirmText: "Pay 100 Gold" }
      );
      if (!confirmed) return;
    }

    try {
      const result = await api.updateKingdomName(name);
      showAlert("Success", result.message);
      await refreshUser();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Player Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{user?.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Affinity</Text>
          <Text style={styles.value}>{user?.affinity}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Gold</Text>
          <Text style={[styles.value, { color: "#f1c40f" }]}>
            {Number(user?.gold || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Kingdom Name */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kingdom Name</Text>
        <Text style={styles.currentLabel}>
          Current: <Text style={styles.currentValue}>{user?.kingdom_name}</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={kingdomName}
          onChangeText={(t) => setKingdomName(t.slice(0, 15))}
          placeholder="Enter kingdom name"
          placeholderTextColor="#666"
          maxLength={15}
          autoCapitalize="words"
        />
        <Text style={styles.charCount}>{kingdomName.length}/15</Text>
        {user?.has_kingdom_name && (
          <Text style={styles.costNote}>Changing costs 💰 100 gold</Text>
        )}
        <LoadingButton style={styles.saveButton} onPress={handleSaveKingdomName}>
          <Text style={styles.saveText}>
            {user?.has_kingdom_name ? "Rename Kingdom" : "Set Kingdom Name"}
          </Text>
        </LoadingButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: "#1a1a2e",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#7c5cbf",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  label: { color: "#999", fontSize: 14 },
  value: { color: "#e0e0e0", fontSize: 14, fontWeight: "600" },
  currentLabel: { color: "#888", fontSize: 13, marginBottom: 10 },
  currentValue: { color: "#e0e0e0", fontWeight: "600" },
  input: {
    backgroundColor: "#0d0d1a",
    borderWidth: 1,
    borderColor: "#2a2a40",
    borderRadius: 8,
    color: "#e0e0e0",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  charCount: {
    color: "#666",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  costNote: {
    color: "#f1c40f",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: "#7c5cbf",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
