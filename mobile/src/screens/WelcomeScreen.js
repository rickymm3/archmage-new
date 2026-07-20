import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, webColumn } from "../theme";
import { ArtPlaceholder } from "../components/ui";
import { ui as art } from "../assets";

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <ArtPlaceholder emoji="🧙" label="Game logo" size={120} source={art.logo} style={styles.logo} />
      <Text style={styles.title}>⚡ Archmage</Text>
      <Text style={styles.subtitle}>Build your empire. Master the arcane.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate("Register")}
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>
          Create Account
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...webColumn,
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logo: { marginBottom: 24 },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: colors.accent,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: 48,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryText: {
    color: colors.accent,
  },
});
