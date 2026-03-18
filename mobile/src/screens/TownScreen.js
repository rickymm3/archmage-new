import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";

const { width: W } = Dimensions.get("window");

/* ── visual config per structure slug ── */
const VISUALS = {
  town_center: { icon: "\u{1F3DB}\uFE0F", color: "#f1c40f", bg: "#3d3520" },
  barracks:    { icon: "\u2694\uFE0F",     color: "#e74c3c", bg: "#3d2020" },
  bank:        { icon: "\u{1F3E6}",        color: "#f39c12", bg: "#3d3020" },
  mana_core:   { icon: "\u{1F48E}",        color: "#3498db", bg: "#1a2a3d" },
  altar:       { icon: "\u{1F56F}\uFE0F",  color: "#9b59b6", bg: "#2d1a3d" },
  farm:        { icon: "\u{1F33E}",        color: "#2ecc71", bg: "#1a3d20" },
  field_camp:  { icon: "\u26FA",           color: "#e67e22", bg: "#3d2a1a" },
};
const RES_ICON = {
  gold: "\u{1F4B0}",
  mana: "\u{1F52E}",
  food: "\u{1F356}",
  army_capacity: "\u{1F465}",
};

function vis(slug) {
  return VISUALS[slug] || { icon: "\u{1F3D7}\uFE0F", color: "#7c5cbf", bg: "#2a1a3d" };
}

/* ================================================================
   TOP PANEL – overview (no structure selected)
   ================================================================ */
function TownOverview() {
  return (
    <View style={styles.panelContent}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.placeholderEmoji}>{"\u{1F3F0}"}</Text>
      </View>
      <View style={styles.overlayBottom}>
        <Text style={styles.panelTitle}>Your Kingdom</Text>
      </View>
    </View>
  );
}

/* ================================================================
   TOP PANEL – structure detail
   ================================================================ */
function StructureDetail({ s, gold, mana, freeLand, onClose, onBuild, onDemolish }) {
  const { showAlert } = useModal();
  const v = vis(s.slug);
  const us = s.user_structure;
  const lvl = us ? us.level : 0;
  const qty = us ? us.quantity : 0;
  const owned = s.level_based ? lvl > 0 : qty > 0;

  const costs = s.resource_cost || {};
  const atMaxLevel = s.level_based && lvl >= s.max_level;
  const tcGated = !!s.tc_required;
  const canAfford =
    (!costs.gold || gold >= costs.gold) &&
    (!costs.mana || mana >= costs.mana) &&
    (!s.land_cost || freeLand >= s.land_cost);
  const canBuild = canAfford && !atMaxLevel && !tcGated;

  const showRequirements = () => {
    const lines = [];
    if (tcGated)
      lines.push(`\u{1F3DB}\uFE0F Town Center must be level ${s.tc_required} first`);
    Object.entries(costs).forEach(([k, v2]) => {
      const have = k === "gold" ? gold : k === "mana" ? mana : 0;
      const icon = RES_ICON[k] || k;
      lines.push(`${icon} ${Number(v2).toLocaleString()} needed (have ${Number(have).toLocaleString()})`);
    });
    if (s.land_cost > 0)
      lines.push(`\u{1F3D4}\uFE0F ${s.land_cost} land needed (${freeLand} free)`);
    showAlert("Upgrade Requirements", lines.join("\n"));
  };

  const showDescription = () => {
    showAlert(s.name, s.description || "No description available.");
  };

  const prodEntries = s.production ? Object.entries(s.production) : [];

  return (
    <View style={[styles.panelContent, { backgroundColor: v.bg }]}>
      {/* Image placeholder */}
      <View style={styles.imagePlaceholder}>
        <Text style={styles.placeholderEmoji}>{v.icon}</Text>
      </View>

      {/* Top bar: close + info */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeTxt}>{"\u2715"}</Text>
      </TouchableOpacity>

      {s.description ? (
        <TouchableOpacity style={styles.infoBtn} onPress={showDescription}>
          <Text style={styles.infoBtnTxt}>{"\u2139\uFE0F"}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Overlay: name, level, production */}
      <View style={styles.overlayInfo}>
        <Text style={styles.detailName}>{s.name}</Text>
        {s.level_based ? (
          <Text style={styles.detailSub}>Level {lvl} / {s.max_level}</Text>
        ) : (
          <Text style={styles.detailSub}>Owned: {qty}</Text>
        )}
        {prodEntries.length > 0 && (
          <View style={styles.prodRow}>
            {prodEntries.map(([k, v2]) => (
              <View key={k} style={styles.prodChip}>
                <Text style={styles.prodChipTxt}>{RES_ICON[k] || ""} +{v2}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Fixed bottom action bar */}
      <View style={styles.actionBar}>
        {owned && (
          <TouchableOpacity
            style={styles.demolishBtn}
            onPress={() => onDemolish(s)}
            activeOpacity={0.6}
          >
            <Text style={styles.demolishBtnTxt}>
              {s.level_based ? "\u2B07 Downgrade" : "\u{1F5D1} Demolish"}
            </Text>
          </TouchableOpacity>
        )}

        {!atMaxLevel ? (
          canBuild ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: v.color, flex: 1 }]}
              onPress={() => onBuild(s)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnTxt}>
                {s.level_based ? (lvl > 0 ? "\u2B06 Upgrade" : "\u{1F528} Build") : "\u{1F528} Build"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, { backgroundColor: "#444", flex: 1 }]}>
              <Text style={[styles.actionBtnTxt, { opacity: 0.4 }]}>
                {tcGated ? "\u{1F512} Locked" : s.level_based ? (lvl > 0 ? "\u2B06 Upgrade" : "\u{1F528} Build") : "\u{1F528} Build"}
              </Text>
              <TouchableOpacity onPress={showRequirements} style={styles.reqInfoBtn}>
                <Text style={styles.reqInfoTxt}>{"\u2139"}</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={[styles.actionBtn, { backgroundColor: "#333", flex: 1 }]}>
            <Text style={[styles.actionBtnTxt, { opacity: 0.3 }]}>Max Level</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ================================================================
   BUILDING CARD (bottom grid)
   ================================================================ */
function BuildingCard({ s, onPress }) {
  const v = vis(s.slug);
  const us = s.user_structure;
  const lvl = us ? us.level : 0;
  const qty = us ? us.quantity : 0;
  const badge = s.level_based ? (lvl > 0 ? `L${lvl}` : "") : qty > 0 ? `x${qty}` : "";

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: v.color + "55" }]}
      activeOpacity={0.7}
      onPress={() => onPress(s)}
    >
      <Text style={styles.cardIcon}>{v.icon}</Text>
      {badge !== "" && (
        <View style={[styles.badge, { backgroundColor: v.color }]}>
          <Text style={styles.badgeTxt}>{badge}</Text>
        </View>
      )}
      <Text style={styles.cardLabel} numberOfLines={1}>
        {s.name}
      </Text>
    </TouchableOpacity>
  );
}

/* ================================================================
   MAIN SCREEN
   ================================================================ */
export default function TownScreen() {
  const { showAlert, showConfirm } = useModal();
  const [structures, setStructures] = useState([]);
  const [gold, setGold] = useState(0);
  const [mana, setMana] = useState(0);
  const [freeLand, setFreeLand] = useState(0);
  const [totalLand, setTotalLand] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // slug or null

  const load = useCallback(async () => {
    try {
      const res = await api.getTown();
      setStructures(res.structures || []);
      setGold(res.gold ?? 0);
      setMana(res.mana ?? 0);
      setFreeLand(res.free_land ?? 0);
      setTotalLand(res.land ?? 0);
    } catch (e) {
      showAlert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleBuild = async (s) => {
    try {
      await api.buildStructure(s.id);
      await load();
    } catch (e) {
      showAlert("Build failed", e.message);
    }
  };

  const handleDemolish = async (s) => {
    const title = s.level_based ? "Downgrade" : "Demolish";
    const message = s.level_based
      ? `Downgrade ${s.name} by one level?`
      : `Destroy one ${s.name}?`;
    const confirmed = await showConfirm(title, message, { confirmText: title, destructive: true });
    if (!confirmed) return;
    try {
      await api.demolishStructure(s.id);
      setSelected(null);
      await load();
    } catch (e) {
      showAlert("Error", e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#7c5cbf" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const selStruct = selected
    ? structures.find((s) => s.slug === selected)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── TOP PANEL ── */}
      <View style={styles.topPanel}>
        {selStruct ? (
          <StructureDetail
            s={selStruct}
            gold={gold}
            mana={mana}
            freeLand={freeLand}
            onClose={() => setSelected(null)}
            onBuild={handleBuild}
            onDemolish={handleDemolish}
          />
        ) : (
          <TownOverview />
        )}
      </View>

      {/* ── STATS BAR ── */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F4B0}"}</Text>
          <Text style={[styles.statValue, { color: "#f1c40f" }]}>{Number(gold).toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F52E}"}</Text>
          <Text style={[styles.statValue, { color: "#3498db" }]}>{Number(mana).toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F3D4}\uFE0F"}</Text>
          <Text style={[styles.statValue, { color: "#2ecc71" }]}>{freeLand}</Text>
          <Text style={styles.statLabel}>/ {totalLand}</Text>
        </View>
      </View>

      {/* ── BOTTOM GRID ── */}
      <View style={styles.bottomGrid}>
        <View style={styles.gridRow}>
          {structures.map((s) => (
            <BuildingCard
              key={s.slug}
              s={s}
              onPress={(s) => setSelected(s.slug)}
            />
          ))}
        </View>
      </View>


    </SafeAreaView>
  );
}

/* ================================================================
   STYLES
   ================================================================ */
const CARD_SIZE = (W - 48) / 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a" },

  /* ── top panel ── */
  topPanel: {
    flex: 55,
    backgroundColor: "#161625",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a40",
  },
  panelContent: {
    flex: 1,
    width: "100%",
    backgroundColor: "#1a1a2e",
  },

  /* ── image placeholder ── */
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 80,
    opacity: 0.25,
  },

  /* ── overview overlay ── */
  overlayBottom: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e2e2f0",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ── structure detail overlays ── */
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 10,
    padding: 6,
    backgroundColor: "#00000066",
    borderRadius: 16,
  },
  closeTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  infoBtn: {
    position: "absolute",
    top: 12,
    left: 14,
    zIndex: 10,
    padding: 6,
    backgroundColor: "#00000066",
    borderRadius: 16,
  },
  infoBtnTxt: { fontSize: 18 },

  overlayInfo: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  detailName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  detailSub: {
    fontSize: 14,
    color: "#ddd",
    marginTop: 2,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  prodRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  prodChip: {
    backgroundColor: "#00000066",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  prodChipTxt: { color: "#2ecc71", fontSize: 13, fontWeight: "600" },

  /* ── action bar (fixed bottom of top panel) ── */
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0d0d1acc",
    borderTopWidth: 1,
    borderTopColor: "#2a2a40",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnTxt: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  demolishBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#c0392b33",
    borderWidth: 1,
    borderColor: "#c0392b55",
    justifyContent: "center",
  },
  demolishBtnTxt: {
    color: "#e74c3c",
    fontSize: 13,
    fontWeight: "600",
  },
  reqInfoBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff33",
    alignItems: "center",
    justifyContent: "center",
  },
  reqInfoTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  /* ── stats bar ── */
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12121f",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a40",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statIcon: { fontSize: 14 },
  statValue: { fontSize: 13, fontWeight: "700" },
  statLabel: { fontSize: 11, color: "#888" },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#333",
  },

  /* ── bottom grid ── */
  bottomGrid: {
    flex: 45,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIcon: { fontSize: 28, marginBottom: 4 },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardLabel: { fontSize: 10, color: "#ccc", textAlign: "center" },
});
