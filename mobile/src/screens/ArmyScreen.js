import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
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
import { LoadingState, EmptyState, ProgressBar, ArtPlaceholder, SubTabs, FadeSlideIn, SceneBackground } from "../components/ui";
import { heroImage, unitImage, sceneImage } from "../assets";
import { colors, alpha } from "../theme";
import DefenseScreen from "./DefenseScreen";
import RecruitScreen from "./RecruitScreen";

const SUB_TABS = [
  { key: "overview", icon: "🏰", label: "Overview" },
  { key: "units", icon: "⚔️", label: "Units" },
  { key: "defense", icon: "🛡", label: "Defense" },
  { key: "recruit", icon: "📯", label: "Recruit" },
];

// Backend sends abilities as an object (e.g. { passive: "...", trigger: "..." }).
function heroAbilityText(abilities) {
  if (!abilities) return null;
  const values = Array.isArray(abilities) ? abilities : Object.values(abilities);
  const text = values.filter((v) => typeof v === "string").join(" · ");
  return text || null;
}

function moraleMeta(morale) {
  if (morale >= 75) return { color: colors.success, label: "High Spirits", warn: null };
  if (morale >= 20) return { color: colors.gold, label: "Uneasy", warn: "10% may desert if you attack" };
  if (morale > 0) return { color: colors.warning, label: "Furious", warn: "25% may desert if you attack" };
  return { color: colors.danger, label: "Chaos", warn: "50% may desert if you attack" };
}

function Chip({ icon, value, color = colors.textDim }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipTxt, { color }]}>{value}</Text>
    </View>
  );
}

export default function ArmyScreen({ route }) {
  const { showAlert } = useModal();
  const [subTab, setSubTab] = useState(route?.params?.subTab || "overview");
  const [recruitUnitId, setRecruitUnitId] = useState(null);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [disbandModal, setDisbandModal] = useState(null);
  const [disbandValue, setDisbandValue] = useState(0);
  const [selectedUnitId, setSelectedUnitId] = useState(null);

  // Deep links (e.g. Home → Recruit sub-tab)
  useEffect(() => {
    if (route?.params?.subTab) setSubTab(route.params.subTab);
  }, [route?.params?.subTab]);

  async function loadArmy() {
    try {
      const result = await api.getArmy();
      setData(result);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadArmy(); }, []));

  function changeSubTab(key) {
    setRecruitUnitId(null);
    setSubTab(key);
    if (key === "overview" || key === "units") loadArmy();
  }

  function goRecruitUnit(unitId) {
    setRecruitUnitId(unitId);
    setSubTab("recruit");
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

  /* ────────────────────────────────────────────────────────────── */

  function renderOverview() {
    if (!data) return <LoadingState />;
    const s = data.stats;
    const morale = Math.round(s.morale);
    const baseMorale = s.base_morale ?? s.morale;
    const meta = moraleMeta(morale);

    const capacity = s.army_capacity || 0;
    const size = s.total_quantity || 0;
    const overcrowded = capacity > 0 && size > capacity;
    const capPct = capacity > 0 ? (size / capacity) * 100 : 0;

    const missingMorale = Math.max(0, 100 - baseMorale);
    const payCost = Math.ceil((missingMorale / 100) * (s.daily_upkeep || 0));
    const canPay = payCost > 0 && s.daily_upkeep > 0;
    const canAfford = data.gold >= payCost;

    return (
      <View style={{ flex: 1 }}>
        {/* war chest — slim translucent strip in the header zone */}
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

        {/* the armory itself breathes here; UI sits on the floor below */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingBottom: 12 }}
          {...(Platform.OS !== "web"
            ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadArmy(); setRefreshing(false); }} /> }
            : {})}
        >
        {/* single status card: capacity + morale */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>⚔️ Army Size</Text>
            <Text style={[styles.statusValue, overcrowded && { color: colors.danger }]}>
              {size} / {capacity}
            </Text>
          </View>
          <ProgressBar
            percent={capPct}
            color={overcrowded ? colors.danger : capPct > 85 ? colors.warning : colors.success}
            height={7}
          />
          {overcrowded && (
            <Text style={styles.capWarn}>
              ⚠️ Overcrowded — morale drains {s.morale_penalty_multiplier}× faster. Build Field Camps or Barracks.
            </Text>
          )}

          <View style={[styles.statusRow, { marginTop: 14 }]}>
            <Text style={styles.statusLabel}>🎖 Morale · <Text style={{ color: meta.color }}>{meta.label}</Text></Text>
            <Text style={[styles.statusValue, { color: meta.color }]}>{morale}%</Text>
          </View>
          <ProgressBar percent={morale} color={meta.color} height={7} />
          <View style={styles.moraleFootRow}>
            <Text style={styles.moraleDecay}>−{s.morale_decay_per_hour || 4.2}/hr</Text>
            {meta.warn && <Text style={styles.moraleWarn}>💀 {meta.warn}</Text>}
          </View>

          {s.daily_upkeep > 0 && (
            canPay ? (
              <LoadingButton
                style={[styles.payBtn, !canAfford && styles.btnDisabled]}
                onPress={async () => {
                  try {
                    const result = await api.payUpkeep(payCost);
                    showAlert("Troops Paid!", `${result.message}. Morale restored to ${Math.round(result.morale)}%.`);
                    loadArmy();
                  } catch (e) {
                    showAlert("Error", e.message);
                  }
                }}
                disabled={!canAfford}
              >
                <Text style={styles.payBtnTxt}>
                  {canAfford ? `Pay Troops — 💰 ${payCost.toLocaleString()}` : `Need 💰 ${payCost.toLocaleString()} to pay troops`}
                </Text>
              </LoadingButton>
            ) : (
              <View style={[styles.payBtn, styles.payBtnFull]}>
                <Text style={styles.payBtnFullTxt}>✓ Troops are fully paid</Text>
              </View>
            )
          )}
        </View>

        {/* strength summary */}
        <View style={[styles.card, styles.strengthRow]}>
          <Chip icon="⚔️" value={`${Number(s.total_attack).toLocaleString()} ATK`} color={colors.dangerSoft} />
          <Chip icon="🛡" value={`${Number(s.total_defense).toLocaleString()} DEF`} color={colors.info} />
          <Chip icon="🪖" value={`${size} units`} />
        </View>
        </ScrollView>
      </View>
    );
  }

  function renderUnits() {
    if (!data) return <LoadingState />;
    const heroes = data.units.filter((u) => u.unit_type === "hero");
    const regularUnits = data.units.filter((u) => u.unit_type !== "hero");

    const selectedId =
      selectedUnitId != null && regularUnits.some((u) => u.id === selectedUnitId)
        ? selectedUnitId
        : regularUnits[0]?.id ?? null;
    const selUnit = regularUnits.find((u) => u.id === selectedId) || null;

    if (data.units.length === 0) {
      return <EmptyState icon="🪖" title="No units in your army" subtitle="Recruit soldiers or summon creatures with spells." />;
    }

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 16, paddingTop: 10 }}>
        {regularUnits.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {regularUnits.map((u) => {
                const isSel = u.id === selectedId;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.caroCard, isSel && styles.caroCardSelected]}
                    onPress={() => setSelectedUnitId(u.id)}
                    activeOpacity={0.85}
                  >
                    <ArtPlaceholder emoji="⚔️" label={null} size={92} source={unitImage(u.slug)} />
                    <Text style={[styles.caroName, isSel && { color: colors.gold }]} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <View style={[styles.caroCount, isSel && { backgroundColor: colors.gold }]}>
                      <Text style={[styles.caroCountTxt, isSel && { color: colors.bg }]}>×{u.quantity}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selUnit && (
              <View style={styles.detailPanel}>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{selUnit.name}</Text>
                    <Text style={styles.detailType}>
                      {selUnit.element ? `${selUnit.element} ` : ""}{selUnit.unit_type}
                      {selUnit.hero ? `  ·  led by ${selUnit.hero.name}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.detailQty}>×{selUnit.quantity}</Text>
                </View>

                <View style={styles.unitChips}>
                  <Chip icon="⚔️" value={`${selUnit.attack} ATK`} />
                  <Chip icon="🛡" value={`${selUnit.defense} DEF`} />
                  <Chip icon="💨" value={`${selUnit.speed} SPD`} />
                  <Chip icon="💰" value={`${selUnit.upkeep_cost}/d`} color={colors.warning} />
                  {selUnit.mana_upkeep > 0 && <Chip icon="🔮" value={`${selUnit.mana_upkeep}/d`} color={colors.info} />}
                </View>

                <View style={styles.dutyRow}>
                  {selUnit.garrison > 0 && (
                    <View style={[styles.dutyBadge, { borderColor: alpha(colors.info, "66") }]}>
                      <Text style={[styles.dutyTxt, { color: colors.info }]}>🛡 {selUnit.garrison} defending</Text>
                    </View>
                  )}
                  {selUnit.exploring > 0 && (
                    <View style={[styles.dutyBadge, { borderColor: alpha(colors.success, "66") }]}>
                      <Text style={[styles.dutyTxt, { color: colors.success }]}>🧭 {selUnit.exploring} exploring</Text>
                    </View>
                  )}
                  <View style={[styles.dutyBadge, { borderColor: colors.border }]}>
                    <Text style={styles.dutyTxt}>{selUnit.available} free</Text>
                  </View>
                </View>

                <View style={styles.detailActions}>
                  {selUnit.recruitable ? (
                    <TouchableOpacity
                      style={styles.recruitMoreBtn}
                      activeOpacity={0.85}
                      onPress={() => goRecruitUnit(selUnit.unit_id)}
                    >
                      <Text style={styles.recruitMoreTxt}>📯 Recruit More</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.recruitMoreBtn, styles.summonedNote]}>
                      <Text style={styles.summonedNoteTxt}>✨ Summoned — bolster via spells</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.disbandBtn} onPress={() => openDisband(selUnit)}>
                    <Text style={styles.disbandTxt}>Disband</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* heroes */}
        {heroes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Heroes</Text>
            {heroes.map((u) => (
              <View key={u.id} style={styles.heroCard}>
                <ArtPlaceholder emoji="🦸" label="Portrait" size={64} source={heroImage(u.slug)} style={styles.heroArt} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{u.name}</Text>
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
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <SceneBackground source={sceneImage("barracks")} />
      <FadeSlideIn key={subTab} style={{ flex: 1 }}>
        {subTab === "overview" && renderOverview()}
        {subTab === "units" && renderUnits()}
        {subTab === "defense" && <DefenseScreen />}
        {subTab === "recruit" && (
          <RecruitScreen route={{ params: { unitId: recruitUnitId } }} />
        )}
      </FadeSlideIn>

      <SubTabs tabs={SUB_TABS} active={subTab} onChange={changeSubTab} />

      {/* disband modal */}
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
    backgroundColor: alpha(colors.bg, "a6"),
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.border, "88"),
    paddingVertical: 10,
  },
  warChestItem: { flex: 1, alignItems: "center" },
  warChestValue: { color: colors.gold, fontSize: 15, fontWeight: "800" },
  warChestLabel: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  warChestDivider: { width: 1, backgroundColor: colors.border },

  /* cards */
  card: {
    backgroundColor: "rgba(26,26,46,0.92)",
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
  statusLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statusValue: { color: colors.text, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  capWarn: { color: colors.danger, fontSize: 11, marginTop: 7, lineHeight: 16 },
  moraleFootRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  moraleDecay: { color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  moraleWarn: { color: colors.danger, fontSize: 11, fontWeight: "600" },
  payBtn: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 12,
  },
  payBtnTxt: { color: colors.white, fontSize: 14, fontWeight: "700" },
  payBtnFull: { backgroundColor: alpha(colors.success, "1a"), borderWidth: 1, borderColor: alpha(colors.success, "55") },
  payBtnFullTxt: { color: colors.success, fontSize: 13, fontWeight: "600" },
  btnDisabled: { opacity: 0.45 },
  strengthRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12 },

  /* sections */
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 16,
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

  /* carousel */
  carousel: { paddingHorizontal: 12, gap: 10, paddingBottom: 4 },
  caroCard: {
    width: 116,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  caroCardSelected: {
    borderColor: colors.gold,
    backgroundColor: alpha(colors.gold, "12"),
  },
  caroName: { color: colors.textDim, fontSize: 11, fontWeight: "700", marginTop: 6 },
  caroCount: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: alpha(colors.bg, "dd"),
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  caroCountTxt: { color: colors.text, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },

  /* detail panel */
  detailPanel: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "55"),
  },
  detailHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  detailName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  detailType: { color: colors.accent, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  detailQty: { color: colors.gold, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  unitChips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  detailActions: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  recruitMoreBtn: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  recruitMoreTxt: { color: colors.white, fontSize: 14, fontWeight: "800" },
  summonedNote: {
    backgroundColor: alpha(colors.accent, "1a"),
    borderWidth: 1,
    borderColor: alpha(colors.accent, "55"),
  },
  summonedNoteTxt: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  disbandBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: alpha(colors.danger, "77"),
  },
  disbandTxt: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  dutyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  dutyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dutyTxt: { color: colors.muted, fontSize: 11, fontWeight: "600" },

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
  heroName: { color: colors.gold, fontSize: 15, fontWeight: "800" },
  heroAbilities: { color: colors.goldDim, fontSize: 11, marginTop: 3, lineHeight: 15 },
  heroStats: { flexDirection: "row", gap: 6, marginTop: 7 },

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
