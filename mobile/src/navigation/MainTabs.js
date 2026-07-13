import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";

import HomeScreen from "../screens/HomeScreen";
import KingdomScreen from "../screens/KingdomScreen";
import ArmyScreen from "../screens/ArmyScreen";
import WarScreen from "../screens/WarScreen";
import SpellsScreen from "../screens/SpellsScreen";

// Root-stack pushes (flows and detail views)
import AttackSetupScreen from "../screens/AttackSetupScreen";
import BattleResultScreen from "../screens/BattleResultScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
// EXPERIMENTAL: pannable map home — remove with screens/KingdomMapScreen.js
import KingdomMapScreen from "../screens/KingdomMapScreen";

import { colors } from "../theme";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "bold" },
};

function TabIcon({ label, focused }) {
  const icons = {
    Home: "🏠",
    Kingdom: "👑",
    Army: "⚔️",
    War: "🔥",
    Magic: "✨",
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] || "•"}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Kingdom" component={KingdomScreen} />
      <Tab.Screen name="Army" component={ArmyScreen} />
      <Tab.Screen name="War" component={WarScreen} />
      <Tab.Screen name="Magic" component={SpellsScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="AttackSetup"
        component={AttackSetupScreen}
        options={{ ...screenOptions, headerShown: true, title: "Attack Setup" }}
      />
      <RootStack.Screen
        name="BattleResult"
        component={BattleResultScreen}
        options={{ ...screenOptions, headerShown: true, title: "Battle Result", headerLeft: () => null }}
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
      {/* EXPERIMENTAL — immersive map home (no header, full screen) */}
      <RootStack.Screen
        name="KingdomMap"
        component={KingdomMapScreen}
        options={{ headerShown: false, animation: "fade" }}
      />
    </RootStack.Navigator>
  );
}
