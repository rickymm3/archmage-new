import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ModalProvider } from "./src/context/ModalContext";
import AuthStack from "./src/navigation/AuthStack";
import MainTabs from "./src/navigation/MainTabs";
import DeviceFrame from "./src/components/DeviceFrame";
import { FlyEffectsProvider } from "./src/components/FlyEffects";
import TutorialOverlay from "./src/components/TutorialOverlay";
import { ActivityIndicator, View, Platform } from "react-native";

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

const navigationRef = createNavigationContainerRef();

function Root() {
  const { isAuthenticated, isLoading } = useAuth();

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
            <NavigationContainer ref={navigationRef} theme={navTheme}>
              <StatusBar style="light" />
              <Root />
            </NavigationContainer>
            <TutorialOverlay navigationRef={navigationRef} />
          </ModalProvider>
        </AuthProvider>
      </FlyEffectsProvider>
    </DeviceFrame>
  );
}
