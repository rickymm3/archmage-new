import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import LoadingButton from "../components/LoadingButton";
import { LoadingState, EmptyState, ArtPlaceholder } from "../components/ui";
import { colors, alpha, rarityColors } from "../theme";

const SLOT_ORDER = ["weapon", "armor", "accessory"];
const SLOT_LABEL = { weapon: "Weapon", armor: "Armor", accessory: "Accessory" };
const TYPE_EMOJI = { weapon: "⚔️", armor: "🛡", accessory: "💍", consumable: "🧪" };

function abilityText(abilities) {
  if (!abilities) return null;
  const parts = [];
  if (abilities.buff_attack_pct) parts.push(`+${Math.round(abilities.buff_attack_pct * 100)}% ATK`);
  if (abilities.buff_defense_pct) parts.push(`+${Math.round(abilities.buff_defense_pct * 100)}% DEF`);
  if (abilities.buff_speed) parts.push(`+${abilities.buff_speed} SPD`);
  if (abilities.buff_type) parts.push(`(${abilities.buff_type} only)`);
  if (abilities.buff_element) parts.push(`(${abilities.buff_element} only)`);
  return parts.join(" · ") || null;
}

function useEffectText(effect) {
  if (!effect) return null;
  const parts = [];
  if (effect.gold) parts.push(`+${effect.gold} 💰`);
  if (effect.mana) parts.push(`+${effect.mana} 🔮`);
  if (effect.land) parts.push(`+${effect.land} acres`);
  if (effect.restore_morale) parts.push(`+${effect.restore_morale} morale`);
  if (effect.protection_minutes) parts.push(`${effect.protection_minutes}min protection`);
  if (effect.reveal_settlements) parts.push("reveals all settlements");
  return parts.join(" · ") || null;
}

export default function InventoryScreen() {
  const { showAlert, showConfirm } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadInventory() {
    try {
      setData(await api.getInventory());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadInventory(); }, []));

  async function handleEquip(userItem) {
    try {
      const result = await api.equipItem(userItem.id);
      showAlert("Equipped", result.message);
      loadInventory();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleUnequip(userItem) {
    try {
      const result = await api.unequipItem(userItem.id);
      showAlert("Unequipped", result.message);
      loadInventory();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleUse(userItem) {
    const confirmed = await showConfirm(
      `Use ${userItem.item.name}?`,
      "This will consume one and cannot be undone.",
      { confirmText: "Use" }
    );
    if (!confirmed) return;
    try {
      const result = await api.useItem(userItem.id);
      const effectSummary = useEffectText(result.effect);
      showAlert("Used", effectSummary ? `${result.message} (${effectSummary})` : result.message);
      loadInventory();
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
      contentContainerStyle={{ paddingBottom: 20 }}
      {...(Platform.OS !== "web"
        ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadInventory(); setRefreshing(false); }} /> }
        : {})}
    >
      <Text style={styles.sectionTitle}>Equipped</Text>
      <View style={styles.slotRow}>
        {SLOT_ORDER.map((slot) => {
          const ui = data.equipped[slot];
          return (
            <View key={slot} style={styles.slotCard}>
              <ArtPlaceholder emoji={TYPE_EMOJI[slot]} label={null} size={44} />
              <Text style={styles.slotLabel}>{SLOT_LABEL[slot]}</Text>
              {ui ? (
                <>
                  <Text style={[styles.slotItemName, { color: rarityColors[ui.item.rarity] }]} numberOfLines={1}>
                    {ui.item.name}
                  </Text>
                  <LoadingButton style={styles.slotUnequipBtn} onPress={() => handleUnequip(ui)}>
                    <Text style={styles.slotUnequipTxt}>Unequip</Text>
                  </LoadingButton>
                </>
              ) : (
                <Text style={styles.slotEmpty}>Empty</Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Inventory · {data.gold.toLocaleString()} 💰</Text>

      {data.inventory.length === 0 && (
        <EmptyState icon="🎒" title="No items yet" subtitle="Loot barbarian settlements or buy from the marketplace." />
      )}

      {data.inventory.map((ui) => {
        const rarityColor = rarityColors[ui.item.rarity] || colors.muted;
        const detail = ui.item.item_type === "consumable" ? useEffectText(ui.item.use_effect) : abilityText(ui.item.abilities);

        return (
          <View key={ui.id} style={[styles.itemCard, { borderColor: alpha(rarityColor, "66") }]}>
            <ArtPlaceholder emoji={TYPE_EMOJI[ui.item.item_type]} label={null} size={44} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemName} numberOfLines={1}>{ui.item.name}</Text>
                {ui.quantity > 1 && <Text style={styles.itemQty}>×{ui.quantity}</Text>}
              </View>
              <Text style={[styles.itemRarity, { color: rarityColor }]}>{ui.item.rarity} {ui.item.item_type}</Text>
              {detail && <Text style={styles.itemDetail}>{detail}</Text>}
              {ui.item.description && <Text style={styles.itemDesc} numberOfLines={2}>{ui.item.description}</Text>}

              <View style={styles.itemActions}>
                {ui.item.item_type === "consumable" ? (
                  <LoadingButton style={styles.useBtn} onPress={() => handleUse(ui)}>
                    <Text style={styles.useTxt}>Use</Text>
                  </LoadingButton>
                ) : ui.equipped ? (
                  <LoadingButton style={styles.unequipBtn} onPress={() => handleUnequip(ui)}>
                    <Text style={styles.unequipTxt}>Unequip</Text>
                  </LoadingButton>
                ) : (
                  <LoadingButton style={styles.equipBtn} onPress={() => handleEquip(ui)}>
                    <Text style={styles.equipTxt}>Equip</Text>
                  </LoadingButton>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  slotRow: { flexDirection: "row", gap: 8, marginHorizontal: 12 },
  slotCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  slotLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginTop: 6 },
  slotItemName: { fontSize: 11, fontWeight: "700", marginTop: 4, textAlign: "center" },
  slotEmpty: { color: colors.faint, fontSize: 11, marginTop: 4, fontStyle: "italic" },
  slotUnequipBtn: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.danger },
  slotUnequipTxt: { color: colors.danger, fontSize: 10, fontWeight: "700" },

  itemCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  itemQty: { color: colors.gold, fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  itemRarity: { fontSize: 11, fontWeight: "700", textTransform: "capitalize", marginTop: 2 },
  itemDetail: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  itemDesc: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  itemActions: { flexDirection: "row", marginTop: 10 },
  equipBtn: { backgroundColor: colors.success, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  equipTxt: { color: colors.white, fontSize: 12, fontWeight: "700" },
  unequipBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.danger },
  unequipTxt: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  useBtn: { backgroundColor: colors.info, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  useTxt: { color: colors.white, fontSize: 12, fontWeight: "700" },
});
