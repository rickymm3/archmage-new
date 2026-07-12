import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import LoadingButton from "../components/LoadingButton";
import { LoadingState } from "../components/ui";
import { colors, alpha } from "../theme";
import { ui as art, structureImage } from "../assets";

const { width: RAW_W } = Dimensions.get("window");
const MAP_W = Platform.OS === "web" ? Math.min(RAW_W, 480) : RAW_W;

/* ================================================================
   VISUAL CONFIG — position on the map + tiered "growing" artwork.
   `tiers` holds emoji for [small, medium, large]; a structure swaps to
   a bigger tier as it levels up. Real sprites drop in here later.
   `pos` is a percentage coordinate within the map canvas.
   ================================================================ */
const STRUCTURES = {
  town_center: { color: colors.gold,    pos: { x: 50, y: 44 }, tiers: ["\u{1F3D5}️", "\u{1F3D8}️", "\u{1F3F0}"] },
  barracks:    { color: colors.danger,  pos: { x: 25, y: 28 }, tiers: ["⛺", "⚔️", "\u{1F3F0}"] },
  bank:        { color: colors.warning, pos: { x: 76, y: 26 }, tiers: ["\u{1F3E0}", "\u{1F3E6}", "\u{1F3DB}️"] },
  mana_core:   { color: colors.info,    pos: { x: 80, y: 60 }, tiers: ["\u{1F52E}", "\u{1F48E}", "\u{1F531}"] },
  altar:       { color: colors.arcane,  pos: { x: 21, y: 62 }, tiers: ["\u{1F56F}️", "⛩️", "\u{1F5FF}"] },
  farm:        { color: colors.success, pos: { x: 52, y: 80 }, tiers: ["\u{1F331}", "\u{1F33E}", "\u{1F69C}"] },
  field_camp:  { color: colors.warning, pos: { x: 13, y: 47 }, tiers: ["⛺", "\u{1F3D5}️", "\u{1F6D6}"] },
};

const RES_ICON = {
  gold: "\u{1F4B0}",
  mana: "\u{1F52E}",
  food: "\u{1F356}",
  army_capacity: "\u{1F465}",
};

function cfgFor(slug) {
  return STRUCTURES[slug] || { color: colors.accent, pos: { x: 50, y: 50 }, tiers: ["\u{1F3D7}️"] };
}

// Growth tier (0..2) from level (level-based) or quantity (quantity-based).
function tierOf(s) {
  const us = s.user_structure;
  if (s.level_based) {
    const lvl = us?.level || 0;
    return lvl >= 7 ? 2 : lvl >= 4 ? 1 : 0;
  }
  const qty = us?.quantity || 0;
  return qty >= 10 ? 2 : qty >= 5 ? 1 : 0;
}

function isOwned(s) {
  const us = s.user_structure;
  if (!us) return false;
  return s.level_based ? us.level > 0 : (us.quantity || 0) > 0;
}

/* ================================================================
   BURNING OVERLAY — animated flames on a razed structure.
   ================================================================ */
function Flames({ size }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(a, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <Animated.Text style={[styles.flame, { fontSize: size, opacity, transform: [{ scale }] }]}>
      {"\u{1F525}"}
    </Animated.Text>
  );
}

/* ================================================================
   STRUCTURE TILE — one building placed on the map.
   ================================================================ */
function StructureTile({ s, selected, onPress }) {
  const cfg = cfgFor(s.slug);
  const owned = isOwned(s);
  const tier = tierOf(s);
  const scale = [1, 1.16, 1.34][tier];
  const size = 54 * scale;
  const us = s.user_structure;
  const burning = !!us?.burning;

  const emoji = cfg.tiers[Math.min(tier, cfg.tiers.length - 1)];
  const img = structureImage(s.slug, tier);
  const badge = s.level_based
    ? (us?.level > 0 ? `L${us.level}` : "")
    : (us?.quantity > 0 ? `×${us.quantity}` : "");

  // Frame upgrades with tier: faint → solid → gold, and thickens.
  const frameColor = burning ? colors.danger : [alpha(cfg.color, "66"), cfg.color, colors.gold][tier];
  const frameWidth = [1.5, 2, 2.5][tier];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(s)}
      style={[
        styles.tile,
        {
          left: `${cfg.pos.x}%`,
          top: `${cfg.pos.y}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
      ]}
    >
      {/* platform / plot */}
      <View
        style={[
          styles.plot,
          {
            width: size,
            height: size,
            borderRadius: size / 4,
            borderColor: frameColor,
            borderWidth: frameWidth,
            borderStyle: owned ? "solid" : "dashed",
            backgroundColor: owned ? alpha(cfg.color, "1f") : alpha(colors.card, "cc"),
          },
          selected && styles.plotSelected,
          burning && styles.plotBurning,
        ]}
      >
        {img ? (
          <Image
            source={img}
            resizeMode="contain"
            style={{ width: size * 0.82, height: size * 0.82, opacity: owned ? 1 : 0.4 }}
          />
        ) : (
          <Text style={[styles.tileEmoji, { fontSize: 26 * scale, opacity: owned ? 1 : 0.4 }]}>
            {owned ? emoji : cfg.tiers[0]}
          </Text>
        )}
        {!owned && <Text style={styles.plusMark}>+</Text>}
      </View>

      {/* level / quantity badge */}
      {badge !== "" && !burning && (
        <View style={[styles.tileBadge, { backgroundColor: tier === 2 ? colors.gold : cfg.color }]}>
          <Text style={styles.tileBadgeTxt}>{badge}</Text>
        </View>
      )}

      {/* burning overlay */}
      {burning && (
        <>
          <Flames size={22 * scale} />
          <View style={styles.alertDot}>
            <Text style={styles.alertDotTxt}>!</Text>
          </View>
        </>
      )}

      <Text style={styles.tileLabel} numberOfLines={1}>
        {s.name}
      </Text>
    </TouchableOpacity>
  );
}

/* ================================================================
   TOWN MAP — the canvas everything sits on.
   ================================================================ */
function TownMap({ structures, selectedSlug, onSelect }) {
  const burningCount = structures.filter((s) => s.user_structure?.burning).length;
  return (
    <View style={styles.map}>
      {/* painted panorama backdrop, with colored bands as fallback */}
      <View style={styles.mapSky} />
      <View style={styles.mapGround} />
      {art.townPanorama ? (
        <Image source={art.townPanorama} resizeMode="cover" style={StyleSheet.absoluteFill} />
      ) : null}

      <View style={styles.mapTitleWrap}>
        <Text style={styles.mapTitle}>{"\u{1F5FA}️"} Your Kingdom</Text>
        {burningCount > 0 && (
          <View style={styles.mapAlert}>
            <Text style={styles.mapAlertTxt}>{"\u{1F525}"} {burningCount} under attack</Text>
          </View>
        )}
      </View>

      {structures.map((s) => (
        <StructureTile
          key={s.slug}
          s={s}
          selected={selectedSlug === s.slug}
          onPress={() => onSelect(s.slug)}
        />
      ))}
    </View>
  );
}

/* ================================================================
   DETAIL PANEL — build / upgrade / downgrade the selected structure.
   ================================================================ */
function DetailPanel({ s, gold, mana, freeLand, onBuild, onDemolish }) {
  const { showAlert } = useModal();
  const cfg = cfgFor(s.slug);
  const us = s.user_structure;
  const lvl = us ? us.level : 0;
  const qty = us ? us.quantity : 0;
  const owned = isOwned(s);
  const tier = tierOf(s);

  const costs = s.resource_cost || {};
  const atMaxLevel = s.level_based && lvl >= s.max_level;
  const tcGated = !!s.tc_required;
  const canAfford =
    (!costs.gold || gold >= costs.gold) &&
    (!costs.mana || mana >= costs.mana) &&
    (!s.land_cost || freeLand >= s.land_cost);
  const canBuild = canAfford && !atMaxLevel && !tcGated;

  const prodEntries = s.production ? Object.entries(s.production) : [];

  const buildLabel = s.level_based ? (lvl > 0 ? "⬆ Upgrade" : "\u{1F528} Build") : "\u{1F528} Build";

  const showRequirements = () => {
    const lines = [];
    if (tcGated) lines.push(`\u{1F3DB}️ Town Center must be level ${s.tc_required} first`);
    Object.entries(costs).forEach(([k, v]) => {
      const have = k === "gold" ? gold : k === "mana" ? mana : 0;
      lines.push(`${RES_ICON[k] || k} ${Number(v).toLocaleString()} needed (have ${Number(have).toLocaleString()})`);
    });
    if (s.land_cost > 0) lines.push(`\u{1F3D4}️ ${s.land_cost} land needed (${freeLand} free)`);
    showAlert("Requirements", lines.join("\n"));
  };

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
      <View style={styles.panelHeader}>
        <View style={[styles.panelIconWrap, { borderColor: cfg.color }]}>
          {structureImage(s.slug, tier) ? (
            <Image source={structureImage(s.slug, tier)} resizeMode="contain" style={styles.panelIconImg} />
          ) : (
            <Text style={styles.panelIcon}>{cfg.tiers[Math.min(tier, cfg.tiers.length - 1)]}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelName}>{s.name}</Text>
          <Text style={styles.panelSub}>
            {s.level_based ? `Level ${lvl} / ${s.max_level}` : `Owned: ${qty}`}
            {owned ? `  ·  Tier ${tier + 1}` : "  ·  Not built"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => showAlert(s.name, s.description || "No description.")} style={styles.panelInfoBtn}>
          <Text style={styles.panelInfoTxt}>{"ℹ️"}</Text>
        </TouchableOpacity>
      </View>

      {s.description ? <Text style={styles.panelDesc}>{s.description}</Text> : null}

      {prodEntries.length > 0 && (
        <View style={styles.chipRow}>
          {prodEntries.map(([k, v]) => (
            <View key={k} style={styles.prodChip}>
              <Text style={styles.prodChipTxt}>{RES_ICON[k] || ""} +{v}{owned && s.level_based ? `/lvl` : ""}</Text>
            </View>
          ))}
        </View>
      )}

      {!atMaxLevel && (
        <View style={styles.chipRow}>
          <Text style={styles.costLabel}>{lvl > 0 ? "Next level:" : "Cost:"}</Text>
          {costs.gold > 0 && (
            <Text style={[styles.costChip, gold < costs.gold && styles.costShort]}>{"\u{1F4B0}"} {Number(costs.gold).toLocaleString()}</Text>
          )}
          {costs.mana > 0 && (
            <Text style={[styles.costChip, mana < costs.mana && styles.costShort]}>{"\u{1F52E}"} {Number(costs.mana).toLocaleString()}</Text>
          )}
          {s.land_cost > 0 && (
            <Text style={[styles.costChip, freeLand < s.land_cost && styles.costShort]}>{"\u{1F3D4}️"} {s.land_cost}</Text>
          )}
        </View>
      )}

      <View style={styles.actionBar}>
        {owned && (
          <LoadingButton style={styles.demolishBtn} onPress={() => onDemolish(s)}>
            <Text style={styles.demolishTxt}>{s.level_based ? "⬇ Downgrade" : "\u{1F5D1} Demolish"}</Text>
          </LoadingButton>
        )}

        {atMaxLevel ? (
          <View style={[styles.buildBtn, { backgroundColor: colors.border }]}>
            <Text style={[styles.buildTxt, { opacity: 0.4 }]}>Max Level</Text>
          </View>
        ) : canBuild ? (
          <LoadingButton style={[styles.buildBtn, { backgroundColor: cfg.color }]} onPress={() => onBuild(s)}>
            <Text style={styles.buildTxt}>{buildLabel}</Text>
          </LoadingButton>
        ) : (
          <TouchableOpacity style={[styles.buildBtn, { backgroundColor: colors.border }]} onPress={showRequirements}>
            <Text style={[styles.buildTxt, { opacity: 0.5 }]}>{tcGated ? "\u{1F512} Locked" : buildLabel}</Text>
            <Text style={styles.reqInfo}>{"ℹ"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

/* ================================================================
   IDLE PANEL — shown when nothing is selected.
   ================================================================ */
function IdlePanel({ hasFires }) {
  return (
    <View style={styles.idlePanel}>
      <Text style={styles.idleEmoji}>{hasFires ? "\u{1F525}" : "\u{1F447}"}</Text>
      <Text style={styles.idleText}>
        {hasFires
          ? "One of your buildings is on fire! Tap it to see what happened."
          : "Tap a building on the map to build, upgrade, or manage it."}
      </Text>
    </View>
  );
}

/* ================================================================
   DAMAGE MODAL — acknowledge a razed building and put out the fire.
   ================================================================ */
function DamageModal({ s, onExtinguish, onClose, busy }) {
  const info = s?.user_structure?.damage_info || {};
  const cfg = cfgFor(s?.slug);
  const amount = info.amount || 1;
  const lostText =
    info.kind === "level"
      ? `${amount} ${amount === 1 ? "level" : "levels"}`
      : `${amount} ${amount === 1 ? "building" : "buildings"}`;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Flames size={40} />
          <Text style={styles.modalTitle}>{cfg.tiers[0]} {s?.name} Razed!</Text>
          <Text style={styles.modalBody}>
            You lost <Text style={styles.modalEmph}>{lostText}</Text> of this building in the
            attack by <Text style={styles.modalEmph}>{info.attacker_name || "an unknown raider"}</Text>.
          </Text>
          <Text style={styles.modalNote}>The damage is done — put out the fire to restore order.</Text>

          <LoadingButton style={styles.extinguishBtn} onPress={onExtinguish} disabled={busy}>
            <Text style={styles.extinguishTxt}>{"\u{1F692}"} Put Out the Fire</Text>
          </LoadingButton>
          <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
            <Text style={styles.laterTxt}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  const [selected, setSelected] = useState(null); // slug for detail panel
  const [damageSlug, setDamageSlug] = useState(null); // slug for fire modal
  const [extinguishing, setExtinguishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getTown();
      setStructures(res.structures || []);
      setGold(res.gold ?? 0);
      setMana(res.mana ?? 0);
      setFreeLand(res.free_land ?? 0);
      setTotalLand(res.land ?? 0);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSelect = (slug) => {
    const s = structures.find((x) => x.slug === slug);
    // Burning buildings open the damage modal instead of the detail panel.
    if (s?.user_structure?.burning) {
      setDamageSlug(slug);
    } else {
      setSelected((prev) => (prev === slug ? null : slug));
    }
  };

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
    const confirmed = await showConfirm(
      title,
      s.level_based ? `Downgrade ${s.name} by one level?` : `Destroy one ${s.name}?`,
      { confirmText: title, destructive: true }
    );
    if (!confirmed) return;
    try {
      await api.demolishStructure(s.id);
      await load();
    } catch (e) {
      showAlert("Error", e.message);
    }
  };

  const handleExtinguish = async () => {
    const s = structures.find((x) => x.slug === damageSlug);
    if (!s) return;
    setExtinguishing(true);
    try {
      await api.extinguishStructure(s.id);
      setDamageSlug(null);
      await load();
    } catch (e) {
      showAlert("Error", e.message);
    } finally {
      setExtinguishing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const selStruct = selected ? structures.find((s) => s.slug === selected) : null;
  const damageStruct = damageSlug ? structures.find((s) => s.slug === damageSlug) : null;
  const hasFires = structures.some((s) => s.user_structure?.burning);

  return (
    <SafeAreaView style={styles.container}>
      <TownMap structures={structures} selectedSlug={selected} onSelect={handleSelect} />

      {/* stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F4B0}"}</Text>
          <Text style={[styles.statValue, { color: colors.gold }]}>{Number(gold).toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F52E}"}</Text>
          <Text style={[styles.statValue, { color: colors.info }]}>{Number(mana).toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>{"\u{1F3D4}️"}</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>{freeLand}</Text>
          <Text style={styles.statLabel}>/ {totalLand} free</Text>
        </View>
      </View>

      {/* detail / idle panel */}
      {selStruct ? (
        <DetailPanel
          s={selStruct}
          gold={gold}
          mana={mana}
          freeLand={freeLand}
          onBuild={handleBuild}
          onDemolish={handleDemolish}
        />
      ) : (
        <IdlePanel hasFires={hasFires} />
      )}

      {/* fire acknowledgment */}
      {damageStruct && (
        <DamageModal
          s={damageStruct}
          busy={extinguishing}
          onExtinguish={handleExtinguish}
          onClose={() => setDamageSlug(null)}
        />
      )}
    </SafeAreaView>
  );
}

/* ================================================================
   STYLES
   ================================================================ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {}),
  },

  /* ── map ── */
  map: {
    height: "46%",
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapSky: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "45%",
    backgroundColor: alpha(colors.info, "14"),
  },
  mapGround: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "60%",
    backgroundColor: alpha(colors.success, "12"),
    borderTopWidth: 1,
    borderTopColor: alpha(colors.success, "22"),
  },
  mapArtTag: {
    position: "absolute",
    top: 8, right: 10,
    color: alpha(colors.accent, "88"),
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  mapTitleWrap: {
    position: "absolute",
    top: 10, left: 12,
    zIndex: 5,
  },
  mapTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mapAlert: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: alpha(colors.danger, "22"),
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mapAlertTxt: { color: colors.danger, fontSize: 11, fontWeight: "700" },

  /* ── tile ── */
  tile: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  plot: {
    alignItems: "center",
    justifyContent: "center",
  },
  plotSelected: {
    borderColor: colors.white,
    shadowColor: colors.white,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  plotBurning: {
    backgroundColor: alpha(colors.danger, "26"),
  },
  tileEmoji: { textAlign: "center" },
  plusMark: {
    position: "absolute",
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700",
    bottom: 2,
    right: 4,
  },
  tileBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: "center",
  },
  tileBadgeTxt: { color: colors.white, fontSize: 10, fontWeight: "800" },
  flame: {
    position: "absolute",
    bottom: -2,
    textAlign: "center",
  },
  alertDot: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  alertDotTxt: { color: colors.white, fontSize: 12, fontWeight: "900" },
  tileLabel: {
    position: "absolute",
    bottom: -16,
    fontSize: 9,
    color: colors.textDim,
    textAlign: "center",
    width: 80,
  },

  /* ── stats bar ── */
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 14,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statIcon: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 11, color: colors.muted },
  statDivider: { width: 1, height: 16, backgroundColor: colors.border },

  /* ── detail panel ── */
  panel: { flex: 1 },
  panelContent: { padding: 14, paddingBottom: 28 },
  panelHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  panelIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: colors.card,
  },
  panelIcon: { fontSize: 26 },
  panelIconImg: { width: 44, height: 44 },
  panelName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  panelSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  panelInfoBtn: { padding: 6 },
  panelInfoTxt: { fontSize: 18 },
  panelDesc: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  chipRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  costLabel: { color: colors.muted, fontSize: 12 },
  prodChip: {
    backgroundColor: alpha(colors.success, "1f"),
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  prodChipTxt: { color: colors.success, fontSize: 13, fontWeight: "600" },
  costChip: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  costShort: { color: colors.danger },
  actionBar: { flexDirection: "row", gap: 8, marginTop: 6 },
  demolishBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: alpha(colors.danger, "26"),
    borderWidth: 1,
    borderColor: alpha(colors.danger, "55"),
    justifyContent: "center",
  },
  demolishTxt: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  buildBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  buildTxt: { color: colors.white, fontWeight: "800", fontSize: 15, textTransform: "uppercase", letterSpacing: 1 },
  reqInfo: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    backgroundColor: alpha(colors.white, "33"),
    overflow: "hidden",
  },

  /* ── idle panel ── */
  idlePanel: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  idleEmoji: { fontSize: 34, marginBottom: 10 },
  idleText: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  /* ── damage modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: alpha(colors.black, "cc"),
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 22,
    alignItems: "center",
  },
  modalTitle: {
    color: colors.danger,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  modalBody: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: "center" },
  modalEmph: { color: colors.gold, fontWeight: "700" },
  modalNote: { color: colors.muted, fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 10, marginBottom: 16 },
  extinguishBtn: {
    backgroundColor: colors.info,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "stretch",
  },
  extinguishTxt: { color: colors.white, fontSize: 15, fontWeight: "800" },
  laterBtn: { paddingVertical: 10, marginTop: 4 },
  laterTxt: { color: colors.muted, fontSize: 13 },
});
