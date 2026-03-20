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
import LoadingButton from "../components/LoadingButton";

export default function MarketplaceScreen() {
  const { showAlert, showPrompt } = useModal();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("regular");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      setData(await api.getMarketplace(filter));
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [filter]));

  async function handleBid(listingId, minBid) {
    const amount = await showPrompt("Place Bid", `Minimum bid: ${minBid} gold`, { submitText: "Bid", defaultValue: String(minBid), keyboardType: "number-pad" });
    if (amount === null) return;
    try {
      const result = await api.placeBid(listingId, parseInt(amount) || 0);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleCollect(listingId) {
    try {
      const result = await api.collectListing(listingId);
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
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {["regular", "heroes"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f === "heroes" ? "Heroes" : "Items"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.goldDisplay}>💰 {data.gold} gold</Text>

      {/* Won Listings */}
      {data.won_listings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Won Auctions</Text>
          {data.won_listings.map((l) => (
            <View key={l.id} style={styles.card}>
              <Text style={styles.itemName}>{l.item?.name}</Text>
              <LoadingButton style={styles.collectButton} onPress={() => handleCollect(l.id)}>
                <Text style={styles.collectText}>Collect</Text>
              </LoadingButton>
            </View>
          ))}
        </View>
      )}

      {/* Active Listings */}
      {data.listings.map((l) => (
        <View key={l.id} style={styles.card}>
          <View style={styles.listingHeader}>
            <View>
              <Text style={styles.itemName}>{l.item?.name}</Text>
              <Text style={styles.itemType}>{l.item_type}{l.quantity > 1 ? ` x${l.quantity}` : ""}</Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.price}>{l.current_price} 💰</Text>
              <Text style={styles.minBid}>Min: {l.min_next_bid}</Text>
            </View>
          </View>
          {l.bidder && <Text style={styles.bidder}>Leading: {l.bidder.kingdom_name || l.bidder.username}</Text>}
          <Text style={styles.expires}>Expires: {new Date(l.expires_at).toLocaleTimeString()}</Text>
          <LoadingButton style={styles.bidButton} onPress={() => handleBid(l.id, l.min_next_bid)}>
            <Text style={styles.bidText}>Place Bid</Text>
          </LoadingButton>
        </View>
      ))}

      {data.listings.length === 0 && (
        <Text style={styles.emptyText}>No listings available</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },
  tabs: { flexDirection: "row", backgroundColor: "#1a1a2e", borderBottomWidth: 1, borderBottomColor: "#2a2a4a" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#7c5cbf" },
  tabText: { color: "#888", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#7c5cbf" },
  goldDisplay: { color: "#f1c40f", textAlign: "center", padding: 10, fontSize: 14 },
  section: { marginBottom: 8 },
  sectionTitle: { color: "#7c5cbf", fontSize: 16, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 8 },
  card: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  listingHeader: { flexDirection: "row", justifyContent: "space-between" },
  itemName: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
  itemType: { color: "#888", fontSize: 12, marginTop: 2 },
  priceCol: { alignItems: "flex-end" },
  price: { color: "#f1c40f", fontSize: 16, fontWeight: "bold" },
  minBid: { color: "#999", fontSize: 11 },
  bidder: { color: "#3498db", fontSize: 12, marginTop: 4 },
  expires: { color: "#888", fontSize: 12, marginTop: 4 },
  bidButton: { backgroundColor: "#7c5cbf", paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 10 },
  bidText: { color: "#fff", fontWeight: "600" },
  collectButton: { backgroundColor: "#2ecc71", paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 8 },
  collectText: { color: "#fff", fontWeight: "600" },
  emptyText: { color: "#666", textAlign: "center", padding: 24 },
});
