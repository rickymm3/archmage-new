import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { colors, alpha, webColumn } from "../theme";

function SettingsRow({ icon, label, detail, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.74}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.label, danger && { color: colors.danger }]}>{label}</Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { logout } = useAuth();
  const { showConfirm } = useModal();

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Game & Account</Text>
      <View style={styles.panel}>
        <SettingsRow icon="👤" label="Profile" detail="Kingdom name and player information" onPress={() => navigation.navigate("Profile")} />
        <SettingsRow icon="🔔" label="Notifications" detail="Battle reports and kingdom activity" onPress={() => navigation.navigate("Notifications")} />
        <SettingsRow
          icon="🚪"
          label="Sign Out"
          detail="Leave your kingdom for now"
          danger
          onPress={async () => {
            const confirmed = await showConfirm("Sign Out", "Leave your kingdom for now?", { confirmText: "Sign Out" });
            if (confirmed) logout();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 14, ...webColumn },
  heading: { color: colors.gold, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 },
  panel: { overflow: "hidden", borderRadius: 12, borderWidth: 1, borderColor: alpha(colors.goldDim, "66"), backgroundColor: colors.card },
  row: {
    minHeight: 66,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: { width: 34, fontSize: 20, textAlign: "center" },
  rowText: { flex: 1, paddingHorizontal: 10 },
  label: { color: colors.text, fontSize: 14, fontWeight: "800" },
  detail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  chevron: { color: colors.goldDim, fontSize: 24 },
});
