// Every screen in this app is designed against one "expected" phone-shaped
// viewport. On a real device that's just... the device, so this is a
// transparent passthrough. On web (desktop browser testing), the browser
// window is rarely that shape or size, so this renders a bordered frame at
// the target aspect ratio, scaled to fit whatever window it's given —
// shrinking on small windows, capped at the reference size on large ones —
// and centers it. Screens measure their OWN rendered box via onLayout
// (see KingdomMapScreen's viewSize state) rather than the raw window, so
// anything built inside this frame is automatically correct at any size.
import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { colors, alpha } from "../theme";

const DEVICE_W = 402;
const DEVICE_H = 874;
const DEVICE_ASPECT = DEVICE_H / DEVICE_W;
const FRAME_PADDING = 24;

export default function DeviceFrame({ children }) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return <View style={styles.fill}>{children}</View>;
  }

  const maxW = Math.max(1, Math.min(DEVICE_W, winW - FRAME_PADDING * 2));
  const maxH = Math.max(1, Math.min(DEVICE_H, winH - FRAME_PADDING * 2));
  let frameW = maxW;
  let frameH = frameW * DEVICE_ASPECT;
  if (frameH > maxH) {
    frameH = maxH;
    frameW = frameH / DEVICE_ASPECT;
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.frame, { width: frameW, height: frameH }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "#050508",
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    borderWidth: 2,
    borderColor: alpha(colors.gold, "55"),
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
});
