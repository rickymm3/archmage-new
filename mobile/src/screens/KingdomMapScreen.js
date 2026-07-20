// ═══════════════════════════════════════════════════════════════════
// VILLAGE GRID — buildable kingdom map (replaces the painted-art map).
//
// Clash-style placement over the existing economy — no new resources or
// structures, the grid just makes the land system spatial:
//   · 1 land = 1 tile. The map is a square of side ceil(√land); tiles
//     beyond your land count render as unbuildable "wilds" forest.
//   · Footprints are PREFIXED tetris-style polyomino shapes. Level-based
//     structures (keep/barracks/bank/core/altar) are singletons whose
//     shape grows with tier; quantity-based ones (farm/field camp) place
//     one shape PER unit owned — build 8 farms, place 8 strips.
//   · Shapes rotate in 90° steps while placing/moving (⟳).
//   · Moving is always free. Losing land never destroys a building: what
//     no longer fits is auto-relocated or lands in the "displaced" tray.
//   · Tapping a building shows its info and opens its game function
//     (bank → collect tax, mana core → release mana, barracks → recruit).
//
// Layout ({ instanceId: {x, y, rot} }) persists via services/mapLayout.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import { TabBarVisual, TAB_NAMES } from "../navigation/CustomTabBar";
import { LoadingState } from "../components/ui";
import { loadMapLayout, saveMapLayout } from "../services/mapLayout";
import { structureImage } from "../assets";
import { colors, alpha } from "../theme";

const { width: INITIAL_W, height: INITIAL_H } = Dimensions.get("window");

// Space reserved for the transparent universal header above / tab dock below.
const TOP_OFFSET = Platform.OS === "web" ? 84 : 122;
const BOTTOM_DOCK = 120;

/* ── shapes ───────────────────────────────────────────────────────── */

const R = (w, h) => {
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  return cells;
};
const L4 = [[0, 0], [0, 1], [0, 2], [1, 2]]; // L tetromino (4)
const T4 = [[0, 0], [1, 0], [2, 0], [1, 1]]; // T tetromino (4)
const PLUS5 = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]; // plus pentomino (5)
const RING12 = R(4, 4).filter(([x, y]) => !((x === 0 || x === 3) && (y === 0 || y === 3)));

// Level-based: shape per growth tier (levels 1-3 / 4-6 / 7+).
// Quantity-based: ONE shape — every unit owned places another copy.
const SHAPES = {
  town_center: [R(2, 2), R(3, 3), R(4, 4)],
  barracks: [L4, R(2, 3), R(3, 3)],
  bank: [T4, R(2, 3), R(3, 3)],
  mana_core: [PLUS5, R(3, 3), RING12],
  altar: [R(1, 2), T4, PLUS5],
  // One tile per unit owned — the sprawl of many small plots IS the farm
  // district; shapes stay reserved for the big singleton structures.
  farm: [R(1, 1)],
  field_camp: [R(1, 1)],
};

function rotateCells(cells, rot) {
  let out = cells;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
    // 90° clockwise, then normalize back to origin.
    const rotated = out.map(([x, y]) => [-y, x]);
    const minX = Math.min(...rotated.map(([x]) => x));
    const minY = Math.min(...rotated.map(([, y]) => y));
    out = rotated.map(([x, y]) => [x - minX, y - minY]);
  }
  return out;
}

const boundsOf = (cells) => ({
  w: Math.max(...cells.map(([x]) => x)) + 1,
  h: Math.max(...cells.map(([, y]) => y)) + 1,
});

/* ── structure config ─────────────────────────────────────────────── */

const STRUCT_META = {
  town_center: { color: colors.gold, emoji: "🏰" },
  barracks: { color: colors.danger, emoji: "⚔️" },
  bank: { color: colors.warning, emoji: "🏦" },
  mana_core: { color: colors.info, emoji: "🔮" },
  altar: { color: colors.arcane, emoji: "⛩️" },
  farm: { color: colors.success, emoji: "🌾" },
  field_camp: { color: colors.warning, emoji: "⛺" },
};

const OPEN_NAV = {
  town_center: { nav: ["Kingdom", { subTab: "town_center" }], label: "🏰 Govern" },
  barracks: { nav: ["Army", { subTab: "recruit" }], label: "📯 Recruit" },
  bank: { nav: ["Home", { subTab: "tax" }], label: "💰 Collect Tax" },
  mana_core: { nav: ["Home", { subTab: "mana" }], label: "🔮 Release Mana" },
  altar: { nav: ["Magic", { subTab: "research" }], label: "✨ Research" },
  farm: { nav: ["Kingdom", { subTab: "farm" }], label: "🌾 Manage" },
  field_camp: { nav: ["Army", { subTab: "defense" }], label: "🛡 Defense" },
};

const RES_ICON = { gold: "💰", mana: "🔮", food: "🍖", army_capacity: "👥" };

function tierOf(s) {
  const lvl = s.user_structure?.level || 0;
  return lvl >= 7 ? 2 : lvl >= 4 ? 1 : 0;
}

function shapeFor(s) {
  const set = SHAPES[s.slug] || [R(1, 1)];
  return s.level_based ? set[Math.min(tierOf(s), set.length - 1)] : set[0];
}

function isOwned(s) {
  const us = s.user_structure;
  if (!us) return false;
  return s.level_based ? us.level > 0 : (us.quantity || 0) > 0;
}

// Every placeable building on the map. Level-based structures are one
// instance; quantity-based get one per unit owned.
function instancesOf(structures) {
  const out = [];
  structures.forEach((s) => {
    if (s.level_based) {
      if (isOwned(s)) out.push({ id: s.slug, s });
    } else {
      const qty = s.user_structure?.quantity || 0;
      for (let i = 0; i < qty; i++) out.push({ id: `${s.slug}#${i}`, s });
    }
  });
  return out;
}

function productionText(s) {
  const entries = s.production ? Object.entries(s.production) : [];
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${RES_ICON[k] || k} +${v}${s.level_based ? "/lvl" : ""}`).join("  ");
}

/* ── grid math ────────────────────────────────────────────────────── */

const tileOwned = (r, c, side, land) => r * side + c < land;

function cellsFit(absCells, side, land, occupied, ignoreId) {
  return absCells.every(([c, r]) => {
    if (c < 0 || r < 0 || c >= side || r >= side) return false;
    if (!tileOwned(r, c, side, land)) return false;
    const holder = occupied[`${r}:${c}`];
    return !holder || holder === ignoreId;
  });
}

const absCellsOf = (shape, rot, x, y) => rotateCells(shape, rot).map(([cx, cy]) => [cx + x, cy + y]);

function occupancyOf(placements, byId) {
  const map = {};
  Object.entries(placements).forEach(([id, p]) => {
    const inst = byId[id];
    if (!inst) return;
    absCellsOf(shapeFor(inst.s), p.rot, p.x, p.y).forEach(([c, r]) => {
      map[`${r}:${c}`] = id;
    });
  });
  return map;
}

// Keep stored spots that still fit, auto-relocate the rest (biggest
// first, trying all four rotations), report the truly homeless.
function resolveLayout(instances, side, land, stored) {
  const byId = Object.fromEntries(instances.map((i) => [i.id, i]));
  const placements = {};
  const displaced = [];
  const ordered = [...instances].sort((a, b) => shapeFor(b.s).length - shapeFor(a.s).length);

  ordered.forEach(({ id, s }) => {
    const pos = stored?.[id];
    if (!pos) return;
    const rot = pos.rot || 0;
    const occ = occupancyOf(placements, byId);
    if (cellsFit(absCellsOf(shapeFor(s), rot, pos.x, pos.y), side, land, occ, null)) {
      placements[id] = { x: pos.x, y: pos.y, rot };
    }
  });
  ordered.forEach(({ id, s }) => {
    if (placements[id]) return;
    const shape = shapeFor(s);
    let found = null;
    for (let rot = 0; rot < 4 && !found; rot++) {
      const { w, h } = boundsOf(rotateCells(shape, rot));
      for (let y = 0; y <= side - h && !found; y++) {
        for (let x = 0; x <= side - w && !found; x++) {
          if (cellsFit(absCellsOf(shape, rot, x, y), side, land, occupancyOf(placements, byId), null)) {
            found = { x, y, rot };
          }
        }
      }
    }
    if (found) placements[id] = found;
    else displaced.push(id);
  });
  return { placements, displaced };
}

/* ── screen ───────────────────────────────────────────────────────── */

export default function KingdomMapScreen({ navigation }) {
  const { showAlert } = useModal();
  const [town, setTown] = useState(null);
  const [stored, setStored] = useState(null); // persisted {id: {x,y,rot}}
  const [viewSize, setViewSize] = useState({ w: INITIAL_W, h: INITIAL_H });
  const [selected, setSelected] = useState(null); // instance id
  const [moveMode, setMoveMode] = useState(null); // {id, slug, shape, rot, x, y, isNewBuild, structureId, prevQty}
  const [buildOpen, setBuildOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, layout] = await Promise.all([api.getTown(), loadMapLayout()]);
      setTown(res);
      setStored(layout?.positions || {});
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function go([tab, params]) {
    navigation.navigate("MainTabs", { screen: tab, params });
  }

  const structures = town?.structures || [];
  const land = Math.max(1, town?.land || 1);
  const freeLand = town?.free_land || 0;
  const side = Math.max(6, Math.ceil(Math.sqrt(land)));

  const instances = useMemo(() => instancesOf(structures), [town]);
  const byId = useMemo(() => Object.fromEntries(instances.map((i) => [i.id, i])), [instances]);

  const { placements, displaced } = useMemo(
    () => (town ? resolveLayout(instances, side, land, stored) : { placements: {}, displaced: [] }),
    [town, instances, side, land, stored]
  );

  async function persist(nextPositions) {
    setStored(nextPositions);
    await saveMapLayout({ positions: nextPositions });
  }

  /* geometry */
  const gridAreaW = viewSize.w - 14;
  const gridAreaH = viewSize.h - TOP_OFFSET - BOTTOM_DOCK - 56;
  const tile = Math.max(8, Math.floor(Math.min(gridAreaW / side, gridAreaH / side)));
  const gridPx = tile * side;
  const gridLeft = (viewSize.w - gridPx) / 2;

  /* interactions */

  // RN-web press events don't reliably carry locationX/locationY, so tile
  // coordinates come from pageX/pageY minus the grid's measured window
  // origin (which also handles DeviceFrame's offset on web).
  const gridRef = useRef(null);
  const gridOriginRef = useRef({ x: 0, y: 0 });
  const measureGrid = useCallback(() => {
    requestAnimationFrame(() => {
      gridRef.current?.measureInWindow?.((x, y) => {
        if (Number.isFinite(x) && Number.isFinite(y)) gridOriginRef.current = { x, y };
      });
    });
  }, []);

  function onGridPress(event) {
    const ne = event.nativeEvent;
    let lx = ne.locationX;
    let ly = ne.locationY;
    if (Platform.OS === "web" || !Number.isFinite(lx) || !Number.isFinite(ly)) {
      lx = ne.pageX - gridOriginRef.current.x;
      ly = ne.pageY - gridOriginRef.current.y;
    }
    const c = Math.floor(lx / tile);
    const r = Math.floor(ly / tile);
    if (c < 0 || r < 0 || c >= side || r >= side) return;
    if (moveMode) {
      const { w, h } = boundsOf(rotateCells(moveMode.shape, moveMode.rot));
      const x = Math.min(Math.max(c - Math.floor(w / 2), 0), side - w);
      const y = Math.min(Math.max(r - Math.floor(h / 2), 0), side - h);
      setMoveMode({ ...moveMode, x, y });
      return;
    }
    const occ = occupancyOf(placements, byId);
    setSelected(occ[`${r}:${c}`] || null);
  }

  function rotateGhost() {
    if (!moveMode) return;
    const rot = (moveMode.rot + 1) % 4;
    const { w, h } = boundsOf(rotateCells(moveMode.shape, rot));
    setMoveMode({
      ...moveMode,
      rot,
      x: Math.min(moveMode.x, side - w),
      y: Math.min(moveMode.y, side - h),
    });
  }

  function startMove(id) {
    const inst = byId[id];
    if (!inst) return;
    const p = placements[id] || { x: 0, y: 0, rot: 0 };
    setSelected(null);
    setMoveMode({ id, slug: inst.s.slug, shape: shapeFor(inst.s), rot: p.rot || 0, x: p.x, y: p.y, isNewBuild: false });
  }

  function startBuild(s) {
    setBuildOpen(false);
    const shape = s.level_based ? (SHAPES[s.slug] || [R(1, 1)])[0] : shapeFor(s);
    const prevQty = s.user_structure?.quantity || 0;
    const id = s.level_based ? s.slug : `${s.slug}#${prevQty}`;
    const { w, h } = boundsOf(shape);
    setMoveMode({
      id,
      slug: s.slug,
      shape,
      rot: 0,
      x: Math.max(0, Math.floor((side - w) / 2)),
      y: Math.max(0, Math.floor((side - h) / 2)),
      isNewBuild: true,
      structureId: s.id,
    });
  }

  const moveValid = moveMode
    ? cellsFit(
        absCellsOf(moveMode.shape, moveMode.rot, moveMode.x, moveMode.y),
        side,
        land,
        occupancyOf(placements, byId),
        moveMode.isNewBuild ? null : moveMode.id
      )
    : false;

  async function confirmMove() {
    if (!moveMode || !moveValid) return;
    const { id, x, y, rot, isNewBuild, structureId } = moveMode;
    if (isNewBuild) {
      try {
        await api.buildStructure(structureId);
      } catch (e) {
        showAlert("Can't Build", e.message);
        setMoveMode(null);
        return;
      }
    }
    await persist({ ...(stored || {}), [id]: { x, y, rot } });
    setMoveMode(null);
    if (isNewBuild) load();
  }

  /* render */

  if (!town) {
    return (
      <View style={styles.root}>
        <LoadingState />
      </View>
    );
  }

  const cells = [];
  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) {
      const ownedTile = tileOwned(r, c, side, land);
      const checker = (r + c) % 2 === 0;
      cells.push(
        <View
          key={`${r}:${c}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: c * tile,
            top: r * tile,
            width: tile,
            height: tile,
            backgroundColor: ownedTile ? (checker ? "#31672f" : "#2b5c2a") : checker ? "#1b3a1e" : "#183319",
          }}
        >
          {!ownedTile && (r * 7 + c * 3) % 4 === 0 && (
            <Text style={{ fontSize: Math.max(8, tile * 0.55), textAlign: "center", opacity: 0.55 }}>🌲</Text>
          )}
        </View>
      );
    }
  }

  const selectedInst = selected ? byId[selected] : null;
  const movingStruct = moveMode ? structures.find((s) => s.slug === moveMode.slug) : null;

  // Build list: level-based only while unbuilt (they upgrade in place);
  // quantity-based ALWAYS — each build drops another copy on the grid.
  const buildable = structures.filter((s) => (s.level_based ? !isOwned(s) : true));

  function renderShape({ key, s, x, y, rot, dim, highlight, ghost, ghostValid }) {
    const meta = STRUCT_META[s.slug] || { color: colors.accent, emoji: "🏗️" };
    const shapeCells = rotateCells(shapeFor(s), rot || 0);
    const { w, h } = boundsOf(shapeCells);
    const color = ghost ? (ghostValid ? colors.success : colors.danger) : meta.color;
    const img = ghost ? null : structureImage(s.slug, s.level_based ? tierOf(s) : 0);
    const artPx = Math.min(w, h) * tile * 0.9;
    const badge = !ghost && s.level_based ? `L${s.user_structure?.level || 0}` : null;
    return (
      <View
        key={key}
        pointerEvents="none"
        style={{ position: "absolute", left: x * tile, top: y * tile, width: w * tile, height: h * tile, opacity: dim ? 0.25 : 1, zIndex: ghost ? 20 : 4 }}
      >
        {shapeCells.map(([cx, cy], i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx * tile,
              top: cy * tile,
              width: tile,
              height: tile,
              backgroundColor: alpha(color, ghost ? "40" : "38"),
              borderWidth: ghost ? 2 : 1.5,
              borderColor: highlight ? colors.white : alpha(color, ghost ? "ff" : "cc"),
              borderStyle: ghost ? "dashed" : "solid",
              borderRadius: 3,
            }}
          />
        ))}
        <View style={{ position: "absolute", left: 0, top: 0, width: w * tile, height: h * tile, alignItems: "center", justifyContent: "center" }}>
          {img ? (
            <Image source={img} resizeMode="contain" style={{ width: artPx, height: artPx }} />
          ) : (
            <Text style={{ fontSize: Math.max(10, artPx * 0.55), opacity: ghost ? 0.8 : 1 }}>{meta.emoji}</Text>
          )}
        </View>
        {badge && (
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        )}
        {!ghost && s.user_structure?.burning && <Text style={styles.fire}>🔥</Text>}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* controls row (below the transparent universal header) */}
      <View style={styles.controls}>
        <View style={styles.landChip}>
          <Text style={styles.landChipTxt}>🏔 {freeLand} free / {land} land</Text>
        </View>
        <View style={{ flex: 1 }} />
        {!moveMode && (
          <TouchableOpacity style={styles.buildBtn} onPress={() => setBuildOpen(true)} activeOpacity={0.85}>
            <Text style={styles.buildBtnTxt}>🔨 Build</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* the land grid */}
      <View
        ref={gridRef}
        onLayout={measureGrid}
        style={{ position: "absolute", top: TOP_OFFSET + 46, left: gridLeft, width: gridPx, height: gridPx }}
      >
        <Pressable onPress={onGridPress} style={{ width: gridPx, height: gridPx }}>
          <View pointerEvents="none" style={styles.gridFrame}>
            {cells}
            {instances.map(({ id, s }) => {
              const p = placements[id];
              if (!p) return null;
              return renderShape({
                key: id,
                s,
                x: p.x,
                y: p.y,
                rot: p.rot,
                dim: moveMode?.id === id,
                highlight: selected === id,
              });
            })}
            {moveMode && movingStruct &&
              renderShape({
                key: "ghost",
                s: movingStruct,
                x: moveMode.x,
                y: moveMode.y,
                rot: moveMode.rot,
                ghost: true,
                ghostValid: moveValid,
              })}
          </View>
        </Pressable>
      </View>

      {/* displaced tray */}
      {displaced.length > 0 && !moveMode && (
        <View style={styles.trayWrap}>
          {displaced.slice(0, 3).map((id) => (
            <TouchableOpacity key={id} style={styles.trayChip} onPress={() => startMove(id)}>
              <Text style={styles.trayChipTxt}>⚠️ {byId[id]?.s?.name || id} displaced — tap to place</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* move/place bar with rotate */}
      {moveMode && (
        <View style={styles.moveBar}>
          <Text style={styles.moveBarTxt} numberOfLines={1}>
            {moveMode.isNewBuild ? "Place" : "Move"} {movingStruct?.name || moveMode.slug}
          </Text>
          <TouchableOpacity style={styles.rotateBtn} onPress={rotateGhost}>
            <Text style={styles.rotateTxt}>⟳</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveCancel} onPress={() => setMoveMode(null)}>
            <Text style={styles.moveCancelTxt}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moveConfirm, !moveValid && { opacity: 0.35 }]}
            disabled={!moveValid}
            onPress={confirmMove}
          >
            <Text style={styles.moveConfirmTxt}>✓ {moveMode.isNewBuild ? "Build" : "Confirm"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* selected building info card */}
      {selectedInst && !moveMode && (
        <View style={styles.actionCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionName} numberOfLines={1}>
              {selectedInst.s.name}{" "}
              <Text style={styles.actionBadge}>
                {selectedInst.s.level_based
                  ? `L${selectedInst.s.user_structure?.level || 0}`
                  : `×${selectedInst.s.user_structure?.quantity || 0} built`}
              </Text>
            </Text>
            <Text style={styles.actionMeta} numberOfLines={1}>
              {shapeFor(selectedInst.s).length} tiles
              {productionText(selectedInst.s) ? `  ·  ${productionText(selectedInst.s)}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: (STRUCT_META[selectedInst.s.slug] || {}).color || colors.accent }]}
            onPress={() => go(OPEN_NAV[selectedInst.s.slug]?.nav || ["Kingdom", { subTab: selectedInst.s.slug }])}
          >
            <Text style={styles.actionBtnTxt}>{OPEN_NAV[selectedInst.s.slug]?.label || "Open"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGhostBtn} onPress={() => startMove(selected)}>
            <Text style={styles.actionGhostTxt}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGhostBtn} onPress={() => go(["Kingdom", { subTab: selectedInst.s.slug }])}>
            <Text style={styles.actionGhostTxt}>⬆</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* bottom tab dock */}
      <View style={styles.tabBarDock} pointerEvents="box-none">
        <TabBarVisual names={TAB_NAMES} activeIndex={0} onPress={(name) => go([name, {}])} />
      </View>

      {/* build list */}
      <Modal transparent visible={buildOpen} animationType="slide" onRequestClose={() => setBuildOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBuildOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>🔨 Build a Structure</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {buildable.length === 0 && (
                <Text style={styles.modalEmpty}>Every structure is built — upgrade them from their plots.</Text>
              )}
              {buildable.map((s) => {
                const meta = STRUCT_META[s.slug] || { color: colors.accent, emoji: "🏗️" };
                const costs = s.resource_cost || {};
                const locked = !!s.tc_required;
                const shape = s.level_based ? (SHAPES[s.slug] || [R(1, 1)])[0] : shapeFor(s);
                const qty = s.user_structure?.quantity || 0;
                return (
                  <TouchableOpacity
                    key={s.slug}
                    style={[styles.buildRow, locked && { opacity: 0.45 }]}
                    disabled={locked}
                    onPress={() => startBuild(s)}
                  >
                    <Text style={styles.buildRowEmoji}>{meta.emoji}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.buildRowName, { color: meta.color }]}>
                        {s.name}
                        {!s.level_based && qty > 0 ? `  ·  ×${qty} built` : ""}
                      </Text>
                      <Text style={styles.buildRowMeta} numberOfLines={1}>
                        {shape.length} tiles
                        {costs.gold ? ` · 💰 ${Number(costs.gold).toLocaleString()}` : ""}
                        {costs.mana ? ` · 🔮 ${Number(costs.mana).toLocaleString()}` : ""}
                        {s.land_cost ? ` · 🏔 ${s.land_cost}` : ""}
                        {locked ? ` · 🔒 needs Town Center L${s.tc_required}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.buildRowArrow}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* measure actual viewport */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) => setViewSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      />
    </View>
  );
}

/* ── styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1a10" },

  controls: {
    position: "absolute",
    top: TOP_OFFSET,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  landChip: {
    backgroundColor: alpha("#0a140c", "dd"),
    borderWidth: 1,
    borderColor: alpha(colors.goldDim, "66"),
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  landChipTxt: { color: colors.text, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  buildBtn: {
    backgroundColor: colors.gold,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  buildBtnTxt: { color: "#1a1405", fontSize: 12, fontWeight: "900" },

  gridFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: alpha(colors.goldDim, "55"),
    overflow: "hidden",
    borderRadius: 6,
  },
  badge: {
    position: "absolute",
    top: -1,
    right: -1,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 6,
  },
  badgeTxt: { color: "#141414", fontSize: 9, fontWeight: "900", fontVariant: ["tabular-nums"] },
  fire: { position: "absolute", bottom: 1, left: 2, fontSize: 14 },

  trayWrap: { position: "absolute", left: 10, right: 10, bottom: BOTTOM_DOCK + 6, gap: 5, zIndex: 6 },
  trayChip: {
    backgroundColor: alpha(colors.danger, "22"),
    borderWidth: 1,
    borderColor: alpha(colors.danger, "77"),
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trayChipTxt: { color: colors.dangerSoft, fontSize: 11, fontWeight: "700" },

  moveBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: BOTTOM_DOCK + 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: alpha("#0a140c", "f0"),
    borderWidth: 1,
    borderColor: alpha(colors.goldDim, "77"),
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 6,
  },
  moveBarTxt: { flex: 1, color: colors.text, fontSize: 11, fontWeight: "700" },
  rotateBtn: {
    borderWidth: 1,
    borderColor: alpha(colors.info, "99"),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rotateTxt: { color: colors.info, fontSize: 15, fontWeight: "900" },
  moveCancel: {
    borderWidth: 1,
    borderColor: alpha(colors.danger, "88"),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moveCancelTxt: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  moveConfirm: { backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  moveConfirmTxt: { color: colors.white, fontSize: 12, fontWeight: "900" },

  actionCard: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: BOTTOM_DOCK + 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: alpha("#0a140c", "f0"),
    borderWidth: 1,
    borderColor: alpha(colors.goldDim, "77"),
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 6,
  },
  actionName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  actionBadge: { color: colors.gold, fontSize: 11, fontWeight: "800" },
  actionMeta: { color: colors.muted, fontSize: 10, marginTop: 1 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actionBtnTxt: { color: "#101010", fontSize: 11, fontWeight: "900" },
  actionGhostBtn: {
    borderWidth: 1,
    borderColor: alpha(colors.goldDim, "88"),
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  actionGhostTxt: { color: colors.goldDim, fontSize: 11, fontWeight: "800" },

  tabBarDock: { position: "absolute", left: 0, right: 0, bottom: 0 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: {
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {}),
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    paddingBottom: 24,
  },
  modalTitle: { color: colors.gold, fontSize: 15, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  modalEmpty: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: 16 },
  buildRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 6,
  },
  buildRowEmoji: { fontSize: 20 },
  buildRowName: { fontSize: 13, fontWeight: "800" },
  buildRowMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  buildRowArrow: { color: colors.goldDim, fontSize: 18, fontWeight: "700" },
});
