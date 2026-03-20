import React, { useState, useCallback } from "react";
import { TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

/**
 * Drop-in replacement for TouchableOpacity that shows a spinner
 * while an async onPress handler is running.
 *
 * Usage:
 *   <LoadingButton style={styles.btn} onPress={handleSave}>
 *     <Text>Save</Text>
 *   </LoadingButton>
 *
 * Props:
 *   onPress  – async function (awaited automatically)
 *   spinnerColor – ActivityIndicator color (default "#fff")
 *   disabled – externally controlled disabled state
 *   ...rest – forwarded to TouchableOpacity
 */
export default function LoadingButton({
  onPress,
  children,
  style,
  disabled,
  spinnerColor = "#fff",
  spinnerSize = "small",
  ...rest
}) {
  const [busy, setBusy] = useState(false);

  const handlePress = useCallback(async () => {
    if (busy || !onPress) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  }, [busy, onPress]);

  return (
    <TouchableOpacity
      style={[style, (busy || disabled) && styles.disabled]}
      onPress={handlePress}
      disabled={busy || disabled}
      activeOpacity={0.7}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator size={spinnerSize} color={spinnerColor} />
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
});
