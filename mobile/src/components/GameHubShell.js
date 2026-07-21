import React, { useState, useRef, useMemo, createContext, useContext } from "react";
import { View, Text, Image, StyleSheet, useWindowDimensions, Platform, TouchableOpacity, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SubTabs } from "./ui";
import { colors, alpha } from "../theme";
import { ui as art } from "../assets";
import { HEADER_HEIGHT as TOP_BAR_HEIGHT } from "./UniversalTopBarV3";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Must match ui.js's SubTabs `subTabs`/`subTabsScroll` height exactly — the
// expanded drawer needs to know how much room the sub-tab bar keeps for
// itself at the bottom of the screen.
const SUBTABS_HEIGHT = 68;

// The drawer has two sizes, and its contents are expected to adapt: a
// FIXED, non-scrolling "at a glance" layout when collapsed, and a
// scrollable full-detail layout when expanded. Content rendered inside the
// drawer reads which mode it's in (and can programmatically expand) through
// this context. Outside any shell the context is null — standalone usages
// should treat that as expanded and show their full layout.
export const DrawerContext = createContext(null);
export const useDrawer = () => useContext(DrawerContext);

// Chooses between a drawer's two layouts. Hub screens that render the
// shell THEMSELVES need this: their own render runs outside the provider
// (useDrawer would be null there), so the choice must happen in a
// component rendered inside the drawer.
export function DrawerModeSwitch({ compact, expanded }) {
  const drawer = useDrawer();
  return (drawer?.expanded ? expanded : compact) ?? null;
}

// Tappable "there's more below" affordance for collapsed drawer layouts.
// Renders nothing when the drawer is already expanded (or outside a shell).
export function DrawerExpandHint({ label = "Pull up for details" }) {
  const drawer = useDrawer();
  if (!drawer || drawer.expanded) return null;
  return (
    <TouchableOpacity style={styles.expandHint} onPress={drawer.expand} activeOpacity={0.7}>
      <Text style={styles.expandHintTxt}>▴ {label}</Text>
    </TouchableOpacity>
  );
}

// The interactive layer (plaque, drawer, sub-tabs) never grows past this —
// on a widened web frame the scene art keeps filling the full shell width
// while the playable UI stays a centered phone-shaped column. Matches the
// top bar's BAR_MAX_WIDTH and the 480 cap conventional screens use.
const CONTENT_MAX_WIDTH = 480;

// The shared full-screen game layout used by every primary navigation hub.
// Background art stays visible; conventional screen content lives in a
// bottom drawer that can scroll independently without turning the hub into
// a stack of web cards. All dimensions derive from the actual viewport.
export default function GameHubShell({
  source,
  section,
  title,
  subtitle,
  tabs,
  active,
  onChange,
  drawerTitle,
  children,
  drawerRatio = 0.19,
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState(null);
  const localWidth = layout?.width || Math.min(width, 520);
  const localHeight = layout?.height || height;
  const contentWidth = Math.min(localWidth, CONTENT_MAX_WIDTH);
  const short = localHeight < 700;
  // The universal top bar is a TRANSPARENT overlay header, so this shell's
  // box extends underneath it and localHeight includes that covered strip.
  // availableHeight is the tallest the drawer may ever be: it must stop
  // below the bar, with headroom for the collapse tab that pokes ~17px
  // above the drawer's top edge — if the drawer rises into the bar the tab
  // ends up behind it, invisible and untappable.
  const availableHeight = Math.max(120, localHeight - SUBTABS_HEIGHT - (insets.top + TOP_BAR_HEIGHT + 17 + 6));
  // Collapsed height: deliberately shallow — the scene art is the star and
  // compact layouts are built to fit a ~150px body. On squat viewports the
  // ratio floor would leave only a sliver of body under the drawer header,
  // so grow toward the expanded ceiling instead.
  const drawerHeight = Math.min(
    clamp(
      Math.max(localHeight * (short ? Math.max(drawerRatio, 0.21) : drawerRatio), Math.min(availableHeight - 20, 172)),
      148,
      190
    ),
    availableHeight
  );
  const plaqueHeight = clamp(contentWidth * 0.19, 66, 86);
  // The transparent stack header lets the scene start beneath the stat rail.
  // Absorb the plaque asset top padding into a slight overlap at the seam.
  const titleTop = insets.top + 66 - Math.round(plaqueHeight * 0.04);
  const horizontal = clamp(contentWidth * 0.12, 42, 70);

  // RN-Web doesn't reliably size an absolutely-positioned Image from
  // StyleSheet.absoluteFill (top/right/bottom/left: 0) when the parent's
  // own size comes from flex/percentage layout rather than an explicit
  // number — it falls back to the source PNG's native pixel size instead
  // of scaling to fit. Every background/frame image below is sized with
  // explicit numbers derived from the measured layout instead.
  const plaqueWidth = contentWidth - horizontal * 2;

  // RN's Image has no CSS object-position equivalent to bias a "cover" crop
  // away from center — so the scene art is rendered oversized and nudged
  // up within an overflow:hidden parent instead, revealing more of each
  // image's mid/lower content at the seam with the top bar instead of
  // whatever (often brighter sky) sits at its natural top edge, which read
  // as a harsh cut against the solid-black bar above it.
  const bgHeight = localHeight * 1.16;
  const bgShift = (bgHeight - localHeight) * 0.65;

  // The drawer can be pulled up to cover the whole scene down to the top of
  // this component's own box (the universal top bar lives above it, in a
  // separate navigator-level header, so it's already excluded from
  // localHeight) — "height" is a layout property so this animates on the
  // JS thread (useNativeDriver: false), same as ProgressBar's width
  // animation above.
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const expandedHeight = Math.max(drawerHeight, availableHeight);
  const animatedDrawerHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerHeight, expandedHeight],
  });
  // The plaque sits behind the drawer's top when expanded and its bright
  // gold text ghosts through the drawer's near-opaque background — fade it
  // away as the drawer rises (it's pointerEvents:none, purely decorative).
  const plaqueOpacity = expandAnim.interpolate({
    inputRange: [0, 0.55],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  function setDrawerExpanded(next) {
    if (next === expanded) return;
    setExpanded(next);
    Animated.timing(expandAnim, {
      toValue: next ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }
  const toggleExpanded = () => setDrawerExpanded(!expanded);

  // `short` is included so drawer content can trim its fixed collapsed
  // layout on cramped viewports (fewer rows) instead of overflowing.
  const drawerApi = useMemo(
    () => ({
      expanded,
      short,
      toggle: toggleExpanded,
      expand: () => setDrawerExpanded(true),
      collapse: () => setDrawerExpanded(false),
    }),
    [expanded, short]
  );

  return (
    <DrawerContext.Provider value={drawerApi}>
    <View style={styles.root} onLayout={(event) => setLayout(event.nativeEvent.layout)}>
      <Image source={source} resizeMode="cover" style={{ position: "absolute", top: -bgShift, left: 0, width: localWidth, height: bgHeight }} />
      {/* Bottom-only scrim (fades the scene into the drawer). The old top
          stop existed to keep the in-scene HUD readable, but that HUD now
          lives outside this component — a dark fade at the top just hid
          the art at its seam with the universal bar, which read as a
          black gap between the two. */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "transparent", alpha(colors.bg, "18"), alpha(colors.bg, "d9")]}
        locations={[0, 0.13, 0.58, 0.82]}
        style={{ position: "absolute", top: 0, left: 0, width: localWidth, height: localHeight }}
      />

      {/* Everything interactive lives in this centered phone-width column;
          only the scene art and scrim above span the shell's full width. */}
      <View style={styles.contentColumn}>
        <Animated.View
          style={[styles.titlePlaque, { top: titleTop, left: horizontal, right: horizontal, height: plaqueHeight, opacity: plaqueOpacity }]}
          pointerEvents="none"
        >
          <Image source={art.universalHudV3TitlePlaque} resizeMode="stretch" style={{ position: "absolute", top: 0, left: 0, width: plaqueWidth, height: plaqueHeight }} />
          <View style={styles.titlePlaqueInner}>
            <Text style={[styles.title, short && styles.titleShort]}>{section}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{[title, subtitle].filter(Boolean).join(" · ")}</Text>
          </View>
        </Animated.View>

        <View style={styles.spacer} pointerEvents="none" />

        <Animated.View style={[styles.drawer, { height: animatedDrawerHeight }]}>
          <TouchableOpacity
            style={styles.expandTab}
            onPress={toggleExpanded}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}
          >
            <Text style={styles.expandTabIcon}>{expanded ? "▾" : "▴"}</Text>
          </TouchableOpacity>
          <View style={styles.drawerClip}>
            <View style={styles.drawerCrown} />
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>{drawerTitle || title}</Text>
              <View style={styles.drawerLine} />
            </View>
            <View style={styles.drawerBody}>{children}</View>
          </View>
        </Animated.View>

        <SubTabs tabs={tabs} active={active} onChange={onChange} />
      </View>
    </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.bg,
    ...(Platform.OS === "web" ? { width: "100%", alignSelf: "center" } : {}),
  },
  contentColumn: {
    flex: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  titlePlaque: {
    position: "absolute",
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
  },
  titlePlaqueInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingTop: 6,
  },
  title: { color: colors.gold, fontSize: 22, lineHeight: 25, fontWeight: "900", letterSpacing: 1.6, textAlign: "center", textTransform: "uppercase", textShadowColor: colors.black, textShadowRadius: 4 },
  titleShort: { fontSize: 19 },
  subtitle: { color: colors.textDim, fontSize: 8, lineHeight: 10, textAlign: "center", marginTop: 1, maxWidth: 225 },
  spacer: { flex: 1 },
  // Border/shadow/background live on the outer shell, unclipped, so the
  // expand tab can poke out above its top edge; drawerClip is what
  // actually clips the crown/header/body to the rounded corners.
  drawer: {
    marginHorizontal: 7,
    backgroundColor: alpha("#100d18", "f0"),
    borderWidth: 1.5,
    borderColor: alpha(colors.goldDim, "88"),
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: colors.black,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 14,
  },
  drawerClip: { flex: 1, overflow: "hidden", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  expandTab: {
    position: "absolute",
    top: -17,
    alignSelf: "center",
    width: 46,
    height: 22,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    backgroundColor: alpha("#100d18", "f0"),
    borderWidth: 1.5,
    borderColor: alpha(colors.goldDim, "88"),
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  expandTabIcon: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  expandHint: { alignItems: "center", paddingVertical: 1 },
  expandHintTxt: {
    color: alpha(colors.goldDim, "99"),
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  drawerCrown: { height: 2, backgroundColor: colors.goldDim, opacity: 0.7 },
  drawerHeader: { minHeight: 24, paddingHorizontal: 10, paddingTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  drawerTitle: { color: colors.goldDim, fontSize: 9, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  drawerLine: { flex: 1, height: 1, backgroundColor: alpha(colors.goldDim, "33") },
  drawerBody: { flex: 1, overflow: "hidden" },
});
