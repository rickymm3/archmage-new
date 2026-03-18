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

export default function DefenseScreen({ navigation }) {
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

  if (!data) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  const nonHeroUnits = data.units.filter((u) => u.unit_type !== "hero");
  const defendingUnits = nonHeroUnits.filter((u) => (garrisonValues[u.id] || 0) > 0);
  const availableUnits = nonHeroUnits.filter((u) => (garrisonValues[u.id] || 0) < u.quantity);
  const dirty = isDirty();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadGarrison(); setRefreshing(false); }} />}
    >
      {/* Header with save icon */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🛡 Garrison Setup</Text>
          <Text style={styles.headerSub}>Assign units to defend your kingdom</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveIcon, { backgroundColor: dirty ? "#f39c12" : "#2ecc71" }, saving && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveIconText}>{saving ? "…" : "💾"}</Text>
        </TouchableOpacity>
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

      {/* Defense Spell */}
      {data.available_spells && data.available_spells.length > 0 && (
        <View style={styles.spellSection}>
          <Text style={styles.spellSectionTitle}>Defense Spell</Text>
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

      <View style={{ height: 40 }} />

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
                minimumTrackTintColor={sliderModal.mode === "add" ? "#2ecc71" : "#e74c3c"}
                maximumTrackTintColor="#2a2a4a"
                thumbTintColor={sliderModal.mode === "add" ? "#2ecc71" : "#e74c3c"}
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
                    { backgroundColor: sliderModal.mode === "add" ? "#2ecc71" : "#e74c3c" },
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  loading: { color: "#666", textAlign: "center", marginTop: 60 },

  // Header
  header: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8 },
  headerTitle: { color: "#e0e0e0", fontSize: 20, fontWeight: "bold" },
  headerSub: { color: "#888", fontSize: 13, marginTop: 4 },
  saveIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  saveIconText: { fontSize: 16 },

  // Section label
  sectionLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  emptySection: { marginHorizontal: 12, paddingVertical: 16, alignItems: "center" },
  emptyText: { color: "#555", fontSize: 13, fontStyle: "italic" },

  // Defending cards
  defendCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2ecc71",
    borderLeftWidth: 3,
  },
  defendRow: { flexDirection: "row", alignItems: "center" },
  defendName: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  defendStats: { color: "#888", fontSize: 11, marginTop: 3 },
  defendBadge: { alignItems: "center", marginLeft: 12 },
  defendCount: { color: "#2ecc71", fontSize: 20, fontWeight: "bold" },
  defendTotal: { color: "#555", fontSize: 11, marginTop: 2 },

  // Available cards
  availCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  availName: { color: "#aaa", fontSize: 15, fontWeight: "600" },
  availBadge: { alignItems: "center", marginLeft: 12 },
  availCount: { color: "#888", fontSize: 18, fontWeight: "bold" },
  availLabel: { color: "#555", fontSize: 10, marginTop: 2 },

  // Spell section
  spellSection: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  spellSectionTitle: { color: "#e0e0e0", fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  spellOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    marginBottom: 6,
  },
  spellSelected: {
    borderColor: "#7c5cbf",
    backgroundColor: "rgba(124,92,191,0.1)",
  },
  spellName: { color: "#e0e0e0", fontSize: 14 },
  spellNameSelected: { color: "#7c5cbf", fontWeight: "600" },
  spellType: { color: "#888", fontSize: 12 },

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
    backgroundColor: "#1a1a2e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a40",
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f1c40f",
    textAlign: "center",
    marginBottom: 4,
  },
  modalUnit: {
    fontSize: 15,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 12,
  },
  modalInfo: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  modalValueLabel: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 2,
  },
  modalValue: {
    color: "#e0e0e0",
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
  sliderLabel: { color: "#666", fontSize: 12 },
  modalPreview: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a40",
    alignItems: "center",
  },
  modalCancelTxt: { color: "#aaa", fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
