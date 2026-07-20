import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import * as api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

const BAR_HEIGHT = 78;
const POWER_WIDTH = 72;
const SETTINGS_WIDTH = 46;
const RAIL_OVERLAP = 13;
const FALLBACK_WIDTH = 402;

function displayNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "—";
}

function Resource({ icon, value, label, color }) {
  return (
    <View style={styles.resource} accessibilityLabel={`${label}: ${value}`}>
      <Image source={icon} resizeMode="contain" style={styles.resourceIcon} />
      <Text
        style={[styles.resourceValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.58}
      >
        {value}
      </Text>
    </View>
  );
}

function PowerCrest({ value, onPress }) {
  return (
    <TouchableOpacity
      style={styles.powerCrest}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Kingdom power: ${value}. Open profile.`}
    >
      <Image source={art.universalHudV2PowerCrest} resizeMode="stretch" style={styles.powerCrestArt} pointerEvents="none" />
      <Text style={styles.powerValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

export default function UniversalTopBarV2({ navigation, player: suppliedPlayer }) {
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
        // Keep the authenticated user snapshot as the visual fallback.
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
  const resourceWidth = Math.max(0, width - POWER_WIDTH - SETTINGS_WIDTH);
  const railWidth = resourceWidth + RAIL_OVERLAP;

  return (
    <View style={styles.root} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Image
        source={art.universalHudV2Rail}
        resizeMode="stretch"
        style={[styles.rail, { left: POWER_WIDTH - RAIL_OVERLAP, width: railWidth }]}
        pointerEvents="none"
      />

      <PowerCrest
        value={displayNumber(player.net_power ?? player.power)}
        onPress={() => navigation?.navigate("Profile")}
      />

      <View style={[styles.resources, { width: resourceWidth }]}>
        <Resource icon={art.universalHudV2GoldIcon} value={displayNumber(player.gold)} label="Gold" color="#f4d081" />
        <Resource icon={art.universalHudV2ManaIcon} value={displayNumber(player.mana)} label="Mana" color="#d0a6ff" />
        <Resource
          icon={art.universalHudV2LandIcon}
          value={displayNumber(player.free_land ?? player.land)}
          label="Free land"
          color="#b8dc98"
        />
      </View>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation?.navigate("Settings")}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        <Image source={art.universalHudV2Settings} resizeMode="contain" style={styles.settingsArt} pointerEvents="none" />
      </TouchableOpacity>
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
    backgroundColor: alpha("#050509", "ff"),
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.goldDim, "88"),
  },
  rail: {
    position: "absolute",
    top: 5,
    height: BAR_HEIGHT - 10,
  },
  powerCrest: {
    width: POWER_WIDTH,
    height: BAR_HEIGHT,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  powerCrestArt: { position: "absolute", top: 0, left: 0, width: POWER_WIDTH, height: BAR_HEIGHT },
  powerValue: {
    width: 50,
    marginBottom: 6,
    color: "#f4d081",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    textShadowColor: colors.black,
    textShadowRadius: 3,
  },
  resources: {
    height: BAR_HEIGHT,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  resource: {
    flex: 1,
    minWidth: 0,
    height: BAR_HEIGHT - 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  resourceIcon: { width: 29, height: 29, marginRight: 1 },
  resourceValue: {
    flexShrink: 1,
    color: colors.gold,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    textShadowColor: colors.black,
    textShadowRadius: 2,
  },
  settingsButton: {
    width: SETTINGS_WIDTH,
    height: BAR_HEIGHT,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsArt: { width: 45, height: 52 },
});
