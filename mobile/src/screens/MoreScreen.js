import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

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
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuLabel: { color: "#e0e0e0", fontSize: 16, flex: 1 },
  chevron: { color: "#555", fontSize: 22 },
  logoutItem: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
  },
  logoutText: { color: "#999", fontSize: 16 },
});
