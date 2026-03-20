import React, { useState, useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";
import LoadingButton from "../components/LoadingButton";

const AFFINITY_META = {
  general: { name: "General", emoji: "📜", color: "#aaa" },
  pyromancer: { name: "Pyromancer", emoji: "🔥", color: "#e74c3c" },
  mindweaver: { name: "Mindweaver", emoji: "🧠", color: "#3498db" },
  geomancer: { name: "Geomancer", emoji: "🌿", color: "#2ecc71" },
  tempest: { name: "Tempest", emoji: "⚡", color: "#f1c40f" },
  voidwalker: { name: "Voidwalker", emoji: "🌑", color: "#95a5a6" },
};

const SPELL_TYPE_META = {
  self:    { label: "Cast on Self",    emoji: "✨", order: 1 },
  defense: { label: "Defense",         emoji: "🛡️", order: 2 },
  summon:  { label: "Summon",          emoji: "👹", order: 3 },
  enemy:   { label: "Cast on Enemy",   emoji: "⚔️", order: 4 },
  attack:  { label: "Cast on Enemy",   emoji: "⚔️", order: 4 },
};

export default function SpellsScreen() {
  const { showAlert } = useModal();
  const { user } = useAuth();
  const [tab, setTab] = useState("research"); // research | cast | active
  const [spellsData, setSpellsData] = useState(null);
  const [castingData, setCastingData] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAffinity, setSelectedAffinity] = useState(null);

  // Slider modal state
  const [researchModal, setResearchModal] = useState(null);
  const [sliderValue, setSliderValue] = useState(0);

  // Cast slider modal state
  const [castModal, setCastModal] = useState(null);
  const [castSliderValue, setCastSliderValue] = useState(0);

  // Info modal state
  const [infoSpell, setInfoSpell] = useState(null);

  async function loadData() {
    try {
      if (tab === "research") {
        const data = await api.getSpells();
        setSpellsData(data);
        if (!selectedAffinity) {
          setSelectedAffinity(data.user_affinity || "general");
        }
      } else if (tab === "cast") {
        const data = await api.getCastingSpells();
        setCastingData(data);
        if (!selectedAffinity) {
          setSelectedAffinity(user?.color || "general");
        }
      } else {
        setActiveData(await api.getActiveSpells());
      }
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [tab]));

  function handleResearch(spell) {
    const invested = spell.research_progress;
    const remaining = spell.research_cost - invested;
    const maxInvest = Math.min(spellsData.current_mana, remaining);
    if (maxInvest <= 0) {
      showAlert("Cannot Research", remaining <= 0 ? "Already fully researched." : "Not enough mana.");
      return;
    }
    setSliderValue(maxInvest);
    setResearchModal({ spell, invested, remaining, maxInvest, currentMana: spellsData.current_mana });
  }

  async function confirmResearch() {
    const { spell } = researchModal;
    const amount = sliderValue;
    setResearchModal(null);
    try {
      const result = await api.researchSpell(spell.id, amount);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  function previewEffect(spell, amount) {
    const scaling = spell.configuration?.scaling;
    if (!scaling) return null;
    const attr = scaling.attribute;
    const fn = scaling.function;
    let value = 0;
    if (fn === "linear") {
      value = (amount * (scaling.rate || 0)) + (scaling.base || 0);
    } else if (fn === "step") {
      const cpu = scaling.cost_per_unit || 1;
      value = Math.floor(amount / cpu);
    } else if (fn === "log") {
      const baseMag = scaling.base_magnitude || 0;
      const baseCost = scaling.base_cost || spell.mana_cost || 1;
      value = baseMag * Math.log2((amount / baseCost) + 1);
      value = Math.round(value * 100) / 100;
    }
    if (attr === "duration") {
      const hrs = value / 3600;
      return hrs >= 24 ? `${(hrs / 24).toFixed(1)} days` : `${hrs.toFixed(1)} hours`;
    } else if (attr === "quantity") {
      return `${Math.floor(value)} units`;
    }
    return `${value} ${scaling.unit || ""}`;
  }

  function handleCast(spell) {
    const minCost = spell.mana_cost;
    const available = castingData?.current_mana || 0;
    if (available < minCost) {
      showAlert("Not Enough Mana", `You need at least ${minCost} mana to cast ${spell.name}.`);
      return;
    }
    setCastSliderValue(minCost);
    setCastModal({ spell, minCost, maxInvest: available });
  }

  async function confirmCast() {
    const { spell } = castModal;
    const amount = castSliderValue;
    setCastModal(null);
    try {
      const result = await api.castSpell(spell.id, amount);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  async function handleCancel(id, type) {
    try {
      const result = await api.cancelActiveSpell(id, type);
      showAlert("Success", result.message);
      loadData();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  // Get spells for the currently selected affinity
  function getAffinitySpells() {
    if (!spellsData?.affinities || !selectedAffinity) return [];
    return spellsData.affinities[selectedAffinity] || [];
  }

  function renderResearchTab() {
    if (!spellsData) return null;

    const affinityKeys = Object.keys(spellsData.affinities || {});
    // Sort: user's affinity first, then general, then rest alphabetically
    const userAff = spellsData.user_affinity;
    affinityKeys.sort((a, b) => {
      if (a === userAff) return -1;
      if (b === userAff) return 1;
      if (a === "general") return -1;
      if (b === "general") return 1;
      return a.localeCompare(b);
    });

    const spells = getAffinitySpells();
    const currentResearch = spells.find((s) => !s.learned && s.unlocked && s.research_progress > 0);
    const nextToResearch = !currentResearch ? spells.find((s) => !s.learned && s.unlocked) : null;
    const activeSpell = currentResearch || nextToResearch;
    const learnedSpells = spells.filter((s) => s.learned);
    const lockedSpells = spells.filter((s) => !s.learned && s !== activeSpell);
    const affMeta = AFFINITY_META[selectedAffinity] || { name: selectedAffinity, emoji: "✨", color: "#888" };
    const isNative = selectedAffinity === userAff || selectedAffinity === "general";

    return (
      <>
        <Text style={styles.manaDisplay}>🔮 {spellsData.current_mana} / {spellsData.max_mana}</Text>

        {/* Affinity Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.affinityBar} contentContainerStyle={styles.affinityBarContent}>
          {affinityKeys.map((aff) => {
            const meta = AFFINITY_META[aff] || { name: aff, emoji: "✨", color: "#888" };
            const isSelected = selectedAffinity === aff;
            const isUserAff = aff === userAff;
            return (
              <TouchableOpacity
                key={aff}
                style={[
                  styles.affinityChip,
                  isSelected && { borderColor: meta.color, backgroundColor: meta.color + "20" },
                  isUserAff && !isSelected && { borderColor: meta.color + "60" },
                ]}
                onPress={() => setSelectedAffinity(aff)}
              >
                <Text style={styles.affinityEmoji}>{meta.emoji}</Text>
                <Text style={[styles.affinityName, isSelected && { color: meta.color }]}>{meta.name}</Text>
                {isUserAff && <View style={[styles.nativeDot, { backgroundColor: meta.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!isNative && (
          <Text style={styles.foreignNote}>Foreign magic — limited to first 8 spells</Text>
        )}

        {/* Currently Researching / Next to Research */}
        {activeSpell && (
          <View style={[styles.activeResearchCard, { borderColor: affMeta.color }]}>
            <View style={styles.activeResearchHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeResearchLabel}>
                  {activeSpell.research_progress > 0 ? "Currently Researching" : "Next to Research"}
                </Text>
                <Text style={[styles.activeResearchName, { color: affMeta.color }]}>{activeSpell.name}</Text>
              </View>
              <TouchableOpacity style={styles.infoBtn} onPress={() => setInfoSpell(activeSpell)}>
                <Text style={styles.infoBtnText}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activeResearchProgress}>
              <Text style={styles.activeProgressText}>
                {activeSpell.research_progress} / {activeSpell.research_cost} mana
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round((activeSpell.research_progress / activeSpell.research_cost) * 100)}%`, backgroundColor: affMeta.color }]} />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.researchBtn, { backgroundColor: affMeta.color }]}
              onPress={() => handleResearch(activeSpell)}
            >
              <Text style={styles.researchBtnText}>Research</Text>
            </TouchableOpacity>
          </View>
        )}

        {!activeSpell && spells.length > 0 && learnedSpells.length === spells.length && (
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>{affMeta.emoji}</Text>
            <Text style={styles.completedText}>All {affMeta.name} spells mastered!</Text>
          </View>
        )}

        {/* Learned Spells */}
        {learnedSpells.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Learned ({learnedSpells.length})</Text>
            {learnedSpells.map((s) => (
              <View key={s.id} style={styles.learnedCard}>
                <View style={styles.learnedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.learnedName}>{s.name}</Text>
                    <Text style={styles.learnedMeta}>Rank {s.rank} • {s.spell_type}</Text>
                  </View>
                  <Text style={styles.learnedCheck}>✓</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Locked / Upcoming */}
        {lockedSpells.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Upcoming ({lockedSpells.length})</Text>
            {lockedSpells.map((s) => (
              <View key={s.id} style={[styles.lockedCard, !s.unlocked && { opacity: 0.4 }]}>
                <View style={styles.learnedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedName}>{s.name}</Text>
                    <Text style={styles.learnedMeta}>Rank {s.rank} • {s.research_cost} mana</Text>
                  </View>
                  <Text style={styles.lockedIcon}>{s.unlocked ? "📖" : "🔒"}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {spells.length === 0 && (
          <Text style={styles.emptyText}>No spells available for this affinity</Text>
        )}
      </>
    );
  }

  function renderCastTab() {
    if (!castingData) return null;

    // Group learned spells by affinity
    const grouped = {};
    castingData.spells.forEach((s) => {
      const aff = s.affinity || "general";
      if (!grouped[aff]) grouped[aff] = [];
      grouped[aff].push(s);
    });

    // Build affinity keys from those that have spells, sorted same way
    const userAff = user?.color || "general";
    const affinityKeys = Object.keys(AFFINITY_META).filter((aff) => grouped[aff]?.length > 0);
    affinityKeys.sort((a, b) => {
      if (a === userAff) return -1;
      if (b === userAff) return 1;
      if (a === "general") return -1;
      if (b === "general") return 1;
      return a.localeCompare(b);
    });

    if (affinityKeys.length === 0) {
      return <Text style={styles.emptyText}>No spells learned yet. Research some first!</Text>;
    }

    // Default to first available affinity if current selection has no castable spells
    const effectiveAffinity = affinityKeys.includes(selectedAffinity) ? selectedAffinity : affinityKeys[0];
    const spells = grouped[effectiveAffinity] || [];
    const affMeta = AFFINITY_META[effectiveAffinity] || { name: effectiveAffinity, emoji: "✨", color: "#888" };

    return (
      <>
        <Text style={styles.manaDisplay}>🔮 {castingData.current_mana} / {castingData.max_mana} • ✨ {castingData.magic_power} MP</Text>

        {/* Affinity Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.affinityBar} contentContainerStyle={styles.affinityBarContent}>
          {affinityKeys.map((aff) => {
            const meta = AFFINITY_META[aff] || { name: aff, emoji: "✨", color: "#888" };
            const isSelected = effectiveAffinity === aff;
            const isUserAff = aff === userAff;
            const count = grouped[aff]?.length || 0;
            return (
              <TouchableOpacity
                key={aff}
                style={[
                  styles.affinityChip,
                  isSelected && { borderColor: meta.color, backgroundColor: meta.color + "20" },
                  isUserAff && !isSelected && { borderColor: meta.color + "60" },
                ]}
                onPress={() => setSelectedAffinity(aff)}
              >
                <Text style={styles.affinityEmoji}>{meta.emoji}</Text>
                <Text style={[styles.affinityName, isSelected && { color: meta.color }]}>{meta.name}</Text>
                <Text style={[styles.castCount, isSelected && { color: meta.color }]}>{count}</Text>
                {isUserAff && <View style={[styles.nativeDot, { backgroundColor: meta.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Spells grouped by type */}
        {(() => {
          // Group spells by type
          const typeGroups = {};
          spells.forEach((s) => {
            const t = s.spell_type || "self";
            if (!typeGroups[t]) typeGroups[t] = [];
            typeGroups[t].push(s);
          });
          const sortedTypes = Object.keys(typeGroups).sort((a, b) => {
            return (SPELL_TYPE_META[a]?.order || 99) - (SPELL_TYPE_META[b]?.order || 99);
          });
          return sortedTypes.map((type) => {
            const typeMeta = SPELL_TYPE_META[type] || { label: type, emoji: "📜", order: 99 };
            const typeSpells = typeGroups[type];
            return (
              <View key={type}>
                <View style={styles.typeHeader}>
                  <Text style={styles.typeEmoji}>{typeMeta.emoji}</Text>
                  <Text style={styles.typeLabel}>{typeMeta.label}</Text>
                  <View style={styles.typeLine} />
                </View>
                {typeSpells.map((s) => (
                  <View key={s.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: affMeta.color }]}>
                    <View style={styles.spellHeader}>
                      <Text style={styles.spellName}>{s.name}</Text>
                      <View style={styles.spellHeaderRight}>
                        <Text style={styles.manaCost}>{s.mana_cost} mana</Text>
                        <TouchableOpacity style={styles.infoBtnSmall} onPress={() => setInfoSpell(s)}>
                          <Text style={styles.infoBtnSmallText}>ⓘ</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.meta}>Rank {s.rank}</Text>
                    <LoadingButton
                      style={[styles.castButton, { backgroundColor: affMeta.color }]}
                      onPress={() => handleCast(s)}
                    >
                      <Text style={styles.actionText}>Cast</Text>
                    </LoadingButton>
                  </View>
                ))}
              </View>
            );
          });
        })()}
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}
    >
      {/* Tabs */}
      <View style={styles.tabs}>
        {["research", "cast", "active"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Research Tab */}
      {tab === "research" && renderResearchTab()}

      {/* Cast Tab */}
      {tab === "cast" && castingData && renderCastTab()}

      {/* Active Tab */}
      {tab === "active" && activeData && (
        <>
          {activeData.active_spells.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.spellHeader}>
                <Text style={styles.spellName}>{s.spell_name}</Text>
                <Text style={styles.stackCount}>x{s.stack_count}</Text>
              </View>
              <Text style={styles.meta}>{s.spell_type} • Expires: {new Date(s.expires_at).toLocaleTimeString()}</Text>
              <LoadingButton
                style={styles.cancelButton}
                onPress={() => handleCancel(s.id)}
              >
                <Text style={styles.cancelText}>Dispel</Text>
              </LoadingButton>
            </View>
          ))}
          {activeData.sustained_spells.map((s) => (
            <View key={`s-${s.id}`} style={styles.card}>
              <View style={styles.spellHeader}>
                <Text style={styles.spellName}>{s.spell_name}</Text>
                <Text style={styles.sustainedBadge}>Sustained</Text>
              </View>
              <LoadingButton
                style={styles.cancelButton}
                onPress={() => handleCancel(s.id, "sustained")}
              >
                <Text style={styles.cancelText}>Deactivate</Text>
              </LoadingButton>
            </View>
          ))}
          {activeData.active_spells.length === 0 && activeData.sustained_spells.length === 0 && (
            <Text style={styles.emptyText}>No active spells</Text>
          )}
        </>
      )}

      {/* Research Slider Modal */}
      {researchModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setResearchModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Research</Text>
              <Text style={styles.modalSpellName}>{researchModal.spell.name}</Text>

              <Text style={styles.manaAvailable}>🔮 {researchModal.currentMana} mana available</Text>

              <View style={styles.manaProgress}>
                <Text style={styles.manaProgressText}>
                  {researchModal.invested} / {researchModal.spell.research_cost} mana invested
                </Text>
                <View style={styles.manaProgressBarBg}>
                  <View style={[styles.manaProgressBarFill, { width: `${Math.round((researchModal.invested / researchModal.spell.research_cost) * 100)}%` }]} />
                </View>
              </View>

              <Text style={styles.investLabel}>Invest: {sliderValue} mana</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={researchModal.maxInvest}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
                minimumTrackTintColor="#7c5cbf"
                maximumTrackTintColor="#2a2a4a"
                thumbTintColor="#7c5cbf"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0</Text>
                <Text style={styles.sliderLabel}>{researchModal.maxInvest}</Text>
              </View>

              {sliderValue >= researchModal.remaining && (
                <Text style={styles.learnNote}>This will complete the research!</Text>
              )}

              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResearchModal(null)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <LoadingButton
                  style={[styles.modalConfirmBtn, sliderValue === 0 && { opacity: 0.4 }]}
                  onPress={confirmResearch}
                  disabled={sliderValue === 0}
                >
                  <Text style={styles.modalConfirmTxt}>Research</Text>
                </LoadingButton>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Cast Slider Modal */}
      {castModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setCastModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cast Spell</Text>
              <Text style={styles.modalSpellName}>{castModal.spell.name}</Text>
              <Text style={styles.castModalDesc}>{castModal.spell.description}</Text>

              <Text style={styles.manaAvailable}>🔮 {castModal.maxInvest} mana available</Text>

              <Text style={styles.investLabel}>{castSliderValue} mana</Text>
              <Slider
                style={styles.slider}
                minimumValue={castModal.minCost}
                maximumValue={castModal.maxInvest}
                step={1}
                value={castSliderValue}
                onValueChange={setCastSliderValue}
                minimumTrackTintColor="#3498db"
                maximumTrackTintColor="#2a2a4a"
                thumbTintColor="#3498db"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>{castModal.minCost}</Text>
                <Text style={styles.sliderLabel}>{castModal.maxInvest}</Text>
              </View>

              {(() => {
                const preview = previewEffect(castModal.spell, castSliderValue);
                const basePreview = previewEffect(castModal.spell, castModal.minCost);
                if (!preview) return null;
                return (
                  <View style={styles.effectPreview}>
                    <Text style={styles.effectPreviewLabel}>Effect</Text>
                    <Text style={styles.effectPreviewValue}>{preview}</Text>
                    {castSliderValue > castModal.minCost && basePreview && (
                      <Text style={styles.effectPreviewBonus}>Base: {basePreview}</Text>
                    )}
                  </View>
                );
              })()}

              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCastModal(null)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <LoadingButton
                  style={[styles.modalConfirmBtn, { backgroundColor: "#3498db" }]}
                  onPress={confirmCast}
                >
                  <Text style={styles.modalConfirmTxt}>Cast</Text>
                </LoadingButton>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Spell Info Modal */}
      {infoSpell && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setInfoSpell(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{infoSpell.name}</Text>
              <Text style={[styles.infoAffinity, { color: (AFFINITY_META[infoSpell.affinity] || {}).color || "#888" }]}>
                {(AFFINITY_META[infoSpell.affinity] || {}).emoji} {(AFFINITY_META[infoSpell.affinity] || {}).name} • Rank {infoSpell.rank}
              </Text>
              <Text style={styles.infoDescription}>{infoSpell.description}</Text>
              <View style={styles.infoDivider} />
              <Text style={styles.infoDetail}>Type: {infoSpell.spell_type}</Text>
              <Text style={styles.infoDetail}>Research Cost: {infoSpell.research_cost} mana</Text>
              <Text style={styles.infoDetail}>Cast Cost: {infoSpell.mana_cost} mana</Text>
              <Text style={styles.infoDetail}>Rarity: {infoSpell.rarity || "Common"}</Text>
              <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setInfoSpell(null)}>
                <Text style={styles.infoCloseTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  tabs: { flexDirection: "row", backgroundColor: "#1a1a2e", borderBottomWidth: 1, borderBottomColor: "#2a2a4a" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#7c5cbf" },
  tabText: { color: "#888", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#7c5cbf" },
  manaDisplay: { color: "#7c5cbf", textAlign: "center", padding: 12, fontSize: 14 },

  // Affinity bar
  affinityBar: { maxHeight: 54, borderBottomWidth: 1, borderBottomColor: "#2a2a4a" },
  affinityBarContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  affinityChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#2a2a4a",
    gap: 4,
  },
  affinityEmoji: { fontSize: 14 },
  affinityName: { color: "#888", fontSize: 13, fontWeight: "600" },
  nativeDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
  castCount: { color: "#666", fontSize: 11, fontWeight: "bold", marginLeft: 2 },
  foreignNote: { color: "#888", fontSize: 12, textAlign: "center", paddingVertical: 6, fontStyle: "italic" },

  // Spell type group headers
  typeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
    gap: 6,
  },
  typeEmoji: { fontSize: 13 },
  typeLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  typeLine: { flex: 1, height: 1, backgroundColor: "#2a2a4a", marginLeft: 6 },

  // Active research card
  activeResearchCard: {
    backgroundColor: "#1a1a2e",
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  activeResearchHeader: { flexDirection: "row", alignItems: "flex-start" },
  activeResearchLabel: { color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  activeResearchName: { fontSize: 20, fontWeight: "bold", marginTop: 2 },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  infoBtnText: { color: "#888", fontSize: 18 },
  activeResearchProgress: { marginTop: 12 },
  activeProgressText: { color: "#888", fontSize: 12, marginBottom: 6 },
  researchBtn: { paddingVertical: 10, borderRadius: 8, alignItems: "center", marginTop: 12 },
  researchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // Completed
  completedCard: { margin: 12, padding: 24, alignItems: "center" },
  completedEmoji: { fontSize: 32, marginBottom: 8 },
  completedText: { color: "#2ecc71", fontSize: 15, fontWeight: "600" },

  // Section titles
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },

  // Learned cards
  learnedCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  learnedRow: { flexDirection: "row", alignItems: "center" },
  learnedName: { color: "#e0e0e0", fontSize: 15, fontWeight: "600" },
  learnedMeta: { color: "#666", fontSize: 11, marginTop: 2 },
  learnedCheck: { color: "#2ecc71", fontSize: 18, fontWeight: "bold" },

  // Locked cards
  lockedCard: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  lockedName: { color: "#666", fontSize: 15, fontWeight: "600" },
  lockedIcon: { fontSize: 16 },

  // Shared card styles for cast/active tabs
  card: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  spellHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  spellHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  spellName: { color: "#e0e0e0", fontSize: 16, fontWeight: "600", flex: 1 },
  meta: { color: "#888", fontSize: 12, marginTop: 4 },
  manaCost: { color: "#3498db", fontSize: 13 },
  infoBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnSmallText: { color: "#888", fontSize: 15 },
  progressBarBg: { height: 4, backgroundColor: "#333", borderRadius: 2, marginTop: 8 },
  progressBarFill: { height: 4, backgroundColor: "#7c5cbf", borderRadius: 2 },
  castButton: { backgroundColor: "#3498db", paddingVertical: 8, borderRadius: 6, alignItems: "center", marginTop: 10 },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  stackCount: { color: "#7c5cbf", fontSize: 16, fontWeight: "bold" },
  sustainedBadge: { color: "#2ecc71", fontSize: 12 },
  cancelButton: { borderWidth: 1, borderColor: "#e74c3c", paddingVertical: 6, borderRadius: 6, alignItems: "center", marginTop: 10 },
  cancelText: { color: "#e74c3c", fontSize: 13 },
  emptyText: { color: "#666", textAlign: "center", padding: 24, fontSize: 14 },

  // Slider modal styles
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
    marginBottom: 4,
    textAlign: "center",
  },
  modalSpellName: {
    fontSize: 15,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 12,
  },
  manaAvailable: {
    color: "#7c5cbf",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  manaProgress: { marginBottom: 16 },
  manaProgressText: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 6,
  },
  manaProgressBarBg: { height: 6, backgroundColor: "#333", borderRadius: 3 },
  manaProgressBarFill: { height: 6, backgroundColor: "#7c5cbf", borderRadius: 3 },
  investLabel: {
    color: "#e0e0e0",
    fontSize: 20,
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
  learnNote: {
    color: "#2ecc71",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "600",
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
    backgroundColor: "#7c5cbf",
    alignItems: "center",
  },
  modalConfirmTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Info modal styles
  infoAffinity: { fontSize: 13, textAlign: "center", marginBottom: 12 },
  infoDescription: { color: "#ccc", fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 12 },
  infoDivider: { height: 1, backgroundColor: "#2a2a4a", marginBottom: 12 },
  infoDetail: { color: "#888", fontSize: 13, marginBottom: 4 },
  infoCloseBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a40",
    alignItems: "center",
  },
  infoCloseTxt: { color: "#aaa", fontWeight: "600", fontSize: 14 },

  // Cast modal styles
  castModalDesc: { color: "#888", fontSize: 12, textAlign: "center", marginBottom: 12, lineHeight: 18 },
  effectPreview: {
    backgroundColor: "#0f0f1a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  effectPreviewLabel: { color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  effectPreviewValue: { color: "#3498db", fontSize: 18, fontWeight: "bold" },
  effectPreviewBonus: { color: "#666", fontSize: 11, marginTop: 4 },
});
