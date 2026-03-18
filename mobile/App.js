import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ModalProvider, useModal } from "./src/context/ModalContext";
import AuthStack from "./src/navigation/AuthStack";
import MainTabs from "./src/navigation/MainTabs";
import { ActivityIndicator, View } from "react-native";
import { useEffect, useRef } from "react";
import * as api from "./src/services/api";

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#0f0f1a", card: "#1a1a2e", border: "#2a2a4a", primary: "#7c5cbf" },
};

function Root() {
  const { isAuthenticated, isLoading, user, refreshUser } = useAuth();
  const { showPrompt, showAlert } = useModal();
  const prompted = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user && !user.has_kingdom_name && !prompted.current) {
      prompted.current = true;
      promptKingdomName();
    }
  }, [isAuthenticated, user]);

  async function promptKingdomName() {
    const name = await showPrompt(
      "Name Your Kingdom",
      "Choose a name for your kingdom (3-15 characters, letters, numbers, and spaces).",
      { submitText: "Claim Name", defaultValue: "" }
    );
    if (name === null || name.trim() === "") return;
    try {
      await api.updateKingdomName(name.trim());
      await refreshUser();
    } catch (e) {
      showAlert("Error", e.message);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#7c5cbf" />
      </View>
    );
  }

  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </ModalProvider>
    </AuthProvider>
  );
}
