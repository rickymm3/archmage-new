import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import { LoadingState } from "../components/ui";
import LoadingButton from "../components/LoadingButton";
import { useDrawer } from "../components/GameHubShell";
import { CompactShell, StatStrip, CompactNote } from "../components/DrawerCompact";
import { colors, alpha } from "../theme";

export default function DefenseScreen({ navigation }) {
  const drawer = useDrawer();
  const expanded = drawer ? drawer.expanded : true;
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [garrisonValues, setGarrisonValues] = useState({});
  const [savedValues, setSavedValues] = useState({});
  const [selectedSpellId, setSelectedSpellId] = useState(null);
  const [savedSpellId, setSavedSpellId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Slider modal state
  const [sliderModal, setSliderModal] = useState(null);
  const [sliderValue, setSliderValue] = useState(0);

  // Hero assignment modal state
  const [heroModal, setHeroModal] = useState(null);

  async function loadGarrison() {
    try {
      const result = await api.getGarrison();
      setData(result);
      const values = {};
      result.units.forEach((u) => {
        values[u.id] = u.garrison;
      });
      setGarrisonValues(values);
      setSavedValues({ ...values });
      setSelectedSpellId(result.active_defense_spell_id);
      setSavedSpellId(result.active_defense_spell_id);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadGarrison(); }, []));

  function isDirty() {
    if (selectedSpellId !== savedSpellId) return true;
    for (const id of Object.keys(garrisonValues)) {
      if ((garrisonValues[id] || 0) !== (savedValues[id] || 0)) return true;
    }
    return false;
  }

  function openAddSlider(unit) {
    const currentGarrison = garrisonValues[unit.id] || 0;
    const maxAddable = unit.quantity - currentGarrison;
    if (maxAddable <= 0) {
      showAlert("No Units", `All ${unit.name} are already garrisoned.`);
      return;
    }
    setSliderValue(0);
    setSliderModal({ unit, mode: "add", max: maxAddable, current: currentGarrison });
  }

  function openRemoveSlider(unit) {
    const currentGarrison = garrisonValues[unit.id] || 0;
    if (currentGarrison <= 0) return;
    setSliderValue(currentGarrison);
    setSliderModal({ unit, mode: "remove", max: currentGarrison, current: currentGarrison });
  }

  function confirmSlider() {
    const { unit, mode } = sliderModal;
    const currentGarrison = garrisonValues[unit.id] || 0;
    if (mode === "add") {
      setGarrisonValues((prev) => ({ ...prev, [unit.id]: currentGarrison + sliderValue }));
    } else {
      // sliderValue = units to KEEP on defense
      setGarrisonValues((prev) => ({ ...prev, [unit.id]: sliderValue }));
    }
    setSliderModal(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const units = Object.entries(garrisonValues).map(([id, garrison]) => ({
        id: parseInt(id),
        garrison: garrison || 0,
      }));
      await api.updateGarrison(units, selectedSpellId);
      setSavedValues({ ...garrisonValues });
      setSavedSpellId(selectedSpellId);
      showAlert("Success", "Defenses updated!");
    } catch (e) {
      showAlert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function assignHeroTo(hero, unit) {
    setHeroModal(null);
    try {
      if (unit) {
        await api.assignHero(unit.unit_id, hero.id);
      } else {
        // Unassign: clear from whichever stack the hero currently leads
        const ledUnit = data.units.find((u) => u.hero?.id === hero.id);
        if (ledUnit) await api.assignHero(ledUnit.unit_id, null);
      }
      await loadGarrison();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  const nonHeroUnits = data.units.filter((u) => u.unit_type !== "hero");
  const defendingUnits = nonHeroUnits.filter((u) => (garrisonValues[u.id] || 0) > 0);
  const availableUnits = nonHeroUnits.filter((u) => (garrisonValues[u.id] || 0) < u.quantity);
  const dirty = isDirty();

  // Live defense strength — updates as sliders change, before saving.
  const garrisonCount = nonHeroUnits.reduce((n, u) => n + (garrisonValues[u.id] || 0), 0);
  const garrisonDefense = nonHeroUnits.reduce((n, u) => n + (garrisonValues[u.id] || 0) * (u.defense || 0), 0);

  // Collapsed drawer: garrison strength at a glance, plus save if there's
  // an unsaved plan. Assigning units/heroes/spells happens above.
  if (!expanded) {
    return (
      <CompactShell hint="Pull up to assign defenders">
        <StatStrip
          items={[
            { value: `🛡 ${garrisonCount}`, label: "Garrisoned" },
            { value: garrisonDefense.toLocaleString(), label: "Defense power", color: colors.info },
            { value: dirty ? "Unsaved" : "Saved", label: "Plan", color: dirty ? colors.warning : colors.success },
          ]}
        />
        <CompactNote>
          {defendingUnits.length > 0
            ? defendingUnits.slice(0, 3).map((u) => `${garrisonValues[u.id]}× ${u.name}`).join(" · ") +
              (defendingUnits.length > 3 ? ` · +${defendingUnits.length - 3} more` : "")
            : "No units garrisoned — your kingdom is undefended!"}
        </CompactNote>
        {dirty && (
          <LoadingButton style={styles.compactSaveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.compactSaveTxt}>💾 Save Defense Plan</Text>
          </LoadingButton>
        )}
      </CompactShell>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: dirty ? 90 : 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadGarrison(); setRefreshing(false); }} />}
    >
      {/* Defense strength summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>🛡 {garrisonCount}</Text>
          <Text style={styles.summaryLabel}>Garrisoned</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.info }]}>{garrisonDefense.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Defense Power</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: dirty ? colors.warning : colors.success }]}>
            {dirty ? "●" : "✓"}
          </Text>
          <Text style={styles.summaryLabel}>{dirty ? "Unsaved" : "Saved"}</Text>
        </View>
      </View>

      {/* Defending Units */}
      <Text style={styles.sectionLabel}>Defending ({defendingUnits.length})</Text>
      {defendingUnits.length === 0 && (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>No units garrisoned — tap units below to add</Text>
        </View>
      )}
      {defendingUnits.map((u) => {
        const garrison = garrisonValues[u.id] || 0;
        return (
          <TouchableOpacity key={u.id} style={styles.defendCard} onPress={() => openRemoveSlider(u)}>
            <View style={styles.defendRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.defendName}>{u.name}</Text>
                <Text style={styles.defendStats}>⚔️ {u.attack}  🛡 {u.defense}  💨 {u.speed}</Text>
              </View>
              <View style={styles.defendBadge}>
                <Text style={styles.defendCount}>{garrison}</Text>
                <Text style={styles.defendTotal}>/ {u.quantity}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Available Units */}
      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Available Units ({availableUnits.length})</Text>
      {availableUnits.length === 0 && nonHeroUnits.length > 0 && (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>All units are garrisoned</Text>
        </View>
      )}
      {nonHeroUnits.length === 0 && (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>No units to garrison. Recruit some first!</Text>
        </View>
      )}
      {availableUnits.map((u) => {
        const garrison = garrisonValues[u.id] || 0;
        const ungarrisoned = u.quantity - garrison;
        return (
          <TouchableOpacity key={u.id} style={styles.availCard} onPress={() => openAddSlider(u)}>
            <View style={styles.defendRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.availName}>{u.name}</Text>
                <Text style={styles.defendStats}>⚔️ {u.attack}  🛡 {u.defense}  💨 {u.speed}</Text>
              </View>
              <View style={styles.availBadge}>
                <Text style={styles.availCount}>{ungarrisoned}</Text>
                <Text style={styles.availLabel}>free</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Hero Command — right after the units it empowers */}
      {data.heroes && data.heroes.length > 0 && (
        <View style={styles.spellSection}>
          <Text style={styles.spellSectionTitle}>🦸 Hero Command</Text>
          <Text style={styles.heroHint}>
            Assign heroes to lead your defending stacks. A hero empowers its unit
            and keeps fighting even if the stack falls.
          </Text>
          {data.heroes.map((hero) => {
            const ledUnit = data.units.find((u) => u.hero?.id === hero.id);
            return (
              <TouchableOpacity
                key={hero.id}
                style={[styles.spellOption, ledUnit && styles.spellSelected]}
                onPress={() => setHeroModal(hero)}
              >
                <View>
                  <Text style={[styles.spellName, ledUnit && styles.spellNameSelected]}>{hero.name}</Text>
                  <Text style={styles.spellType}>⚔️ {hero.attack}   🛡 {hero.defense}</Text>
                </View>
                <Text style={ledUnit ? styles.heroAssigned : styles.spellType}>
                  {ledUnit ? `Leading ${ledUnit.name}` : "Unassigned"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Defense Spell */}
      {data.available_spells && data.available_spells.length > 0 && (
        <View style={styles.spellSection}>
          <Text style={styles.spellSectionTitle}>✨ Defense Spell</Text>
          <TouchableOpacity
            style={[styles.spellOption, !selectedSpellId && styles.spellSelected]}
            onPress={() => setSelectedSpellId(null)}
          >
            <Text style={[styles.spellName, !selectedSpellId && styles.spellNameSelected]}>None</Text>
          </TouchableOpacity>
          {data.available_spells.map((spell) => (
            <TouchableOpacity
              key={spell.id}
              style={[styles.spellOption, selectedSpellId === spell.id && styles.spellSelected]}
              onPress={() => setSelectedSpellId(spell.id)}
            >
              <Text style={[styles.spellName, selectedSpellId === spell.id && styles.spellNameSelected]}>
                {spell.name}
              </Text>
              <Text style={styles.spellType}>{spell.spell_type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 20 }} />

      {/* Hero Assignment Modal */}
      {heroModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setHeroModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Assign {heroModal.name}</Text>
              <Text style={styles.modalInfo}>Choose a unit stack for this hero to lead.</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {nonHeroUnits.filter((u) => u.quantity > 0).map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.spellOption, u.hero?.id === heroModal.id && styles.spellSelected]}
                    onPress={() => assignHeroTo(heroModal, u)}
                  >
                    <Text style={styles.spellName}>{u.name}</Text>
                    <Text style={styles.spellType}>
                      x{u.quantity}{u.hero ? ` • ${u.hero.name}` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setHeroModal(null)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                {data.units.some((u) => u.hero?.id === heroModal.id) && (
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }]}
                    onPress={() => assignHeroTo(heroModal, null)}
                  >
                    <Text style={styles.modalConfirmTxt}>Unassign</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Slider Modal */}
      {sliderModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSliderModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {sliderModal.mode === "add" ? "Add to Garrison" : "Remove from Garrison"}
              </Text>
              <Text style={styles.modalUnit}>{sliderModal.unit.name}</Text>

              <Text style={styles.modalInfo}>
                {sliderModal.mode === "add"
                  ? `${sliderModal.max} available to garrison`
                  : `${sliderModal.max} currently garrisoned`}
              </Text>

              <Text style={styles.modalValueLabel}>
                {sliderModal.mode === "remove" ? "Keep on defense" : ""}
              </Text>
              <Text style={styles.modalValue}>{sliderValue}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={sliderModal.max}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
                minimumTrackTintColor={sliderModal.mode === "add" ? colors.success : colors.danger}
                maximumTrackTintColor={colors.border}
                thumbTintColor={sliderModal.mode === "add" ? colors.success : colors.danger}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0</Text>
                <Text style={styles.sliderLabel}>{sliderModal.max}</Text>
              </View>

              {(() => {
                if (sliderModal.mode === "add" && sliderValue > 0) {
                  return <Text style={styles.modalPreview}>Garrison: {sliderModal.current} → {sliderModal.current + sliderValue}</Text>;
                }
                if (sliderModal.mode === "remove" && sliderValue < sliderModal.current) {
                  const removing = sliderModal.current - sliderValue;
                  return <Text style={styles.modalPreview}>Removing {removing} from garrison</Text>;
                }
                return null;
              })()}

              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSliderModal(null)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    { backgroundColor: sliderModal.mode === "add" ? colors.success : colors.danger },
                    sliderModal.mode === "add" && sliderValue === 0 && { opacity: 0.4 },
                    sliderModal.mode === "remove" && sliderValue === sliderModal.current && { opacity: 0.4 },
                  ]}
                  onPress={confirmSlider}
                  disabled={sliderModal.mode === "add" ? sliderValue === 0 : sliderValue === sliderModal.current}
                >
                  <Text style={styles.modalConfirmTxt}>
                    {sliderModal.mode === "add" ? "Add" : "Remove"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>

    {/* Sticky save bar — only when there are unsaved changes */}
    {dirty && (
      <View style={styles.saveBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnTxt}>{saving ? "Saving…" : "💾 Save Defense Setup"}</Text>
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  loading: { color: colors.faint, textAlign: "center", marginTop: 60 },

  // Summary bar
  summaryBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    marginBottom: 8,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  summaryLabel: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryDivider: { width: 1, backgroundColor: colors.border },

  // Sticky save bar
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: alpha(colors.bg, "f2"),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnTxt: { color: colors.white, fontSize: 15, fontWeight: "800" },
  compactSaveBtn: {
    backgroundColor: colors.info,
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: "center",
  },
  compactSaveTxt: { color: colors.white, fontSize: 12, fontWeight: "800" },

  // Section label
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  emptySection: { marginHorizontal: 12, paddingVertical: 16, alignItems: "center" },
  emptyText: { color: colors.faint, fontSize: 13, fontStyle: "italic" },

  // Defending cards
  defendCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 3,
  },
  defendRow: { flexDirection: "row", alignItems: "center" },
  defendName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  defendStats: { color: colors.muted, fontSize: 11, marginTop: 3 },
  defendBadge: { alignItems: "center", marginLeft: 12 },
  defendCount: { color: colors.success, fontSize: 20, fontWeight: "bold" },
  defendTotal: { color: colors.faint, fontSize: 11, marginTop: 2 },

  // Available cards
  availCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availName: { color: colors.textDim, fontSize: 15, fontWeight: "600" },
  availBadge: { alignItems: "center", marginLeft: 12 },
  availCount: { color: colors.muted, fontSize: 18, fontWeight: "bold" },
  availLabel: { color: colors.faint, fontSize: 10, marginTop: 2 },

  // Spell section
  spellSection: {
    backgroundColor: colors.card,
    margin: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spellSectionTitle: { color: colors.text, fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  spellOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  spellSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124,92,191,0.1)",
  },
  spellName: { color: colors.text, fontSize: 14 },
  spellNameSelected: { color: colors.accent, fontWeight: "600" },
  spellType: { color: colors.muted, fontSize: 12 },
  heroHint: { color: colors.muted, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  heroAssigned: { color: colors.gold, fontSize: 12, fontWeight: "600" },

  // Modal
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
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.gold,
    textAlign: "center",
    marginBottom: 4,
  },
  modalUnit: {
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  modalInfo: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  modalValueLabel: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 2,
  },
  modalValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    fontVariant: ["tabular-nums"],
  },
  slider: { width: "100%", height: 40 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: { color: colors.faint, fontSize: 12 },
  modalPreview: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: "center",
  },
  modalCancelTxt: { color: colors.textDim, fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmTxt: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
