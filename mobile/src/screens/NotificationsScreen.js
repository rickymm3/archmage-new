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

export default function NotificationsScreen() {
  const { showAlert } = useModal();
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
      showAlert(n.title, n.content + (n.battle_log ? `\n\n${JSON.stringify(n.battle_log)}` : ""));
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
        <Text style={styles.emptyText}>No notifications</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  headerText: { color: "#e0e0e0", fontSize: 16 },
  markAllText: { color: "#3498db", fontSize: 14 },
  card: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  unread: { borderLeftWidth: 3, borderLeftColor: "#7c5cbf" },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  category: { color: "#7c5cbf", fontSize: 11, textTransform: "uppercase" },
  time: { color: "#666", fontSize: 11 },
  title: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  content: { color: "#999", fontSize: 13, marginTop: 4 },
  emptyText: { color: "#666", textAlign: "center", padding: 24 },
});
