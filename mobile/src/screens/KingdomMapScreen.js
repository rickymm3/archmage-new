// ═══════════════════════════════════════════════════════════════════
// EXPERIMENTAL — Kingdom Map home scene.
//
// A free-panning map of your kingdom where the buildings ARE the menu:
// swipe to move around, tap a structure to open that part of the game.
// No nav bars, no lists — pure game shell.
//
// To remove this experiment entirely:
//   1. delete this file
//   2. remove the "KingdomMap" route in navigation/MainTabs.js
//   3. remove the 🗺 button in screens/HomeScreen.js
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useCallback, useRef, useEffect } from "react";
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
import * as api from "../services/api";
import { PressableScale, ProgressBar } from "../components/ui";
import LoadingButton from "../components/LoadingButton";
import { ui as art, structureImage } from "../assets";
import { colors, alpha } from "../theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const VIEW_W = Platform.OS === "web" ? Math.min(SCREEN_W, 480) : SCREEN_W;
const VIEW_H = SCREEN_H;

// Map canvas — comfortably larger than any phone viewport.
const MAP_W = 1400;
const MAP_H = 1000;

// Points of interest: where the buildings sit and where they take you.
// x/y are canvas coordinates (center of the POI).
const POIS = [
  { key: "town",     label: "Town Hall",      x: 640,  y: 430, size: 130, img: () => structureImage("town_center", 2), nav: ["Kingdom", { subTab: "town" }] },
  { key: "army",     label: "Barracks",       x: 330,  y: 560, size: 104, img: () => structureImage("barracks", 1),    nav: ["Army", { subTab: "overview" }] },
  { key: "magic",    label: "Mage Tower",     x: 950,  y: 300, size: 104, img: () => structureImage("altar", 2),       nav: ["Magic", {}] },
  { key: "tax",      label: "Treasury",       x: 900,  y: 580, size: 96,  img: () => structureImage("bank", 1),        nav: ["Kingdom", { subTab: "tax" }] },
  { key: "mana",     label: "Mana Core",      x: 1130, y: 460, size: 96,  img: () => structureImage("mana_core", 1),   nav: ["Kingdom", { subTab: "mana" }] },
  { key: "market",   label: "Black Market",   x: 520,  y: 720, size: 92,  emoji: "🛒",                                  nav: ["Kingdom", { subTab: "market" }] },
  { key: "war",      label: "War Camp",       x: 200,  y: 310, size: 100, img: () => structureImage("field_camp", 2),  nav: ["War", { subTab: "attack" }] },
  { key: "explore",  label: "The Wilds",      x: 1180, y: 780, size: 92,  emoji: "🏔",                                  nav: ["War", { subTab: "explore" }] },
  { key: "rankings", label: "Hall of Legends", x: 770, y: 170, size: 88,  emoji: "🏆",                                  nav: ["War", { subTab: "rankings" }] },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const MIN_X = -(MAP_W - VIEW_W);
const MIN_Y = -(MAP_H - VIEW_H);

const TIER_COLORS = {
  lenient: colors.success,
  standard: colors.info,
  heavy: colors.warning,
  extortion: colors.danger,
};

export default function KingdomMapScreen({ navigation }) {
  const [player, setPlayer] = useState(null);
  const [unread, setUnread] = useState(0);

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

  // Start centered on the Town Hall.
  const startX = clamp(-(POIS[0].x - VIEW_W / 2), MIN_X, 0);
  const startY = clamp(-(POIS[0].y - VIEW_H / 2), MIN_Y, 0);
  const pan = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;
  const panStart = useRef({ x: startX, y: startY });

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it's clearly a drag, so POI taps work.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
      onPanResponderGrant: () => {
        pan.stopAnimation((v) => { panStart.current = v; });
      },
      onPanResponderMove: (_, g) => {
        pan.setValue({
          x: clamp(panStart.current.x + g.dx, MIN_X, 0),
          y: clamp(panStart.current.y + g.dy, MIN_Y, 0),
        });
      },
      onPanResponderRelease: (_, g) => {
        // A touch of glide, clamped to the map bounds.
        const toX = clamp(panStart.current.x + g.dx + g.vx * 120, MIN_X, 0);
        const toY = clamp(panStart.current.y + g.dy + g.vy * 120, MIN_Y, 0);
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
    const mins = Math.floor(cooldownMs / 60000);
    const secs = Math.max(0, Math.floor((cooldownMs % 60000) / 1000));

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
            <Text style={styles.cooldownTxt}>⏳ Collectors are resting — ready in {mins}m {secs}s</Text>
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
    <View style={styles.container}>
      {/* ── PANNABLE MAP ── */}
      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[styles.canvas, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        >
          <Image source={art.townPanorama} resizeMode="cover" style={styles.mapArt} />
          <View style={styles.mapTint} />

          {POIS.map((p) => (
            <PressableScale
              key={p.key}
              scaleTo={0.9}
              containerStyle={[
                styles.poi,
                {
                  left: p.x - p.size / 2,
                  top: p.y - p.size / 2,
                  width: p.size,
                  height: p.size + 26,
                },
              ]}
              style={styles.poiInner}
              onPress={() => go(p.nav)}
            >
              {p.img && p.img() ? (
                <Image source={p.img()} resizeMode="contain" style={{ width: p.size, height: p.size }} />
              ) : (
                <Text style={{ fontSize: p.size * 0.62, textShadowColor: colors.black, textShadowRadius: 6 }}>
                  {p.emoji}
                </Text>
              )}
              <View style={styles.poiPlaque}>
                <Text style={styles.poiLabel}>{p.label}</Text>
              </View>
            </PressableScale>
          ))}
        </Animated.View>
      </View>

      {/* ── FIXED HUD ── */}
      {/* top: resources */}
      <View style={styles.hudTop} pointerEvents="box-none">
        <View style={styles.hudStrip}>
          <Text style={styles.hudRes}>💰 {player ? Number(player.gold).toLocaleString() : "—"}</Text>
          <Text style={styles.hudRes}>🔮 {player ? Number(player.mana).toLocaleString() : "—"}</Text>
          <Text style={styles.hudRes}>🏔 {player ? player.free_land : "—"}</Text>
        </View>
        <View style={styles.hudButtons}>
          <TouchableOpacity style={styles.hudBtn} onPress={() => navigation.navigate("Notifications")}>
            <Text style={styles.hudBtnTxt}>🔔</Text>
            {unread > 0 && (
              <View style={styles.hudDot}>
                <Text style={styles.hudDotTxt}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.hudBtn} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.hudBtnTxt}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* quick actions: tax + mana, straight from the map */}
      <View style={styles.quickRow} pointerEvents="box-none">
        <PressableScale style={styles.quickBtn} scaleTo={0.92} onPress={() => openAction("tax")}>
          <Text style={styles.quickIcon}>💰</Text>
          <Text style={styles.quickTxt}>Collect Taxes</Text>
        </PressableScale>
        <PressableScale style={styles.quickBtn} scaleTo={0.92} onPress={() => openAction("mana")}>
          <Text style={styles.quickIcon}>🔮</Text>
          <Text style={styles.quickTxt}>Channel Mana</Text>
        </PressableScale>
      </View>

      {/* bottom: kingdom name + exit back to classic UI */}
      <View style={styles.hudBottom} pointerEvents="box-none">
        <View style={styles.kingdomPlate}>
          <Text style={styles.kingdomName}>{player?.kingdom_name || "Your Kingdom"}</Text>
          <Text style={styles.kingdomHint}>drag to roam · tap a building to enter</Text>
        </View>
        <TouchableOpacity style={styles.exitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.exitTxt}>⌂ classic</Text>
        </TouchableOpacity>
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
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center", overflow: "hidden" } : {}),
  },
  viewport: { flex: 1, overflow: "hidden" },
  canvas: { width: MAP_W, height: MAP_H },
  mapArt: { position: "absolute", width: MAP_W, height: MAP_H },
  mapTint: { ...StyleSheet.absoluteFillObject, backgroundColor: alpha(colors.bg, "22") },

  /* POIs */
  poi: { position: "absolute" },
  poiInner: { alignItems: "center" },
  poiPlaque: {
    marginTop: 2,
    backgroundColor: alpha(colors.bg, "cc"),
    borderWidth: 1,
    borderColor: alpha(colors.gold, "66"),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  poiLabel: { color: colors.text, fontSize: 11, fontWeight: "800" },

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
  hudStrip: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: alpha(colors.bg, "cc"),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hudRes: { color: colors.text, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  hudButtons: { flexDirection: "row", gap: 8 },
  hudBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.bg, "cc"),
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  hudBtnTxt: { fontSize: 15 },
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

  hudBottom: {
    position: "absolute",
    bottom: 18,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  kingdomPlate: {
    backgroundColor: alpha(colors.bg, "cc"),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  kingdomName: { color: colors.gold, fontSize: 14, fontWeight: "800" },
  kingdomHint: { color: colors.muted, fontSize: 10, marginTop: 1 },
  exitBtn: {
    backgroundColor: alpha(colors.bg, "cc"),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  exitTxt: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  /* quick actions */
  quickRow: {
    position: "absolute",
    bottom: 74,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: alpha(colors.bg, "d9"),
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "88"),
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  quickIcon: { fontSize: 15 },
  quickTxt: { color: colors.gold, fontSize: 13, fontWeight: "800" },

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
