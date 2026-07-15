// Bottom tab bar — one seamless background image with 5 equal-width
// interactive zones overlaid for our real tabs (Home/Kingdom/Army/War/
// Magic). An earlier version tried to piece the bar together from separate
// left/spacing/middle/spacing/right art fragments, but each piece carries
// its own independent shading/vignette, so stretching them side by side
// produced visible seams and color mismatches instead of one cohesive
// frame. Compositing per-tab (rather than five flattened tab icons) is what
// makes per-tab active-state highlighting possible.
//
// Two exports: `TabBarVisual` is the generic, reusable bar (name list +
// active index + a press callback) — used here as the real React Navigation
// tab bar, and also standalone on KingdomMapScreen (a root-stack screen
// outside the Tab.Navigator, which wants the same bar/highlight look without
// real tab-navigation state). `CustomTabBar` (default export) is the thin
// adapter React Navigation's `tabBar` render prop expects.
import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, Dimensions } from "react-native";
import { ui as art } from "../assets";
import { colors, alpha } from "../theme";

export const TAB_NAMES = ["Home", "Kingdom", "Army", "War", "Magic"];

const TAB_ICONS = {
  Home: "🏠",
  Kingdom: "👑",
  Army: "⚔️",
  War: "🔥",
  Magic: "✨",
};

// menu-bar-bg.png (cropped from menu-empty.png) is 1536x452 natively, but
// rendered with resizeMode="stretch" below — so height doesn't have to
// track that aspect ratio. Capping it well short of the natural aspect
// keeps the bar compact (full width, shallow height) instead of the tall
// slab the source art's own proportions would otherwise give it.
const BAR_ASPECT = 1536 / 452;
const { width: SCREEN_W } = Dimensions.get("window");
const BAR_WIDTH = Math.min(SCREEN_W, 480) * 0.96;
const BAR_HEIGHT = Math.min(BAR_WIDTH / BAR_ASPECT, 62);

function TabSlot({ name, isActive, onPress }) {
  return (
    <TouchableOpacity style={styles.slotTouchable} onPress={onPress} activeOpacity={0.75}>
      {isActive && <View style={styles.activeGlow} pointerEvents="none" />}
      <Text style={[styles.icon, { opacity: isActive ? 1 : 0.55 }]}>{TAB_ICONS[name] || "•"}</Text>
      <Text style={[styles.label, isActive && styles.labelActive]}>{name.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

export function TabBarVisual({ names = TAB_NAMES, activeIndex, onPress }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.barBox}>
        <Image source={art.menuBarBg} style={styles.barImg} resizeMode="stretch" />
        <View style={styles.slotsRow}>
          {names.map((name, i) => (
            <TabSlot key={name} name={name} isActive={activeIndex === i} onPress={() => onPress(name, i)} />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function CustomTabBar({ state, navigation }) {
  return (
    <TabBarVisual
      names={state.routes.map((r) => r.name)}
      activeIndex={state.index}
      onPress={(name, i) => {
        const route = state.routes[i];
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (state.index !== i && !event.defaultPrevented) navigation.navigate(route.name);
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: Platform.OS === "web" ? 4 : 18,
  },
  barBox: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
  },
  barImg: { width: "100%", height: "100%" },
  slotsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    paddingHorizontal: "6%",
  },
  slotTouchable: { flex: 1, alignItems: "center", justifyContent: "center" },
  activeGlow: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 2,
    right: 2,
    borderRadius: 10,
    backgroundColor: alpha(colors.gold, "22"),
  },
  icon: { fontSize: 17 },
  label: { color: colors.muted, fontSize: 8, fontWeight: "800", marginTop: 2, letterSpacing: 0.3 },
  labelActive: { color: colors.gold },
});
