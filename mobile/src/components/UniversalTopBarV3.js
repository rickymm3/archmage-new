import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useFlyEffects } from "./FlyEffects";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

// Exported so GameHubShell (which renders underneath this transparent
// overlay header) knows how much top clearance its expanded drawer needs.
export const HEADER_HEIGHT = 76;
// The bar caps itself at the same centered column width the game shells
// use — on a widened web frame the scene art fills the sides while the
// HUD stays aligned with the playable UI beneath it.
const BAR_MAX_WIDTH = 480;
const SHIELD_WIDTH = 70;
const AVATAR_WIDTH = 48;
const SETTINGS_WIDTH = 44;
const EDGE_GUTTER = 7;
const FALLBACK_WIDTH = 402;
// The shield/avatar/settings columns are a fixed pixel budget, which eats a
// growing share of the bar as it narrows unless they shrink too — this
// keeps a narrow window's squeeze shared across the whole bar instead of
// dumped entirely onto the resource values in the middle.
const REFERENCE_WIDTH = 402;
const MIN_SIDE_SCALE = 0.62;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function displayNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "—";
}

function Resource({ icon, value, label, color, cellWidth, innerRef }) {
  const iconSize = clamp(cellWidth * 0.3, 14, 24);
  return (
    <View ref={innerRef} style={styles.resource} accessibilityLabel={`${label}: ${value}`}>
      <Image source={icon} resizeMode="contain" style={{ width: iconSize, height: iconSize, marginRight: 1 }} />
      <Text
        style={[styles.resourceValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
    </View>
  );
}

function PowerShield({ value, onPress, width, scale }) {
  return (
    <TouchableOpacity
      style={[styles.powerShield, { width }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Kingdom power: ${value}. Open profile.`}
    >
      <Image source={art.universalHudV3PowerShield} resizeMode="stretch" style={[styles.powerShieldArt, { width }]} pointerEvents="none" />
      {/* The shield art is squashed very short to fit the bar, so its lower
          body tapers to a narrow point fast — a plain margin-positioned
          number ends up wider than that point and reads as spilling off
          the shield. A small background plate behind the value means it
          always reads as an intentional banner regardless of how narrow
          the art gets behind it. */}
      <View style={[styles.powerValuePlate, { marginBottom: 14 * scale, paddingHorizontal: 6 * scale, paddingVertical: 1 * scale }]}>
        <Text
          style={[styles.powerValue, { fontSize: 10 * scale, lineHeight: 12 * scale, width: 46 * scale }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function AvatarButton({ onPress, width, scale }) {
  return (
    <TouchableOpacity
      style={[styles.avatarButton, { width }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Image source={art.universalHudV3AvatarFrame} resizeMode="contain" style={{ position: "absolute", width: 50 * scale, height: 54 * scale }} pointerEvents="none" />
      <Image source={art.avatarDefault} resizeMode="cover" style={{ width: 32 * scale, height: 32 * scale, borderRadius: 16 * scale }} />
    </TouchableOpacity>
  );
}

export default function UniversalTopBarV3({ navigation, player: suppliedPlayer }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const flyFx = useFlyEffects();
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [dashboardPlayer, setDashboardPlayer] = useState(null);
  // Bumped when a fly-to-HUD effect lands so the counters update right
  // away instead of waiting out the 15s poll.
  const [hudTick, setHudTick] = useState(0);
  const goldCellRef = useRef(null);
  const manaCellRef = useRef(null);

  useEffect(() => flyFx?.subscribeHud?.(() => setHudTick((t) => t + 1)), [flyFx]);

  useEffect(() => {
    if (suppliedPlayer) return undefined;
    let mounted = true;
    async function refresh() {
      try {
        const dashboard = await api.getDashboard();
        if (mounted) setDashboardPlayer(dashboard?.player || null);
      } catch (_) {
        // Keep the authenticated user snapshot as the visual fallback.
      }
    }
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [suppliedPlayer, hudTick]);

  // Tell FlyEffects where the gold/mana counters sit (window coords) so
  // collected resources know where to land. Re-measured whenever the bar
  // relayouts (width changes, safe-area shifts).
  const measureFlyTargets = useCallback(() => {
    if (!flyFx) return;
    requestAnimationFrame(() => {
      goldCellRef.current?.measureInWindow?.((x, y, w, h) => {
        if (Number.isFinite(x)) flyFx.registerTarget("gold", { x: x + w / 2, y: y + h / 2 });
      });
      manaCellRef.current?.measureInWindow?.((x, y, w, h) => {
        if (Number.isFinite(x)) flyFx.registerTarget("mana", { x: x + w / 2, y: y + h / 2 });
      });
    });
  }, [flyFx]);

  const player = suppliedPlayer || dashboardPlayer || user || {};
  const scale = clamp(width / REFERENCE_WIDTH, MIN_SIDE_SCALE, 1);
  const shieldWidth = SHIELD_WIDTH * scale;
  const avatarWidth = AVATAR_WIDTH * scale;
  const settingsWidth = SETTINGS_WIDTH * scale;
  const resourcesWidth = Math.max(0, width - shieldWidth - avatarWidth - settingsWidth - EDGE_GUTTER);
  const cellWidth = resourcesWidth / 3;
  // The rail used to stop short of the settings button, leaving it
  // floating alone against the bar's plain background instead of looking
  // like part of the same fixture — extending it to nearly the full width
  // carries the decorative surround behind settings too.
  const railLeft = Math.max(5, shieldWidth - 15 * scale);
  const railWidth = Math.max(0, width - railLeft - EDGE_GUTTER);

  return (
    // The spacer strip above the bar keeps its content below a phone's
    // camera/notch on native (insets.top is 0 on web) — the little
    // intentional dark space at the top. A plain sibling strip rather than
    // paddingTop because RN's Yoga offsets absolute children (the rail) by
    // parent padding, unlike web CSS, which would double-shift it on native.
    <View
      style={styles.root}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
        measureFlyTargets();
      }}
    >
      {insets.top > 0 && <View style={{ height: insets.top }} />}
      <View style={styles.bar}>
      <Image
        source={art.universalHudV4StatRail}
        resizeMode="stretch"
        style={[styles.statRail, { left: railLeft, width: railWidth }]}
        pointerEvents="none"
      />

      <PowerShield
        value={displayNumber(player.net_power ?? player.power)}
        onPress={() => navigation?.navigate("Profile")}
        width={shieldWidth}
        scale={scale}
      />

      <View style={[styles.resources, { width: resourcesWidth }]}>
        <Resource innerRef={goldCellRef} icon={art.universalHudV2GoldIcon} value={displayNumber(player.gold)} label="Gold" color="#f4d081" cellWidth={cellWidth} />
        <Resource innerRef={manaCellRef} icon={art.universalHudV2ManaIcon} value={displayNumber(player.mana)} label="Mana" color="#d0a6ff" cellWidth={cellWidth} />
        <Resource
          icon={art.universalHudV2LandIcon}
          value={displayNumber(player.free_land ?? player.land)}
          label="Free land"
          color="#b8dc98"
          cellWidth={cellWidth}
        />
      </View>

      <AvatarButton onPress={() => navigation?.navigate("Profile")} width={avatarWidth} scale={scale} />

      {/* Sized to sit within the rail band (not poking past its top and
          bottom borders), with a step back from the screen edge so it
          reads as mounted on the rail rather than pinned to the corner. */}
      <TouchableOpacity
        style={[styles.settingsButton, { width: settingsWidth }]}
        onPress={() => navigation?.navigate("Settings")}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        <Image source={art.universalHudV3Settings} resizeMode="contain" style={{ width: 36 * scale, height: 40 * scale, marginRight: 8 * scale }} pointerEvents="none" />
      </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    backgroundColor: "transparent",
    ...(Platform.OS === "web" ? { maxWidth: BAR_MAX_WIDTH, alignSelf: "center" } : {}),
  },
  bar: {
    width: "100%",
    height: HEADER_HEIGHT,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  statRail: {
    position: "absolute",
    top: 9,
    height: 60,
    zIndex: 1,
  },
  powerShield: {
    width: SHIELD_WIDTH,
    height: HEADER_HEIGHT,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  powerShieldArt: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SHIELD_WIDTH,
    height: HEADER_HEIGHT,
  },
  powerValuePlate: {
    zIndex: 5,
    backgroundColor: alpha("#000000", "70"),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: alpha("#f4d081", "55"),
  },
  powerValue: {
    color: "#f4d081",
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    textShadowColor: colors.black,
    textShadowRadius: 3,
  },
  resources: {
    height: HEADER_HEIGHT,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 1,
  },
  resource: {
    flex: 1,
    minWidth: 0,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
  },
  resourceValue: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    textShadowColor: colors.black,
    textShadowRadius: 2,
  },
  avatarButton: {
    width: AVATAR_WIDTH,
    height: HEADER_HEIGHT,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsButton: {
    width: SETTINGS_WIDTH,
    height: HEADER_HEIGHT,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
