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
import { LoadingState, ArtPlaceholder, EmptyState } from "../components/ui";
import { useDrawer } from "../components/GameHubShell";
import { CompactShell, StatStrip, CompactNote } from "../components/DrawerCompact";
import { anyUnitImage, spellImage } from "../assets";
import { colors, rarityColors } from "../theme";

const ITEM_TYPE_EMOJI = { weapon: "⚔️", armor: "🛡", accessory: "💍", consumable: "🧪" };

export default function MarketplaceScreen() {
  const { showAlert, showPrompt } = useModal();
  const drawer = useDrawer();
  const expanded = drawer ? drawer.expanded : true;
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
    return <View style={styles.container}><LoadingState /></View>;
  }

  // Collapsed drawer: market pulse — gold, live auctions, won lots ready
  // to collect (with a one-tap collect). Browsing/bidding happens above.
  if (!expanded) {
    const won = data.won_listings || [];
    const soonest = (data.listings || []).reduce(
      (min, l) => (min == null || new Date(l.expires_at) < new Date(min.expires_at) ? l : min),
      null
    );
    return (
      <CompactShell hint="Pull up to browse & bid">
        <StatStrip
          items={[
            { value: `💰 ${Number(data.gold).toLocaleString()}`, label: "Gold", color: colors.gold },
            { value: `${(data.listings || []).length}`, label: "Auctions live" },
            { value: `${won.length}`, label: "Won lots", color: won.length > 0 ? colors.success : colors.muted },
          ]}
        />
        {won.length > 0 ? (
          <LoadingButton style={styles.compactCollectBtn} onPress={() => handleCollect(won[0].id)}>
            <Text style={styles.compactCollectTxt}>
              🏆 Collect {won[0].item?.name}
              {won.length > 1 ? ` (+${won.length - 1} more)` : ""}
            </Text>
          </LoadingButton>
        ) : soonest ? (
          <CompactNote>
            Ending soonest: {soonest.item?.name} · {soonest.current_price} 💰 · {new Date(soonest.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </CompactNote>
        ) : (
          <CompactNote>No listings right now — the market restocks over time.</CompactNote>
        )}
      </CompactShell>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}
    >
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {["regular", "heroes", "items"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f === "heroes" ? "Heroes" : f === "items" ? "Items" : "Goods"}
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
      {data.listings.map((l) => {
        const isItem = l.item_type === "Item";
        const rarityColor = isItem ? rarityColors[l.item?.rarity] : null;
        return (
        <View key={l.id} style={[styles.card, rarityColor && { borderColor: rarityColor }]}>
          <View style={styles.listingHeader}>
            <ArtPlaceholder
              emoji={isItem ? (ITEM_TYPE_EMOJI[l.item?.item_type] || "🎒") : filter === "heroes" ? "🦸" : l.item_type === "Spell" ? "📜" : "⚔️"}
              label={null}
              size={44}
              source={isItem ? undefined : l.item_type === "Spell" ? spellImage(l.item?.affinity) : anyUnitImage(l.item?.slug)}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{l.item?.name}</Text>
              <Text style={[styles.itemType, rarityColor && { color: rarityColor }]}>
                {isItem ? `${l.item?.rarity} ${l.item?.item_type}` : l.item_type}
                {l.quantity > 1 ? ` x${l.quantity}` : ""}
              </Text>
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
        );
      })}

      {data.listings.length === 0 && (
        <EmptyState icon="🏪" title="No listings available" subtitle="The market restocks over time — check back soon." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },
  tabs: { flexDirection: "row", backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  goldDisplay: { color: colors.gold, textAlign: "center", padding: 10, fontSize: 14 },
  section: { marginBottom: 8 },
  sectionTitle: { color: colors.accent, fontSize: 16, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 8 },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingHeader: { flexDirection: "row", justifyContent: "space-between" },
  itemName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  itemType: { color: colors.muted, fontSize: 12, marginTop: 2 },
  priceCol: { alignItems: "flex-end" },
  price: { color: colors.gold, fontSize: 16, fontWeight: "bold" },
  minBid: { color: colors.muted, fontSize: 11 },
  bidder: { color: colors.info, fontSize: 12, marginTop: 4 },
  expires: { color: colors.muted, fontSize: 12, marginTop: 4 },
  bidButton: { backgroundColor: colors.accent, paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 10 },
  bidText: { color: colors.white, fontWeight: "600" },
  collectButton: { backgroundColor: colors.success, paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 8 },
  collectText: { color: colors.white, fontWeight: "600" },
  compactCollectBtn: { backgroundColor: colors.success, borderRadius: 9, paddingVertical: 7, alignItems: "center" },
  compactCollectTxt: { color: colors.white, fontSize: 12, fontWeight: "800" },
  emptyText: { color: colors.faint, textAlign: "center", padding: 24 },
});
