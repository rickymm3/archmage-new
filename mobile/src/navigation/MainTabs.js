import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CustomTabBar from "./CustomTabBar";
import HomeScreen from "../screens/HomeScreen";
import KingdomScreen from "../screens/KingdomScreen";
import ArmyScreen from "../screens/ArmyScreen";
import WarScreen from "../screens/WarScreen";
import SpellsScreen from "../screens/SpellsScreen";

// Root-stack pushes (flows and detail views)
import AttackSetupScreen from "../screens/AttackSetupScreen";
import BarbarianAttackSetupScreen from "../screens/BarbarianAttackSetupScreen";
import BattleResultScreen from "../screens/BattleResultScreen";
import BattleReplayScreen from "../screens/BattleReplayScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
// EXPERIMENTAL: pannable map home — remove with screens/KingdomMapScreen.js
import KingdomMapScreen from "../screens/KingdomMapScreen";
import UniversalTopBar from "../components/UniversalTopBarV3";

import { colors } from "../theme";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "bold" },
};

function MainTabs() {
  return (
    <Tab.Navigator
      // The 5 game-hub screens (Home/Kingdom/Army/War/Magic) draw their own
      // title inside GameHubShell's scene art — the default nav header was
      // just a wasted plain-color bar duplicating that title above it.
      screenOptions={{ ...screenOptions, headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Kingdom" component={KingdomScreen} />
      <Tab.Screen name="Army" component={ArmyScreen} />
      <Tab.Screen name="War" component={WarScreen} />
      <Tab.Screen name="Magic" component={SpellsScreen} />
    </Tab.Navigator>
  );
}

function universalHeader({ navigation }) {
  return <UniversalTopBar navigation={navigation} />;
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: true, header: universalHeader, headerTransparent: true }}
      />
      <RootStack.Screen
        name="AttackSetup"
        component={AttackSetupScreen}
        options={{ ...screenOptions, headerShown: true, title: "Attack Setup" }}
      />
      <RootStack.Screen
        name="BarbarianAttackSetup"
        component={BarbarianAttackSetupScreen}
        options={{ ...screenOptions, headerShown: true, title: "Attack Settlement" }}
      />
      <RootStack.Screen
        name="BattleResult"
        component={BattleResultScreen}
        options={{ ...screenOptions, headerShown: true, title: "Battle Result", headerLeft: () => null }}
      />
      <RootStack.Screen
        name="BattleReplay"
        component={BattleReplayScreen}
        options={{ ...screenOptions, headerShown: true, title: "Battle Replay" }}
      />
      <RootStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ ...screenOptions, headerShown: true, title: "Notifications" }}
      />
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ ...screenOptions, headerShown: true, title: "Profile" }}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ ...screenOptions, headerShown: true, title: "Settings" }}
      />
      {/* EXPERIMENTAL — immersive map home */}
      <RootStack.Screen
        name="KingdomMap"
        component={KingdomMapScreen}
        options={{ headerShown: true, header: universalHeader, headerTransparent: true, animation: "fade" }}
      />
    </RootStack.Navigator>
  );
}
