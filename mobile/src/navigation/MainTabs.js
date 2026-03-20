import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";

import HomeScreen from "../screens/HomeScreen";
import TownScreen from "../screens/TownScreen";
import ArmyScreen from "../screens/ArmyScreen";
import DefenseScreen from "../screens/DefenseScreen";
import SpellsScreen from "../screens/SpellsScreen";
import MoreScreen from "../screens/MoreScreen";

// Sub-screens accessible from More
import BattlesScreen from "../screens/BattlesScreen";
import AttackSetupScreen from "../screens/AttackSetupScreen";
import BattleResultScreen from "../screens/BattleResultScreen";
import ExplorationsScreen from "../screens/ExplorationsScreen";
import MarketplaceScreen from "../screens/MarketplaceScreen";
import TreasuryScreen from "../screens/TreasuryScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import RankingsScreen from "../screens/RankingsScreen";
import ActiveSpellsScreen from "../screens/ActiveSpellsScreen";
import RecruitScreen from "../screens/RecruitScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();
const ArmyStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: "#1a1a2e" },
  headerTintColor: "#e0e0e0",
  headerTitleStyle: { fontWeight: "bold" },
};

function TabIcon({ label, focused }) {
  const icons = {
    Home: "🏠",
    Town: "🏰",
    Army: "⚔️",
    Spells: "✨",
    Treasury: "💰",
    More: "☰",
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] || "•"}
    </Text>
  );
}

function ArmyStackNavigator() {
  return (
    <ArmyStack.Navigator screenOptions={screenOptions}>
      <ArmyStack.Screen name="ArmyMain" component={ArmyScreen} options={{ title: "Army" }} />
      <ArmyStack.Screen name="Defense" component={DefenseScreen} options={{ title: "Set Up Defense" }} />
      <ArmyStack.Screen name="Recruit" component={RecruitScreen} options={{ title: "Recruit Units" }} />
    </ArmyStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={screenOptions}>
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ title: "More" }} />
      <MoreStack.Screen name="Battles" component={BattlesScreen} />
      <MoreStack.Screen name="AttackSetup" component={AttackSetupScreen} options={{ title: "Attack Setup" }} />
      <MoreStack.Screen name="BattleResult" component={BattleResultScreen} options={{ title: "Battle Result", headerLeft: () => null }} />
      <MoreStack.Screen name="Marketplace" component={MarketplaceScreen} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} />
      <MoreStack.Screen name="Rankings" component={RankingsScreen} />
      <MoreStack.Screen name="ActiveSpells" component={ActiveSpellsScreen} options={{ title: "Active Spells" }} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarStyle: { backgroundColor: "#1a1a2e", borderTopColor: "#333" },
        tabBarActiveTintColor: "#7c5cbf",
        tabBarInactiveTintColor: "#888",
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Town" component={TownScreen} />
      <Tab.Screen name="Army" component={ArmyStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Spells" component={SpellsScreen} />
      <Tab.Screen name="Treasury" component={TreasuryScreen} />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="Explorations"
        component={ExplorationsScreen}
        options={{ ...screenOptions, headerShown: true, title: "Explorations" }}
      />
    </RootStack.Navigator>
  );
}
