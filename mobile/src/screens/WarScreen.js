import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { FadeSlideIn } from "../components/ui";
import { colors } from "../theme";
import { sceneImage, submenuIcon } from "../assets";
import GameHubShell from "../components/GameHubShell";
import BattlesScreen from "./BattlesScreen";
import ExplorationsScreen from "./ExplorationsScreen";
import RankingsScreen from "./RankingsScreen";
import BarbariansScreen from "./BarbariansScreen";

// War hub — everything aimed at the world outside your borders:
// raid rival kingdoms, explore the wilds, size up the competition.
const SUB_TABS = [
  { key: "attack", iconSource: submenuIcon("war-attack"), label: "Attack" },
  { key: "explore", iconSource: submenuIcon("war-explore"), label: "Explore" },
  { key: "barbarians", iconSource: submenuIcon("war-barbarians"), label: "Barbarians" },
  { key: "rankings", iconSource: submenuIcon("war-rankings"), label: "Rankings" },
];

const WAR_SCENES = {
  attack: { eyebrow: "War Council", title: "Choose Your Target", subtitle: "Scout rival kingdoms and commit your forces." },
  explore: { eyebrow: "Frontier", title: "Beyond the Border", subtitle: "Send expeditions into unclaimed territory." },
  barbarians: { eyebrow: "Border Watch", title: "The Wild Camps", subtitle: "Break the raiders before they grow stronger." },
  rankings: { eyebrow: "Hall of Legends", title: "Realm Rankings", subtitle: "Measure your kingdom against the greatest powers." },
};

export default function WarScreen({ route, navigation }) {
  const [subTab, setSubTab] = useState(route?.params?.subTab || "attack");

  useEffect(() => {
    if (route?.params?.subTab) setSubTab(route.params.subTab);
  }, [route?.params?.subTab]);

  const scene = WAR_SCENES[subTab] || WAR_SCENES.attack;

  return (
    <GameHubShell
        source={sceneImage("war_camp")}
        section="War"
        title={scene.title}
        subtitle={scene.subtitle}
        tabs={SUB_TABS}
        active={subTab}
        onChange={setSubTab}
        drawerTitle={scene.eyebrow}
      >
      <FadeSlideIn key={subTab} style={{ flex: 1 }}>
        {subTab === "attack" && <BattlesScreen navigation={navigation} />}
        {subTab === "explore" && <ExplorationsScreen />}
        {subTab === "barbarians" && <BarbariansScreen navigation={navigation} />}
        {subTab === "rankings" && <RankingsScreen />}
      </FadeSlideIn>
    </GameHubShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
