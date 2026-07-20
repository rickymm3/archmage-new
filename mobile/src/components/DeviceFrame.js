// Every screen in this app is designed against one "expected" phone-shaped
// viewport. On a real device that's just... the device, so this is a
// transparent passthrough. On web (desktop browser testing), the browser
// window is rarely that shape or size, so this renders a bordered frame,
// scaled to fit whatever window it's given, and centers it. The frame is
// allowed to grow WIDER than the reference phone shape: screens keep their
// interactive UI in a centered phone-width column and let background art
// bleed outward to fill the extra width, so a wide window shows more scene
// instead of a stretched app. Screens measure their OWN rendered box via
// onLayout (see KingdomMapScreen's viewSize state) rather than the raw
// window, so anything built inside this frame is correct at any size.
import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { colors, alpha } from "../theme";

const DEVICE_W = 432;
const DEVICE_H = 910;
const DEVICE_ASPECT = DEVICE_H / DEVICE_W;
const FRAME_PADDING = 24;
// The widest the frame may grow. Scene art is portrait-ish — much past
// double the reference width, a "cover" crop is zoomed into a narrow
// horizontal band of the image and stops reading as a scene.
const FRAME_MAX_W = 900;

export default function DeviceFrame({ children }) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return <View style={styles.fill}>{children}</View>;
  }

  let frameW = Math.max(1, Math.min(FRAME_MAX_W, winW - FRAME_PADDING * 2));
  let frameH = Math.max(1, Math.min(DEVICE_H, winH - FRAME_PADDING * 2));
  // Windows narrower than the reference still shrink like a phone — keep
  // the reference aspect so the UI column isn't squeezed into a sliver.
  if (frameW < DEVICE_W) frameH = Math.min(frameH, frameW * DEVICE_ASPECT);

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
