import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

const BAR_HEIGHT = 74;
const POWER_WIDTH = 78;
const ACTIONS_WIDTH = 82;
const FALLBACK_WIDTH = 402;
// Both side columns are a fixed budget in pixels, which eats a growing share
// of the bar as it narrows (leaving too little for the resource cells in
// the middle) unless they shrink too — this keeps the squeeze shared across
// the whole bar instead of dumped entirely onto the resource text.
const REFERENCE_WIDTH = 402;
const MIN_SIDE_SCALE = 0.72;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function displayNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "—";
}

function ResourceCell({ width, icon, value, color, label }) {
  // The icon takes a fixed fraction of the cell rather than a fixed pixel
  // size, so a narrow cell automatically hands more of its own room to the
  // text instead of the icon eating a constant amount regardless of how
  // little space is left.
  const iconSize = clamp(width * 0.34, 15, 22);
  return (
    <View
      style={[styles.resourceCell, { width, height: BAR_HEIGHT - 6 }]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Image
        source={art.universalHudResourceCell}
        resizeMode="stretch"
        style={{ position: "absolute", top: 0, left: 0, width, height: BAR_HEIGHT - 6 }}
        pointerEvents="none"
      />
      <View style={styles.resourceContent}>
        <Image source={icon} resizeMode="contain" style={{ width: iconSize, height: iconSize, marginRight: 3 }} />
        <Text
          style={[styles.resourceValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function PowerCrest({ value, width, scale }) {
  return (
    <View style={[styles.powerCrest, { width }]} accessibilityLabel={`Kingdom power: ${value}`}>
      <Image
        source={art.universalHudPowerCrest}
        resizeMode="contain"
        style={[styles.powerCrestArt, { width: 76 * scale, height: 72 * scale }]}
        pointerEvents="none"
      />
      <Text
        style={[styles.powerValue, { fontSize: 11 * scale, width: 52 * scale, marginBottom: 7 * scale }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
    </View>
  );
}

// Frame renders first (its own center is a solid painted disc, not a
// transparent cutout) so the avatar draws on top of it and is actually
// visible, with the frame's gold ring showing around the avatar's edge.
function ProfileButton({ onPress, scale }) {
  return (
    <TouchableOpacity
      style={[styles.profileButton, { width: 44 * scale }]}
      onPress={onPress}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Image source={art.universalHudProfileFrame} resizeMode="contain" style={{ width: 48 * scale, height: 48 * scale }} pointerEvents="none" />
      <Image source={art.avatarDefault} resizeMode="cover" style={{ position: "absolute", width: 31 * scale, height: 31 * scale, borderRadius: 16 * scale }} />
    </TouchableOpacity>
  );
}

function SettingsButton({ onPress, scale }) {
  return (
    <TouchableOpacity
      style={[styles.settingsButton, { width: 36 * scale }]}
      onPress={onPress}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
    >
      <Image source={art.universalHudSettingsFrame} resizeMode="contain" style={{ position: "absolute", width: 39 * scale, height: 39 * scale }} pointerEvents="none" />
      <Image source={art.universalHudSettingsIcon} resizeMode="contain" style={{ width: 21 * scale, height: 21 * scale }} pointerEvents="none" />
    </TouchableOpacity>
  );
}

export default function UniversalTopBar({ navigation, player: suppliedPlayer }) {
  const { user } = useAuth();
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [dashboardPlayer, setDashboardPlayer] = useState(null);

  useEffect(() => {
    if (suppliedPlayer) return undefined;
    let mounted = true;
    async function refresh() {
      try {
        const dashboard = await api.getDashboard();
        if (mounted) setDashboardPlayer(dashboard?.player || null);
      } catch (_) {
        // The authenticated user snapshot remains a safe visual fallback.
      }
    }
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [suppliedPlayer]);

  const player = suppliedPlayer || dashboardPlayer || user || {};
  const scale = clamp(width / REFERENCE_WIDTH, MIN_SIDE_SCALE, 1);
  const powerWidth = POWER_WIDTH * scale;
  const actionsWidth = ACTIONS_WIDTH * scale;
  const railWidth = Math.max(0, width - powerWidth - actionsWidth);
  const resourceWidth = railWidth / 3;
  const kingdomPower = displayNumber(player.net_power ?? player.power);

  return (
    <View style={styles.root} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <PowerCrest value={kingdomPower} width={powerWidth} scale={scale} />
      <View style={styles.resources}>
        <ResourceCell
          width={resourceWidth}
          icon={art.universalHudGoldIcon}
          value={displayNumber(player.gold)}
          color={colors.gold}
          label="Gold"
        />
        <ResourceCell
          width={resourceWidth}
          icon={art.universalHudManaIcon}
          value={displayNumber(player.mana)}
          color="#b785ff"
          label="Mana"
        />
        <ResourceCell
          width={resourceWidth}
          icon={art.universalHudLandIcon}
          value={displayNumber(player.free_land ?? player.land)}
          color="#65d46e"
          label="Free land"
        />
      </View>
      <View style={[styles.actions, { width: actionsWidth }]}>
        <ProfileButton onPress={() => navigation?.navigate("Profile")} scale={scale} />
        <SettingsButton onPress={() => navigation?.navigate("Settings")} scale={scale} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    height: BAR_HEIGHT,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 2,
    backgroundColor: alpha("#07060b", "fb"),
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.goldDim, "88"),
  },
  resources: {
    flex: 1,
    minWidth: 0,
    height: BAR_HEIGHT - 2,
    flexDirection: "row",
    alignItems: "center",
  },
  resourceCell: { position: "relative", justifyContent: "center" },
  resourceContent: {
    flex: 1,
    zIndex: 2,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  resourceValue: { flexShrink: 1, textAlign: "center", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  powerCrest: { width: POWER_WIDTH, height: BAR_HEIGHT, alignItems: "center", justifyContent: "flex-end", zIndex: 4 },
  powerCrestArt: { position: "absolute", top: 1, width: 76, height: 72 },
  powerValue: {
    width: 52,
    marginBottom: 7,
    color: colors.gold,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textShadowColor: colors.black,
    textShadowRadius: 3,
  },
  actions: { width: ACTIONS_WIDTH, height: BAR_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  profileButton: { width: 44, height: 58, alignItems: "center", justifyContent: "center" },
  settingsButton: { width: 36, height: 52, alignItems: "center", justifyContent: "center" },
});
