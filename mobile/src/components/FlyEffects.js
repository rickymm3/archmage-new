// Reward juice: resources fly from where you tapped to their counter in
// the universal top bar (collect tax → coins into the gold counter,
// release mana → orbs into the mana counter).
//
// How the pieces connect:
//   - FlyEffectsProvider wraps the app and renders a pointerEvents:none
//     overlay as the LAST child, so particles draw above every screen,
//     drawer, and the header.
//   - The top bar registers its gold/mana icon centers via registerTarget
//     (window coordinates).
//   - A screen calls fly(kind, {x, y}) with the press's page coordinates.
//   - Everything is converted into overlay-local space by subtracting the
//     overlay's own window origin — on web the app sits inside DeviceFrame
//     partway down the browser window, so window coords ≠ overlay coords.
//   - subscribeHud lets the top bar refetch its numbers right as a flight
//     lands instead of waiting out its 15s poll.
import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { View, Text, Image, Animated, Easing, StyleSheet, Platform } from "react-native";
import { ui as art } from "../assets";

const NATIVE_DRIVER = Platform.OS !== "web";
const FlyContext = createContext(null);
export const useFlyEffects = () => useContext(FlyContext);

const ICON_FOR = {
  gold: () => art.universalHudV2GoldIcon,
  mana: () => art.universalHudV2ManaIcon,
};

const BURST_MS = 170;
const FLY_MS = 520;
const STAGGER_MS = 45;

function Particle({ from, to, delay, icon }) {
  // Scatter: pop up and outward a touch before homing in on the counter.
  const scatter = useRef({
    x: (Math.random() - 0.5) * 74,
    y: -26 - Math.random() * 42,
  }).current;
  const burst = useRef(new Animated.Value(0)).current;
  const flight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(burst, { toValue: 1, duration: BURST_MS, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(flight, { toValue: 1, duration: FLY_MS, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, []);

  const translateX = Animated.add(
    burst.interpolate({ inputRange: [0, 1], outputRange: [0, scatter.x] }),
    flight.interpolate({ inputRange: [0, 1], outputRange: [0, to.x - from.x - scatter.x] })
  );
  const translateY = Animated.add(
    burst.interpolate({ inputRange: [0, 1], outputRange: [0, scatter.y] }),
    flight.interpolate({ inputRange: [0, 1], outputRange: [0, to.y - from.y - scatter.y] })
  );
  const opacity = flight.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });
  const scale = flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: from.x - 9,
        top: from.y - 9,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <Image source={icon} resizeMode="contain" style={{ width: 18, height: 18 }} />
    </Animated.View>
  );
}

// Floating "+1,240" that appears above the counter as the particles land,
// holds long enough to read (the player follows the coins up and sees what
// they got), then drifts away.
const TAG_HOLD_MS = 3000;
const TAG_OUT_MS = 380;

function AmountTag({ to, label, color, appearDelay }) {
  const appear = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(appearDelay),
      Animated.spring(appear, { toValue: 1, speed: 20, bounciness: 11, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(TAG_HOLD_MS),
      Animated.timing(leave, { toValue: 1, duration: TAG_OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, []);

  const opacity = Animated.multiply(appear, leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const translateY = Animated.add(
    appear.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })
  );
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: to.x - 70,
        top: to.y - 32,
        width: 140,
        alignItems: "center",
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <View style={[tagStyles.plate, { borderColor: color }]}>
        <Text style={[tagStyles.text, { color }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const tagStyles = StyleSheet.create({
  plate: {
    backgroundColor: "rgba(5, 4, 10, 0.88)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
});

const TAG_COLOR = { gold: "#f4d081", mana: "#d0a6ff" };

let flightId = 0;

export function FlyEffectsProvider({ children }) {
  const [flights, setFlights] = useState([]);
  const targetsRef = useRef({});
  const overlayRef = useRef(null);
  const overlayOriginRef = useRef({ x: 0, y: 0 });
  const hudListenersRef = useRef(new Set());

  const measureOverlay = useCallback(() => {
    overlayRef.current?.measureInWindow?.((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) overlayOriginRef.current = { x, y };
    });
  }, []);

  const api = useMemo(
    () => ({
      // point: window coordinates of the counter icon's center
      registerTarget(kind, point) {
        targetsRef.current[kind] = point;
      },
      subscribeHud(cb) {
        hudListenersRef.current.add(cb);
        return () => hudListenersRef.current.delete(cb);
      },
      // fromWindow: window coordinates of the press (event pageX/pageY).
      // opts.amount shows a "+N" tag above the counter once coins land.
      fly(kind, fromWindow, count = 9, opts = {}) {
        const target = targetsRef.current[kind];
        const icon = ICON_FOR[kind]?.();
        if (!target || !fromWindow || !icon) return;
        const o = overlayOriginRef.current;
        const id = ++flightId;
        const landMs = BURST_MS + FLY_MS;
        setFlights((fs) => [
          ...fs,
          {
            id,
            kind,
            icon,
            from: { x: fromWindow.x - o.x, y: fromWindow.y - o.y },
            to: { x: target.x - o.x, y: target.y - o.y },
            count,
            label: opts.amount != null ? `+${Number(opts.amount).toLocaleString()}` : null,
            landMs,
          },
        ]);
        const particlesDone = count * STAGGER_MS + landMs;
        const tagDone = landMs + TAG_HOLD_MS + TAG_OUT_MS + 500;
        // Refresh the HUD as the first particles land, clean up after all.
        setTimeout(() => hudListenersRef.current.forEach((cb) => cb()), landMs + 80);
        setTimeout(() => setFlights((fs) => fs.filter((f) => f.id !== id)), Math.max(particlesDone, tagDone) + 200);
      },
    }),
    []
  );

  return (
    <FlyContext.Provider value={api}>
      {children}
      <View
        ref={overlayRef}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
        onLayout={measureOverlay}
      >
        {flights.map((f) => (
          <React.Fragment key={f.id}>
            {Array.from({ length: f.count }, (_, i) => (
              <Particle key={`${f.id}-${i}`} from={f.from} to={f.to} delay={i * STAGGER_MS} icon={f.icon} />
            ))}
            {f.label != null && (
              <AmountTag to={f.to} label={f.label} color={TAG_COLOR[f.kind] || "#f4d081"} appearDelay={f.landMs} />
            )}
          </React.Fragment>
        ))}
      </View>
    </FlyContext.Provider>
  );
}
