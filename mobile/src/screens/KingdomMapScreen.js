// ═══════════════════════════════════════════════════════════════════
// EXPERIMENTAL — Kingdom Map home scene.
//
// A pan/zoomable view of your kingdom, art-directed to match a reference
// mock: buildings are painted directly into a single fixed background
// image (kingdom-background.png) — there's no separate per-building sprite
// or drag-to-reposition system anymore. Tapping a labeled plaque over a
// painted building opens that part of the game.
//
// To remove this experiment entirely:
//   1. delete this file
//   2. remove the "KingdomMap" route in navigation/MainTabs.js
//   3. remove the 🗺 button in screens/HomeScreen.js
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as api from "../services/api";
import { PressableScale, ProgressBar } from "../components/ui";
import { TabBarVisual, TAB_NAMES } from "../navigation/CustomTabBar";
import LoadingButton from "../components/LoadingButton";
import { loadMapLayout, saveMapLayout, clearMapLayout } from "../services/mapLayout";
import { formatCountdown } from "../utils/time";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

// The viewport this screen renders into isn't necessarily the raw window —
// on web it's whatever size components/DeviceFrame.js decides to give it.
// So the actual width/height come from the root container's own onLayout
// (see viewSize state below), not Dimensions.get("window"). This constant
// is only a same-frame-paint fallback for the brief moment before the
// first layout fires.
const { width: INITIAL_W, height: INITIAL_H } = Dimensions.get("window");

// Canvas matches kingdom-background.png's native size exactly, so plaque
// x/y below are just that image's own pixel coordinates.
const MAP_W = 941;
const MAP_H = 1672;

// Where each painted building sits in kingdom-background.png (center of its
// label plaque, tuned by eye against the art) and which part of the game it
// opens. Every building visible in the art gets an entry; there's no
// separate building sprite to render — the art already has them.
const POIS = [
  { key: "rankings", label: "Hall of Legends", icon: "🏆", x: 433, y: 405, nav: ["War", { subTab: "rankings" }] },
  { key: "market",   label: "Black Market",    icon: "⚖️", x: 715, y: 622, nav: ["Kingdom", { subTab: "market" }] },
  { key: "town",     label: "Town Hall",       icon: "🏰", x: 423, y: 958, nav: ["Kingdom", { subTab: "town" }] },
  { key: "tax",      label: "Treasury",        icon: "💰", x: 772, y: 1008, nav: ["Kingdom", { subTab: "tax" }] },
  { key: "war",      label: "War Camp",        icon: "⚔️", x: 220, y: 1000, nav: ["War", { subTab: "attack" }] },
  { key: "magic",    label: "Mage Tower",      icon: "🔮", x: 640, y: 1376, nav: ["Magic", {}] },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Default/minimum zoom is a true "cover" fit — scale by whichever of
// width/height needs the bigger multiplier so BOTH dimensions are fully
// covered edge-to-edge (no letterboxed gaps on the sides, ever), same as
// CSS background-size:cover. The map art is proportionally wider than a
// phone screen, so height is normally the binding dimension — the bottom
// of the art running under the footer chrome (tip card, tax/mana buttons,
// tab bar) is expected and fine; the width filling the frame edge-to-edge
// matters more than every building staying clear of the menus. Takes the
// actual measured viewport (not a module-level constant) so it stays
// correct if that viewport is resized — e.g. DeviceFrame reflowing when a
// browser window is resized.
function fitScaleFor(viewW, viewH) {
  return Math.max(viewW / MAP_W, viewH / MAP_H);
}
const MAX_SCALE = 1.4;
const SCALE_STEP = 0.15;

// Pan bounds shrink/grow with zoom. RN's `scale` transform pivots around the
// element's own CENTER (not its top-left corner), so a scaled canvas's true
// on-screen edges are offset from where a naive translate-only calculation
// would put them — by size*(1-scale)/2 on each side. This accounts for that
// offset directly, so pan.x/pan.y's neutral resting bound is no longer
// always 0 once scale != 1.
function panBounds(scale, viewW, viewH) {
  const offsetX = (MAP_W - MAP_W * scale) / 2;
  const offsetY = (MAP_H - MAP_H * scale) / 2;
  const contentW = MAP_W * scale;
  const contentH = MAP_H * scale;

  let minX, maxX;
  if (contentW <= viewW) {
    minX = maxX = (viewW - contentW) / 2 - offsetX;
  } else {
    maxX = -offsetX;
    minX = viewW - offsetX - contentW;
  }

  // Y is always top-anchored, never centered — fitScaleFor already leaves
  // the natural gap (if any) below the image, clear of the footer chrome,
  // so there's nothing to gain from centering it into that gap too.
  const maxY = -offsetY;
  const minY = contentH <= viewH ? maxY : viewH - offsetY - contentH;

  return { minX, maxX, minY, maxY };
}

const TIER_COLORS = {
  lenient: colors.success,
  standard: colors.info,
  heavy: colors.warning,
  extortion: colors.danger,
};

// Each building gets two independently positioned overlays on top of the
// painted art: a "hotspot" (a big invisible/dashed-in-edit-mode tap zone
// sized to cover the building itself) and a "label" (the visible icon+name
// plaque). They're separate because the label needs to stay small and
// readable near the building while the hotspot wants to be big and roughly
// match the building's actual silhouette — dragging one shouldn't move the
// other. Both default to centering on the POI's tuned x/y; a user can then
// drag (and, for the hotspot, resize) either one in edit mode, persisted via
// services/mapLayout.js.
const DEFAULT_HS_W = 190;
const DEFAULT_HS_H = 230;
const MIN_HS = 60;

function defaultLayoutFor(poi) {
  return {
    hs: { x: poi.x, y: poi.y, w: DEFAULT_HS_W, h: DEFAULT_HS_H },
    lbl: { x: poi.x, y: poi.y },
  };
}

function defaultLayout(pois) {
  const out = {};
  pois.forEach((p) => { out[p.key] = defaultLayoutFor(p); });
  return out;
}

function EditablePOI({ poi, entry, scale, editMode, onChange, onPress }) {
  const { hs, lbl } = entry;

  const hsDragStart = useRef({ x: hs.x, y: hs.y });
  const hsSizeStart = useRef({ w: hs.w, h: hs.h });
  const lblDragStart = useRef({ x: lbl.x, y: lbl.y });

  const hsMoveResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { hsDragStart.current = { x: hs.x, y: hs.y }; },
      onPanResponderMove: (_, g) => {
        onChange(poi.key, "hs", {
          x: hsDragStart.current.x + g.dx / scale,
          y: hsDragStart.current.y + g.dy / scale,
        });
      },
    })
  ).current;

  const hsResizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { hsSizeStart.current = { w: hs.w, h: hs.h }; },
      onPanResponderMove: (_, g) => {
        onChange(poi.key, "hs", {
          w: Math.max(MIN_HS, hsSizeStart.current.w + (g.dx / scale) * 2),
          h: Math.max(MIN_HS, hsSizeStart.current.h + (g.dy / scale) * 2),
        });
      },
    })
  ).current;

  const lblMoveResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { lblDragStart.current = { x: lbl.x, y: lbl.y }; },
      onPanResponderMove: (_, g) => {
        onChange(poi.key, "lbl", {
          x: lblDragStart.current.x + g.dx / scale,
          y: lblDragStart.current.y + g.dy / scale,
        });
      },
    })
  ).current;

  const hsBoxStyle = { position: "absolute", left: hs.x - hs.w / 2, top: hs.y - hs.h / 2, width: hs.w, height: hs.h };
  const lblBoxStyle = { position: "absolute", left: lbl.x - 95, top: lbl.y - 22, width: 190 };

  if (editMode) {
    return (
      <>
        <View {...hsMoveResponder.panHandlers} style={[hsBoxStyle, styles.hotspotEdit]}>
          <Text style={styles.hotspotTag} numberOfLines={1}>{poi.label} · link</Text>
          <View {...hsResizeResponder.panHandlers} style={styles.resizeHandle} />
        </View>
        <View {...lblMoveResponder.panHandlers} style={lblBoxStyle}>
          <View style={[styles.poiPlaque, styles.poiPlaqueEdit]}>
            <Text style={styles.poiPlaqueIcon}>{poi.icon}</Text>
            <Text style={styles.poiLabel}>{poi.label}</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <TouchableOpacity style={hsBoxStyle} activeOpacity={0.7} onPress={onPress} />
      <PressableScale scaleTo={0.92} containerStyle={lblBoxStyle} style={styles.poiInner} onPress={onPress}>
        <View style={styles.poiPlaque}>
          <Text style={styles.poiPlaqueIcon}>{poi.icon}</Text>
          <Text style={styles.poiLabel}>{poi.label}</Text>
        </View>
      </PressableScale>
    </>
  );
}

export default function KingdomMapScreen({ navigation }) {
  const [player, setPlayer] = useState(null);
  const [unread, setUnread] = useState(0);

  // The viewport this screen actually renders into — measured via onLayout
  // on the root container below, not assumed from the raw window (see
  // components/DeviceFrame.js, which may give it a smaller bordered box on
  // web). INITIAL_W/H is only a same-frame guess for the instant before
  // the first layout callback fires.
  const [viewSize, setViewSize] = useState({ w: INITIAL_W, h: INITIAL_H });
  const viewSizeRef = useRef(viewSize);
  const fitScale = fitScaleFor(viewSize.w, viewSize.h);

  const [scale, setScale] = useState(fitScale);
  const scaleAnim = useRef(new Animated.Value(fitScale)).current;
  const scaleRef = useRef(fitScale);

  function handleContainerLayout(e) {
    const { width, height } = e.nativeEvent.layout;
    if (!width || !height) return;
    if (viewSizeRef.current.w === width && viewSizeRef.current.h === height) return;
    viewSizeRef.current = { w: width, h: height };
    setViewSize({ w: width, h: height });

    // Re-home the camera to the top-anchored default fit for the new size —
    // covers both the very first real measurement (correcting the initial
    // guess) and later resizes (a browser window drag, a rotated device),
    // so the view is never left zoomed/panned outside the new bounds.
    const fit = fitScaleFor(width, height);
    const { minX, maxX, maxY } = panBounds(fit, width, height);
    scaleRef.current = fit;
    setScale(fit);
    scaleAnim.setValue(fit);
    pan.setValue({ x: (minX + maxX) / 2, y: maxY });
  }

  // Building hotspot/label positions — user-editable, persisted across
  // sessions (see EditablePOI above). Loaded async so the first paint uses
  // the tuned defaults and never flashes/jumps once the saved layout lands.
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState(() => defaultLayout(POIS));
  const layoutLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const saved = await loadMapLayout();
      if (saved) {
        setLayout((prev) => {
          const merged = {};
          POIS.forEach((p) => {
            merged[p.key] = {
              hs: { ...prev[p.key].hs, ...(saved[p.key]?.hs || {}) },
              lbl: { ...prev[p.key].lbl, ...(saved[p.key]?.lbl || {}) },
            };
          });
          return merged;
        });
      }
      layoutLoadedRef.current = true;
    })();
  }, []);

  // Debounced autosave — skips the initial default-layout render so it
  // never overwrites a saved layout before loadMapLayout() has resolved.
  useEffect(() => {
    if (!layoutLoadedRef.current) return;
    const t = setTimeout(() => { saveMapLayout(layout); }, 400);
    return () => clearTimeout(t);
  }, [layout]);

  function handleLayoutChange(key, kind, patch) {
    setLayout((prev) => ({ ...prev, [key]: { ...prev[key], [kind]: { ...prev[key][kind], ...patch } } }));
  }

  function handleResetLayout() {
    const fresh = defaultLayout(POIS);
    setLayout(fresh);
    clearMapLayout();
  }

  function zoomBy(delta) {
    const { w: viewW, h: viewH } = viewSizeRef.current;
    const minScale = fitScaleFor(viewW, viewH);
    const next = clamp(Math.round((scaleRef.current + delta) * 100) / 100, minScale, MAX_SCALE);
    if (next === scaleRef.current) return;
    scaleRef.current = next;
    setScale(next);
    Animated.spring(scaleAnim, { toValue: next, speed: 14, bounciness: 4, useNativeDriver: Platform.OS !== "web" }).start();

    // Re-clamp the current pan into the new zoom level's bounds so the
    // camera never ends up parked outside the (now smaller/larger) map.
    const { minX, maxX, minY, maxY } = panBounds(next, viewW, viewH);
    pan.stopAnimation((v) => {
      const clampedX = clamp(v.x, minX, maxX);
      const clampedY = clamp(v.y, minY, maxY);
      if (clampedX !== v.x || clampedY !== v.y) {
        Animated.spring(pan, { toValue: { x: clampedX, y: clampedY }, speed: 14, bounciness: 0, useNativeDriver: Platform.OS !== "web" }).start();
      }
    });
  }

  // Middle zoom-bar button: snap back to the default top-anchored fit view
  // — a quick "where am I" recenter.
  function resetView() {
    const { w: viewW, h: viewH } = viewSizeRef.current;
    const fit = fitScaleFor(viewW, viewH);
    const { minX, maxX, maxY } = panBounds(fit, viewW, viewH);
    scaleRef.current = fit;
    setScale(fit);
    Animated.spring(scaleAnim, { toValue: fit, speed: 14, bounciness: 4, useNativeDriver: Platform.OS !== "web" }).start();
    Animated.spring(pan, { toValue: { x: (minX + maxX) / 2, y: maxY }, speed: 10, bounciness: 0, useNativeDriver: Platform.OS !== "web" }).start();
  }

  // Quick-action popups: null | "tax" | "mana"
  const [actionModal, setActionModal] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [now, setNow] = useState(Date.now());

  // 1s clock for the tax cooldown countdown while a popup is open
  useEffect(() => {
    if (!actionModal) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [actionModal]);

  // Start pinned to the TOP of the image (never crop the top) and centered
  // horizontally. maxY from panBounds is exactly the pan value that puts
  // the image's top edge at the viewport's top edge (see panBounds's
  // comment on the center-pivot scale offset) — whatever doesn't fit
  // vertically is cropped off the bottom, and a taller viewport naturally
  // shows more of it since less needs to be cropped.
  const { minX: startMinX, maxX: startMaxX, maxY: startMaxY } = panBounds(fitScale, viewSize.w, viewSize.h);
  const startX = (startMinX + startMaxX) / 2;
  const startY = startMaxY;
  const pan = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;
  const panStart = useRef({ x: startX, y: startY });

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it's clearly a drag, so plaque taps work.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
      onPanResponderGrant: () => {
        pan.stopAnimation((v) => { panStart.current = v; });
      },
      onPanResponderMove: (_, g) => {
        const { minX, maxX, minY, maxY } = panBounds(scaleRef.current, viewSizeRef.current.w, viewSizeRef.current.h);
        pan.setValue({
          x: clamp(panStart.current.x + g.dx, minX, maxX),
          y: clamp(panStart.current.y + g.dy, minY, maxY),
        });
      },
      onPanResponderRelease: (_, g) => {
        // A touch of glide, clamped to the map bounds.
        const { minX, maxX, minY, maxY } = panBounds(scaleRef.current, viewSizeRef.current.w, viewSizeRef.current.h);
        const toX = clamp(panStart.current.x + g.dx + g.vx * 120, minX, maxX);
        const toY = clamp(panStart.current.y + g.dy + g.vy * 120, minY, maxY);
        Animated.spring(pan, {
          toValue: { x: toX, y: toY },
          speed: 8,
          bounciness: 0,
          useNativeDriver: Platform.OS !== "web",
        }).start();
      },
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const d = await api.getDashboard();
          setPlayer(d.player);
          setUnread(d.unread_notifications || 0);
        } catch (e) {}
      })();
    }, [])
  );

  function go([tab, params]) {
    // The game sections live inside the nested tab navigator, so from this
    // root-stack screen we must address them through the MainTabs route.
    navigation.navigate("MainTabs", { screen: tab, params });
  }

  async function refreshEconomy() {
    try {
      const [t, d] = await Promise.all([api.getTreasury(), api.getDashboard()]);
      setTreasury(t);
      setPlayer(d.player);
    } catch (e) {}
  }

  function openAction(kind) {
    setActionResult(null);
    setActionModal(kind);
    refreshEconomy();
  }

  async function handleTax(tier) {
    try {
      const result = await api.collectTax(tier);
      setActionResult({ ok: true, text: result.message });
      await refreshEconomy();
    } catch (e) {
      setActionResult({ ok: false, text: e.message });
    }
  }

  async function handleChannelMana() {
    try {
      const result = await api.rechargeMana();
      setActionResult({ ok: true, text: result.message });
      await refreshEconomy();
    } catch (e) {
      setActionResult({ ok: false, text: e.message });
    }
  }

  /* ── quick-action popup content ── */

  function renderTaxModal() {
    const t = treasury;
    const cooldownMs = t?.tax_cooldown ? new Date(t.tax_cooldown).getTime() - now : 0;
    const onCooldown = cooldownMs > 0;

    return (
      <>
        <Text style={styles.modalTitle}>💰 Collect Taxes</Text>
        <Text style={styles.modalInfo}>
          Squeeze gold from your subjects. Heavier rates yield more but lock the
          coffers longer — your Town Center and gold production set the base amount.
        </Text>

        <View style={styles.modalStatRow}>
          <Text style={styles.modalStat}>Treasury: <Text style={styles.modalStatVal}>💰 {Number(t?.gold ?? 0).toLocaleString()}</Text></Text>
          <Text style={styles.modalStat}>Base take: <Text style={styles.modalStatVal}>{Number(t?.taxable_amount ?? 0).toLocaleString()}</Text></Text>
        </View>

        {onCooldown ? (
          <View style={styles.cooldownBox}>
            <Text style={styles.cooldownTxt}>⏳ Collectors are resting — ready in {formatCountdown(cooldownMs / 1000)}</Text>
          </View>
        ) : (
          t?.tax_rates &&
          Object.entries(t.tax_rates).map(([tier, cfg]) => {
            const color = TIER_COLORS[tier] || colors.muted;
            const amount = Math.round((t.taxable_amount || 0) * (cfg.multiplier || 1));
            const cdHrs = cfg.cooldown ? Math.round(cfg.cooldown / 3600) : 0;
            return (
              <LoadingButton key={tier} style={[styles.tierBtn, { borderColor: color }]} onPress={() => handleTax(tier)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color }]}>{cfg.label || tier}</Text>
                  <Text style={styles.tierMeta}>{cdHrs >= 1 ? `${cdHrs}h cooldown` : "short cooldown"}</Text>
                </View>
                <Text style={styles.tierAmount}>+{amount.toLocaleString()} 💰</Text>
              </LoadingButton>
            );
          })
        )}
      </>
    );
  }

  function renderManaModal() {
    const t = treasury;
    const charge = t?.mana_charge ?? 0;
    const net = t?.net_mana_potential ?? 0;
    const baseYield = Math.floor(net * 0.6 * charge);
    const bonusYield = Math.floor(net * 0.4 * charge * charge);
    const projected = baseYield + bonusYield;
    const pct = Math.round(charge * 100);

    return (
      <>
        <Text style={styles.modalTitle}>🔮 Channel Mana</Text>
        <Text style={styles.modalInfo}>
          Your Mana Core charges over ~4 hours. Release it to bank the mana —
          waiting for a fuller charge pays a growing bonus, but an overloaded
          core risks nothing extra. Upkeep drains what your army and spells consume.
        </Text>

        <View style={styles.chargeRow}>
          <Text style={styles.modalStat}>Battery charge</Text>
          <Text style={[styles.modalStatVal, { color: pct >= 75 ? colors.warning : colors.info }]}>{pct}%</Text>
        </View>
        <ProgressBar percent={pct} color={pct >= 75 ? colors.warning : colors.info} height={9} style={{ marginBottom: 10 }} />

        <View style={styles.modalStatRow}>
          <Text style={styles.modalStat}>Mana: <Text style={styles.modalStatVal}>🔮 {Number(t?.mana ?? 0).toLocaleString()}</Text></Text>
          <Text style={styles.modalStat}>
            Projected: <Text style={[styles.modalStatVal, { color: projected >= 0 ? colors.success : colors.danger }]}>
              {projected >= 0 ? "+" : ""}{projected.toLocaleString()}
            </Text>
          </Text>
        </View>

        <LoadingButton style={styles.channelBtn} onPress={handleChannelMana}>
          <Text style={styles.channelTxt}>🔮 Release the Charge</Text>
        </LoadingButton>
      </>
    );
  }

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {/* ── PANNABLE / ZOOMABLE MAP ── */}
      <View style={styles.viewport} {...(editMode ? {} : panResponder.panHandlers)}>
        <Animated.View
          style={[
            styles.canvas,
            { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scaleAnim }] },
          ]}
        >
          <Image source={art.kingdomBackground} resizeMode="cover" style={styles.mapArt} />

          {POIS.map((p) => (
            <EditablePOI
              key={p.key}
              poi={p}
              entry={layout[p.key]}
              scale={scale}
              editMode={editMode}
              onChange={handleLayoutChange}
              onPress={() => go(p.nav)}
            />
          ))}
        </Animated.View>
      </View>

      {/* bottom vignette — fades the map into the footer HUD instead of
          buildings clipping abruptly behind it (fixed to the screen, not
          the pannable canvas). */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", alpha(colors.bg, "dd"), colors.bg]}
        locations={[0, 0.45, 0.72]}
        style={styles.bottomScrim}
      />

      {/* zoom controls — one image, three overlaid tap zones (+ / reset / −) */}
      <View style={styles.zoomStack} pointerEvents="box-none">
        <Image source={art.zoomBar} style={styles.zoomBarImg} resizeMode="contain" />
        <TouchableOpacity
          style={styles.zoomHitIn}
          onPress={() => zoomBy(SCALE_STEP)}
          disabled={scale >= MAX_SCALE}
        />
        <TouchableOpacity style={styles.zoomHitReset} onPress={resetView} />
        <TouchableOpacity
          style={styles.zoomHitOut}
          onPress={() => zoomBy(-SCALE_STEP)}
          disabled={scale <= fitScale}
        />
      </View>

      {/* ── FIXED HUD ── */}
      {/* top: resources */}
      <View style={styles.hudTop} pointerEvents="box-none">
        <View style={styles.currencyBar}>
          <Image source={art.currencyTop} style={styles.currencyBarImg} resizeMode="stretch" />
          <View style={styles.currencySlots} pointerEvents="none">
            <View style={styles.currencySlot}>
              <Image source={art.coinIcon} style={styles.currencyIcon} resizeMode="contain" />
              <Text style={styles.currencyVal}>{player ? Number(player.gold).toLocaleString() : "—"}</Text>
            </View>
            <View style={styles.currencySlot}>
              <Image source={art.manaIcon} style={styles.currencyIcon} resizeMode="contain" />
              <Text style={[styles.currencyVal, { color: colors.info }]}>{player ? Number(player.mana).toLocaleString() : "—"}</Text>
            </View>
            <View style={styles.currencySlot}>
              <Image source={art.diamondIcon} style={styles.currencyIcon} resizeMode="contain" />
              <Text style={[styles.currencyVal, { color: "#5fb8ff" }]}>0</Text>
            </View>
          </View>
        </View>
        <View style={styles.hudButtons}>
          {editMode && (
            <TouchableOpacity style={styles.hudBtn} onPress={handleResetLayout}>
              <Text style={styles.hudBtnTxt}>↺</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.hudBtn, editMode && styles.hudBtnActive]}
            onPress={() => setEditMode((e) => !e)}
          >
            <Text style={styles.hudBtnTxt}>{editMode ? "✅" : "✏️"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hudBtn} onPress={() => navigation.navigate("Notifications")}>
            <Text style={styles.hudBtnTxt}>🔔</Text>
            {unread > 0 && (
              <View style={styles.hudDot}>
                <Text style={styles.hudDotTxt}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate("Profile")}>
            <Image source={art.avatarDefault} style={styles.avatarImg} resizeMode="cover" />
          </TouchableOpacity>
        </View>
      </View>

      {editMode && (
        <View style={styles.editBanner} pointerEvents="none">
          <Text style={styles.editBannerTxt}>Edit mode — drag boxes to move, corner dot to resize the link zone</Text>
        </View>
      )}

      {/* quick actions: tax + mana, straight from the map */}
      <View style={styles.quickRow} pointerEvents="box-none">
        <PressableScale containerStyle={styles.quickBtnWrap} style={styles.quickBtnInner} scaleTo={0.96} onPress={() => openAction("tax")}>
          <Image source={art.collectTaxesBtn} style={styles.quickBtnImg} resizeMode="contain" />
        </PressableScale>
        <PressableScale containerStyle={styles.quickBtnWrap} style={styles.quickBtnInner} scaleTo={0.96} onPress={() => openAction("mana")}>
          <Image source={art.collectManaBtn} style={styles.quickBtnImg} resizeMode="contain" />
        </PressableScale>
      </View>

      {/* bottom: same tab bar as the rest of the app, floating on top of the
          map art (not squeezed above it in normal flow) — tapping "Home" is
          the way back to the classic dashboard. */}
      <View style={styles.tabBarDock} pointerEvents="box-none">
        <TabBarVisual
          names={TAB_NAMES}
          activeIndex={0}
          onPress={(name) => go([name, {}])}
        />
      </View>

      {/* ── QUICK-ACTION POPUP ── */}
      {actionModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setActionModal(null)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionModal(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
              {treasury ? (
                actionModal === "tax" ? renderTaxModal() : renderManaModal()
              ) : (
                <Text style={styles.modalInfo}>Consulting the ledgers…</Text>
              )}

              {actionResult && (
                <View style={[styles.resultBox, { borderColor: actionResult.ok ? colors.success : colors.danger }]}>
                  <Text style={[styles.resultTxt, { color: actionResult.ok ? colors.success : colors.danger }]}>
                    {actionResult.text}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.modalClose} onPress={() => setActionModal(null)}>
                <Text style={styles.modalCloseTxt}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  viewport: { flex: 1, overflow: "hidden" },
  tabBarDock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottomScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 340,
  },
  canvas: { width: MAP_W, height: MAP_H },
  mapArt: { position: "absolute", width: MAP_W, height: MAP_H },

  /* building plaques */
  poiInner: { alignItems: "center" },
  poiPlaque: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: alpha("#1a1128", "e0"),
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "99"),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  poiPlaqueIcon: { fontSize: 15 },
  poiLabel: { color: colors.gold, fontSize: 14, fontWeight: "800" },
  poiPlaqueEdit: { borderColor: colors.info, borderWidth: 2 },

  /* edit-mode hotspot (the "link" tap zone over a painted building) */
  hotspotEdit: {
    borderWidth: 2,
    borderColor: alpha(colors.info, "cc"),
    borderStyle: "dashed",
    backgroundColor: alpha(colors.info, "22"),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotTag: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: alpha(colors.black, "88"),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resizeHandle: {
    position: "absolute",
    right: -11,
    bottom: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.info,
    borderWidth: 2,
    borderColor: colors.white,
  },
  editBanner: {
    position: "absolute",
    top: Platform.OS === "web" ? 54 : 90,
    left: 10,
    right: 10,
    backgroundColor: alpha(colors.info, "ee"),
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editBannerTxt: { color: colors.white, fontSize: 11, fontWeight: "700", textAlign: "center" },

  /* HUD */
  hudTop: {
    position: "absolute",
    top: Platform.OS === "web" ? 10 : 46,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  currencyBar: { flex: 1, height: 30, marginRight: 8 },
  currencyBarImg: { width: "100%", height: "100%" },
  currencySlots: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: "7%",
  },
  currencySlot: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  currencyIcon: { width: 15, height: 15 },
  currencyVal: { color: colors.gold, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  hudButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  hudBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha("#1a1128", "e6"),
    borderWidth: 1.25,
    borderColor: alpha(colors.gold, "77"),
    alignItems: "center",
    justifyContent: "center",
  },
  hudBtnTxt: { fontSize: 15 },
  hudBtnActive: { borderColor: colors.info, backgroundColor: alpha(colors.info, "33") },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: "hidden",
    backgroundColor: "#1a1128",
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  avatarImg: { width: "100%", height: "100%" },
  hudDot: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  hudDotTxt: { color: colors.white, fontSize: 9, fontWeight: "800" },

  /* zoom controls */
  zoomStack: {
    position: "absolute",
    right: 10,
    bottom: 164,
    width: 46,
    height: 46 * (1554 / 468),
  },
  zoomBarImg: { width: "100%", height: "100%" },
  zoomHitIn: { position: "absolute", left: 0, right: 0, top: "0%", height: "33%" },
  zoomHitReset: { position: "absolute", left: 0, right: 0, top: "33%", height: "34%" },
  zoomHitOut: { position: "absolute", left: 0, right: 0, top: "67%", height: "33%" },


  /* quick actions */
  quickRow: {
    position: "absolute",
    bottom: 96,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 10,
  },
  quickBtnWrap: { flex: 1, height: 58 },
  quickBtnInner: { width: "100%", height: "100%" },
  quickBtnImg: { width: "100%", height: "100%" },

  /* quick-action popup */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "77"),
    padding: 18,
  },
  modalTitle: { color: colors.gold, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  modalInfo: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: "center", marginBottom: 12 },
  modalStatRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  modalStat: { color: colors.muted, fontSize: 12 },
  modalStatVal: { color: colors.text, fontWeight: "800", fontVariant: ["tabular-nums"] },
  chargeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  cooldownBox: {
    backgroundColor: alpha(colors.danger, "18"),
    borderWidth: 1,
    borderColor: alpha(colors.danger, "55"),
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  cooldownTxt: { color: colors.dangerSoft, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  tierBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 7,
  },
  tierName: { fontSize: 14, fontWeight: "800" },
  tierMeta: { color: colors.muted, fontSize: 10, marginTop: 1 },
  tierAmount: { color: colors.gold, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  channelBtn: {
    backgroundColor: colors.info,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  channelTxt: { color: colors.white, fontSize: 14, fontWeight: "800" },
  resultBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  resultTxt: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  modalClose: { alignItems: "center", paddingVertical: 10, marginTop: 4 },
  modalCloseTxt: { color: colors.muted, fontSize: 13 },
});
