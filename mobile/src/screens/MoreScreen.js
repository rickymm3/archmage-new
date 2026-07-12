import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

const MENU_ITEMS = [
  { screen: "Profile", icon: "👤", label: "Profile" },
  { screen: "Battles", icon: "⚔️", label: "Battles" },
  { screen: "Explorations", icon: "🗺", label: "Explorations" },
  { screen: "Marketplace", icon: "🏪", label: "Marketplace" },
  { screen: "ActiveSpells", icon: "✨", label: "Active Spells" },
  { screen: "Rankings", icon: "🏆", label: "Rankings" },
  { screen: "Notifications", icon: "📬", label: "Notifications" },
];

export default function MoreScreen({ navigation }) {
  const { logout } = useAuth();

  return (
    <ScrollView style={styles.container}>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuItem}
          onPress={() => navigation.navigate(item.screen)}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutItem} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuLabel: { color: colors.text, fontSize: 16, flex: 1 },
  chevron: { color: colors.faint, fontSize: 22 },
  logoutItem: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.faint,
    alignItems: "center",
  },
  logoutText: { color: colors.muted, fontSize: 16 },
});
