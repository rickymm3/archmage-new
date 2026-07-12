import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import LoadingButton from "../components/LoadingButton";
import { LoadingState, EmptyState, ProgressBar, ArtPlaceholder } from "../components/ui";
import { heroImage, unitImage } from "../assets";
import { colors, alpha } from "../theme";

// Backend sends abilities as an object (e.g. { passive: "...", trigger: "..." }).
function heroAbilityText(abilities) {
  if (!abilities) return null;
  const values = Array.isArray(abilities) ? abilities : Object.values(abilities);
  const text = values.filter((v) => typeof v === "string").join(" · ");
  return text || null;
}

// Morale tiers drive color + flavor + desertion warning.
function moraleMeta(morale) {
  if (morale >= 75)
    return { color: colors.success, label: "High Spirits", msg: "Your army is ready for anything.", warn: null };
  if (morale >= 20)
    return { color: colors.gold, label: "Uneasy", msg: "The troops hope you won't forget to pay them.", warn: "10% may desert if you attack" };
  if (morale > 0)
    return { color: colors.warning, label: "Furious", msg: "Some soldiers are openly discussing desertion.", warn: "25% may desert if you attack" };
  return { color: colors.danger, label: "Chaos", msg: "No one remembers why they are fighting.", warn: "50% may desert if you attack" };
}

/* ── stat chip ── */
function Chip({ icon, value, color = colors.textDim }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipTxt, { color }]}>{value}</Text>
    </View>
  );
}

export default function ArmyScreen({ navigation }) {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [disbandModal, setDisbandModal] = useState(null); // { unit }
  const [disbandValue, setDisbandValue] = useState(0);

  async function loadArmy() {
    try {
      const result = await api.getArmy();
      setData(result);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadArmy(); }, []));

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  const s = data.stats;
  const heroes = data.units.filter((u) => u.unit_type === "hero");
  const regularUnits = data.units.filter((u) => u.unit_type !== "hero");

  const morale = Math.round(s.morale);
  const baseMorale = s.base_morale ?? s.morale;
  const meta = moraleMeta(morale);

  const capacity = s.army_capacity || 0;
  const size = s.total_quantity || 0;
  const overcrowded = capacity > 0 && size > capacity;
  const capPct = capacity > 0 ? (size / capacity) * 100 : 0;

  // Cost to restore morale to 100: one full day of upkeep buys 100 points.
  const missingMorale = Math.max(0, 100 - baseMorale);
  const payCost = Math.ceil((missingMorale / 100) * (s.daily_upkeep || 0));
  const canPay = payCost > 0 && s.daily_upkeep > 0;
  const canAfford = data.gold >= payCost;

  async function handlePayTroops() {
    try {
      const result = await api.payUpkeep(payCost);
      showAlert("Troops Paid!", `${result.message}. Morale restored to ${Math.round(result.morale)}%.`);
      loadArmy();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  function openDisband(u) {
    const available = u.available ?? Math.max(0, u.quantity - (u.garrison || 0));
    if (available <= 0) {
      showAlert("Cannot Disband", "All of these units are garrisoned or exploring. Free them up first.");
      return;
    }
    setDisbandValue(0);
    setDisbandModal({ unit: u, max: available });
  }

  async function confirmDisband() {
    const { unit } = disbandModal;
    const qty = disbandValue;
    setDisbandModal(null);
    if (qty <= 0) return;
    try {
      const result = await api.disbandUnits(unit.unit_id, qty);
      showAlert("Disbanded", result.message);
      loadArmy();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        {...(Platform.OS !== "web"
          ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadArmy(); setRefreshing(false); }} /> }
          : {})}
      >
        {/* ── WAR CHEST ── */}
        <View style={styles.warChest}>
          <View style={styles.warChestItem}>
            <Text style={styles.warChestValue}>💰 {Number(data.gold).toLocaleString()}</Text>
            <Text style={styles.warChestLabel}>Treasury</Text>
          </View>
          <View style={styles.warChestDivider} />
          <View style={styles.warChestItem}>
            <Text style={[styles.warChestValue, { color: colors.warning }]}>−{Number(s.total_upkeep).toLocaleString()}/d</Text>
            <Text style={styles.warChestLabel}>Gold Upkeep</Text>
          </View>
          {s.total_mana_upkeep > 0 && (
            <>
              <View style={styles.warChestDivider} />
              <View style={styles.warChestItem}>
                <Text style={[styles.warChestValue, { color: colors.info }]}>−{Number(s.total_mana_upkeep).toLocaleString()} 🔮</Text>
                <Text style={styles.warChestLabel}>Mana Upkeep</Text>
              </View>
            </>
          )}
        </View>

        {/* ── ARMY SIZE / CAPACITY ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>⚔️ Army Size</Text>
            <Text style={[styles.capCount, overcrowded && { color: colors.danger }]}>
              {size} / {capacity}
            </Text>
          </View>
          <ProgressBar
            percent={capPct}
            color={overcrowded ? colors.danger : capPct > 85 ? colors.warning : colors.success}
            height={8}
          />
          {overcrowded ? (
            <Text style={styles.capWarn}>
              ⚠️ Overcrowded! Morale drains {s.morale_penalty_multiplier}× faster. Build Field Camps or Barracks to raise capacity.
            </Text>
          ) : (
            <Text style={styles.capHint}>
              {capacity - size} slots free · exceeding capacity drains morale faster
            </Text>
          )}
          <View style={styles.powerRow}>
            <Chip icon="⚔️" value={`${Number(s.total_attack).toLocaleString()} ATK`} color={colors.dangerSoft} />
            <Chip icon="🛡" value={`${Number(s.total_defense).toLocaleString()} DEF`} color={colors.info} />
          </View>
        </View>

        {/* ── MORALE ── */}
        <View style={[styles.card, { borderColor: alpha(meta.color, "66") }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>🎖 Morale</Text>
            <Text style={[styles.moralePct, { color: meta.color }]}>{morale}%</Text>
          </View>
          <ProgressBar percent={morale} color={meta.color} height={10} />
          <View style={styles.moraleMetaRow}>
            <Text style={[styles.moraleLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.moraleDecay}>
              −{s.morale_decay_per_hour || 4.2}/hr{overcrowded ? "  ⚠️" : ""}
            </Text>
          </View>
          <Text style={styles.moraleMsg}>{meta.msg}</Text>
          {meta.warn && <Text style={styles.moraleWarn}>💀 {meta.warn}</Text>}

          {s.daily_upkeep > 0 && (
            canPay ? (
              <LoadingButton
                style={[styles.payBtn, !canAfford && styles.btnDisabled]}
                onPress={handlePayTroops}
                disabled={!canAfford}
              >
                <Text style={styles.payBtnTxt}>
                  {canAfford
                    ? `Pay Troops — 💰 ${payCost.toLocaleString()}  (restores to 100%)`
                    : `Need 💰 ${payCost.toLocaleString()} to pay troops`}
                </Text>
              </LoadingButton>
            ) : (
              <View style={[styles.payBtn, styles.payBtnFull]}>
                <Text style={styles.payBtnFullTxt}>✓ Troops are fully paid</Text>
              </View>
            )
          )}
        </View>

        {/* ── ACTION TILES ── */}
        <View style={styles.tileRow}>
          <TouchableOpacity style={[styles.tile, { borderColor: alpha(colors.info, "88") }]} activeOpacity={0.8} onPress={() => navigation.navigate("Defense")}>
            <Text style={styles.tileIcon}>🛡</Text>
            <Text style={styles.tileTitle}>Defense</Text>
            <Text style={styles.tileSub}>
              {regularUnits.reduce((n, u) => n + (u.garrison || 0), 0)} garrisoned
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tile, { borderColor: alpha(colors.success, "88") }]} activeOpacity={0.8} onPress={() => navigation.navigate("Recruit")}>
            <Text style={styles.tileIcon}>📯</Text>
            <Text style={styles.tileTitle}>Recruit</Text>
            <Text style={styles.tileSub}>enlist new soldiers</Text>
          </TouchableOpacity>
        </View>

        {/* ── HEROES ── */}
        {heroes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Heroes</Text>
            {heroes.map((u) => (
              <View key={u.id} style={styles.heroCard}>
                <ArtPlaceholder emoji="🦸" label="Portrait" size={72} source={heroImage(u.slug)} style={styles.heroArt} />
                <View style={{ flex: 1 }}>
                  <View style={styles.heroTopRow}>
                    <Text style={styles.heroName}>{u.name}</Text>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeTxt}>★ HERO</Text>
                    </View>
                  </View>
                  {heroAbilityText(u.abilities) && (
                    <Text style={styles.heroAbilities} numberOfLines={2}>{heroAbilityText(u.abilities)}</Text>
                  )}
                  <View style={styles.heroStats}>
                    <Chip icon="⚔️" value={u.attack} color={colors.goldDim} />
                    <Chip icon="🛡" value={u.defense} color={colors.goldDim} />
                    <Chip icon="💨" value={u.speed} color={colors.goldDim} />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── UNITS ── */}
        {regularUnits.length > 0 && <Text style={styles.sectionTitle}>Units</Text>}
        {regularUnits.map((u) => {
          const busy = (u.garrison || 0) + (u.exploring || 0);
          return (
            <View key={u.id} style={styles.unitCard}>
              <View style={styles.unitRow}>
                <ArtPlaceholder emoji="⚔️" label={null} size={52} source={unitImage(u.slug)} style={styles.unitArt} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitName}>{u.name}</Text>
                  <Text style={styles.unitType}>
                    {u.element ? `${u.element} ` : ""}{u.unit_type}
                    {u.hero ? `  ·  led by ${u.hero.name}` : ""}
                  </Text>
                  <View style={styles.unitChips}>
                    <Chip icon="⚔️" value={u.attack} />
                    <Chip icon="🛡" value={u.defense} />
                    <Chip icon="💨" value={u.speed} />
                    <Chip icon="💰" value={`${u.upkeep_cost}/d`} color={colors.warning} />
                  </View>
                </View>
                <View style={styles.unitQtyCol}>
                  <Text style={styles.unitQty}>×{u.quantity}</Text>
                  <TouchableOpacity style={styles.disbandBtn} onPress={() => openDisband(u)}>
                    <Text style={styles.disbandTxt}>Disband</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {busy > 0 && (
                <View style={styles.dutyRow}>
                  {u.garrison > 0 && (
                    <View style={[styles.dutyBadge, { borderColor: alpha(colors.info, "66") }]}>
                      <Text style={[styles.dutyTxt, { color: colors.info }]}>🛡 {u.garrison} defending</Text>
                    </View>
                  )}
                  {u.exploring > 0 && (
                    <View style={[styles.dutyBadge, { borderColor: alpha(colors.success, "66") }]}>
                      <Text style={[styles.dutyTxt, { color: colors.success }]}>🧭 {u.exploring} exploring</Text>
                    </View>
                  )}
                  <View style={[styles.dutyBadge, { borderColor: colors.border }]}>
                    <Text style={styles.dutyTxt}>{u.available} free</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {data.units.length === 0 && (
          <EmptyState icon="🪖" title="No units in your army" subtitle="Recruit soldiers or summon creatures with spells." />
        )}
      </ScrollView>

      {/* ── DISBAND MODAL ── */}
      {disbandModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setDisbandModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Disband {disbandModal.unit.name}</Text>
              <Text style={styles.modalInfo}>
                {disbandModal.max} available · disbanded units are gone for good
              </Text>
              <Text style={styles.modalValue}>{disbandValue}</Text>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={disbandModal.max}
                step={1}
                value={disbandValue}
                onValueChange={setDisbandValue}
                minimumTrackTintColor={colors.danger}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.danger}
              />
              {disbandValue > 0 && (
                <Text style={styles.modalPreview}>
                  Saves 💰 {(disbandValue * disbandModal.unit.upkeep_cost).toLocaleString()}/day in upkeep
                </Text>
              )}
              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDisbandModal(null)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, disbandValue === 0 && styles.btnDisabled]}
                  onPress={confirmDisband}
                  disabled={disbandValue === 0}
                >
                  <Text style={styles.modalConfirmTxt}>Disband {disbandValue > 0 ? disbandValue : ""}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* war chest */
  warChest: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  warChestItem: { flex: 1, alignItems: "center" },
  warChestValue: { color: colors.gold, fontSize: 15, fontWeight: "800" },
  warChestLabel: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  warChestDivider: { width: 1, backgroundColor: colors.border },

  /* cards */
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },

  /* capacity */
  capCount: { color: colors.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  capWarn: { color: colors.danger, fontSize: 12, marginTop: 8, lineHeight: 17 },
  capHint: { color: colors.muted, fontSize: 11, marginTop: 8 },
  powerRow: { flexDirection: "row", gap: 8, marginTop: 10 },

  /* morale */
  moralePct: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  moraleMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  moraleLabel: { fontSize: 13, fontWeight: "700" },
  moraleDecay: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  moraleMsg: { color: colors.textDim, fontSize: 12, fontStyle: "italic", marginTop: 6 },
  moraleWarn: { color: colors.danger, fontSize: 12, fontWeight: "600", marginTop: 4 },
  payBtn: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  payBtnTxt: { color: colors.white, fontSize: 14, fontWeight: "700" },
  payBtnFull: { backgroundColor: alpha(colors.success, "1a"), borderWidth: 1, borderColor: alpha(colors.success, "55") },
  payBtnFullTxt: { color: colors.success, fontSize: 13, fontWeight: "600" },
  btnDisabled: { opacity: 0.45 },

  /* action tiles */
  tileRow: { flexDirection: "row", gap: 10, marginHorizontal: 12, marginTop: 12 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 16,
  },
  tileIcon: { fontSize: 30, marginBottom: 6 },
  tileTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  tileSub: { color: colors.muted, fontSize: 11, marginTop: 2 },

  /* sections */
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 18,
    marginBottom: 8,
  },

  /* chips */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(colors.bg, "aa"),
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  chipIcon: { fontSize: 10 },
  chipTxt: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },

  /* heroes */
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "77"),
    gap: 12,
  },
  heroArt: { borderRadius: 10 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroName: { color: colors.gold, fontSize: 16, fontWeight: "800", flex: 1 },
  heroBadge: {
    backgroundColor: alpha(colors.gold, "22"),
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  heroBadgeTxt: { color: colors.gold, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroAbilities: { color: colors.goldDim, fontSize: 11, marginTop: 3, lineHeight: 15 },
  heroStats: { flexDirection: "row", gap: 6, marginTop: 7 },

  /* units */
  unitCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitRow: { flexDirection: "row", alignItems: "center" },
  unitArt: { marginRight: 10, borderRadius: 8 },
  unitName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  unitType: { color: colors.accent, fontSize: 11, marginTop: 1, textTransform: "capitalize" },
  unitChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  unitQtyCol: { alignItems: "flex-end", marginLeft: 8 },
  unitQty: { color: colors.text, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
  disbandBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: alpha(colors.danger, "77"),
  },
  disbandTxt: { color: colors.danger, fontSize: 11, fontWeight: "600" },
  dutyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  dutyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dutyTxt: { color: colors.muted, fontSize: 11, fontWeight: "600" },

  /* disband modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.danger, textAlign: "center", marginBottom: 6 },
  modalInfo: { color: colors.muted, fontSize: 13, textAlign: "center", marginBottom: 12 },
  modalValue: { color: colors.text, fontSize: 30, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  modalPreview: { color: colors.success, fontSize: 12, textAlign: "center", marginBottom: 6 },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: "center",
  },
  modalCancelTxt: { color: colors.textDim, fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
  },
  modalConfirmTxt: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
