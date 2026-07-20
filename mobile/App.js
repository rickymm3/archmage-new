import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ModalProvider, useModal } from "./src/context/ModalContext";
import AuthStack from "./src/navigation/AuthStack";
import MainTabs from "./src/navigation/MainTabs";
import DeviceFrame from "./src/components/DeviceFrame";
import { FlyEffectsProvider } from "./src/components/FlyEffects";
import { ActivityIndicator, View, Platform } from "react-native";
import { useEffect, useRef } from "react";
import * as api from "./src/services/api";

// De-webify the web build: no text selection, no tap highlight, no
// rubber-band overscroll, no I-beam cursors. Inputs stay selectable.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    * { -webkit-tap-highlight-color: transparent; }
    body {
      user-select: none;
      -webkit-user-select: none;
      overscroll-behavior: none;
      touch-action: manipulation;
      cursor: default;
    }
    input, textarea { user-select: text; -webkit-user-select: text; }
    [role="button"], a { cursor: pointer; }

    /* Every scroll area is a game panel, not a webpage — no visible
       browser scrollbar chrome, ever. Scrolling itself still works via
       touch/wheel/trackpad, this only hides the thumb/track. */
    * { scrollbar-width: none; -ms-overflow-style: none; }
    *::-webkit-scrollbar { display: none; width: 0; height: 0; }
  `;
  document.head.appendChild(style);
}

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
    <DeviceFrame>
      <FlyEffectsProvider>
        <AuthProvider>
          <ModalProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="light" />
              <Root />
            </NavigationContainer>
          </ModalProvider>
        </AuthProvider>
      </FlyEffectsProvider>
    </DeviceFrame>
  );
}
