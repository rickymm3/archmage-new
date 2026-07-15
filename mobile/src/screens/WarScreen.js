import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { SubTabs, FadeSlideIn } from "../components/ui";
import { colors } from "../theme";
import BattlesScreen from "./BattlesScreen";
import ExplorationsScreen from "./ExplorationsScreen";
import RankingsScreen from "./RankingsScreen";
import BarbariansScreen from "./BarbariansScreen";

// War hub — everything aimed at the world outside your borders:
// raid rival kingdoms, explore the wilds, size up the competition.
const SUB_TABS = [
  { key: "attack", icon: "⚔️", label: "Attack" },
  { key: "explore", icon: "🧭", label: "Explore" },
  { key: "barbarians", icon: "🏕️", label: "Barbarians" },
  { key: "rankings", icon: "🏆", label: "Rankings" },
];

export default function WarScreen({ route, navigation }) {
  const [subTab, setSubTab] = useState(route?.params?.subTab || "attack");

  useEffect(() => {
    if (route?.params?.subTab) setSubTab(route.params.subTab);
  }, [route?.params?.subTab]);

  return (
    <View style={styles.container}>
      <FadeSlideIn key={subTab} style={{ flex: 1 }}>
        {subTab === "attack" && <BattlesScreen navigation={navigation} />}
        {subTab === "explore" && <ExplorationsScreen />}
        {subTab === "barbarians" && <BarbariansScreen navigation={navigation} />}
        {subTab === "rankings" && <RankingsScreen />}
      </FadeSlideIn>
      <SubTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
