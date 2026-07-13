import React, { useState, useCallback, useRef } from "react";
import {
  Pressable,
  Animated,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { colors } from "../theme";

const NATIVE_DRIVER = Platform.OS !== "web";

/**
 * Drop-in async button: shows a spinner while the onPress promise runs
 * and springs down on press for game-like touch feedback.
 *
 * Usage:
 *   <LoadingButton style={styles.btn} onPress={handleSave}>
 *     <Text>Save</Text>
 *   </LoadingButton>
 *
 * Props:
 *   onPress  – async function (awaited automatically)
 *   spinnerColor – ActivityIndicator color (default colors.white)
 *   disabled – externally controlled disabled state
 */
export default function LoadingButton({
  onPress,
  children,
  style,
  disabled,
  spinnerColor = colors.white,
  spinnerSize = "small",
  ...rest
}) {
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(async () => {
    if (busy || !onPress) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  }, [busy, onPress]);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.95, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 8, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={busy || disabled}
      {...rest}
    >
      <Animated.View
        style={[style, (busy || disabled) && styles.disabled, { transform: [{ scale }] }]}
      >
        {busy ? <ActivityIndicator size={spinnerSize} color={spinnerColor} /> : children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
});
