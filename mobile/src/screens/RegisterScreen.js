import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

const AFFINITIES = [
  { id: "pyromancer", name: "Pyromancer", color: "#e74c3c", emoji: "🔥" },
  { id: "mindweaver", name: "Mindweaver", color: "#3498db", emoji: "🧠" },
  { id: "geomancer", name: "Geomancer", color: "#2ecc71", emoji: "🌿" },
  { id: "tempest", name: "Tempest", color: "#f1c40f", emoji: "⚡" },
  { id: "voidwalker", name: "Voidwalker", color: "#95a5a6", emoji: "🌑" },
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const { showAlert } = useModal();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [color, setColor] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username || !email || !password || !color) {
      showAlert("Error", "Please fill in all fields and select an affinity");
      return;
    }
    if (password !== passwordConfirmation) {
      showAlert("Error", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password, passwordConfirmation, color });
    } catch (e) {
      showAlert("Registration Failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholderTextColor="#666"
        placeholder="ArchmageSupreme"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#666"
        placeholder="wizard@archmage.com"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#666"
        placeholder="••••••••"
      />

      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        style={styles.input}
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        secureTextEntry
        placeholderTextColor="#666"
        placeholder="••••••••"
      />

      <Text style={[styles.label, { marginTop: 24 }]}>Magic Affinity</Text>
      <View style={styles.affinityGrid}>
        {AFFINITIES.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={[
              styles.affinityCard,
              color === a.id && { borderColor: a.color, borderWidth: 2 },
            ]}
            onPress={() => setColor(a.id)}
          >
            <Text style={styles.affinityEmoji}>{a.emoji}</Text>
            <Text style={[styles.affinityName, { color: a.color }]}>
              {a.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  label: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    fontSize: 16,
  },
  affinityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  affinityCard: {
    backgroundColor: "#1a1a2e",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    width: "30%",
  },
  affinityEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  affinityName: {
    fontSize: 12,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#7c5cbf",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
