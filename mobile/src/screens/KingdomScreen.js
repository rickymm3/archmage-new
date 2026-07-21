import React, { useState, useEffect } from "react";
import { FadeSlideIn } from "../components/ui";
import { ui as art, submenuIcon } from "../assets";
import GameHubShell from "../components/GameHubShell";
import TownScreen from "./TownScreen";

// Kingdom is structure-first. Economy actions live on Home; selecting a
// building keeps the kingdom scene in place and opens its existing details.
const SUB_TABS = [
  { key: "town_center", iconSource: submenuIcon("kingdom-keep"), label: "Keep" },
  { key: "barracks", iconSource: submenuIcon("kingdom-barracks"), label: "Barracks" },
  { key: "bank", iconSource: submenuIcon("kingdom-bank"), label: "Bank" },
  { key: "mana_core", iconSource: submenuIcon("kingdom-core"), label: "Core" },
  { key: "altar", iconSource: submenuIcon("kingdom-altar"), label: "Altar" },
  { key: "farm", iconSource: submenuIcon("kingdom-farm"), label: "Farm" },
  { key: "field_camp", iconSource: submenuIcon("kingdom-camp"), label: "Camp" },
];

// `market` lived here before moving to the Home hub — old deep links land
// on the Keep instead of an empty structure panel.
const LEGACY_TABS = { town: "town_center", tax: "bank", mana: "mana_core", market: "town_center" };
const STRUCTURE_TITLES = {
  town_center: ["Royal Keep", "Govern and strengthen the heart of your realm."],
  barracks: ["Royal Barracks", "Train soldiers and expand your army capacity."],
  bank: ["Crown Treasury", "Protect the kingdom's gold and improve its yield."],
  mana_core: ["Mana Core", "Focus arcane production for the entire realm."],
  altar: ["High Altar", "Empower magic through ancient rites."],
  farm: ["Royal Farms", "Feed your people and support a larger kingdom."],
  field_camp: ["Field Camp", "House troops close to the frontier."],
};


export default function KingdomScreen({ route }) {
  const requested = route?.params?.subTab;
  const [subTab, setSubTab] = useState(LEGACY_TABS[requested] || requested || "town_center");

  useEffect(() => {
    if (route?.params?.subTab) {
      setSubTab(LEGACY_TABS[route.params.subTab] || route.params.subTab);
    }
  }, [route?.params?.subTab]);

  const [title, subtitle] = STRUCTURE_TITLES[subTab] || STRUCTURE_TITLES.town_center;

  return (
    <GameHubShell
      source={art.kingdomBackground}
      section="Kingdom"
      title={title}
      subtitle={subtitle}
      tabs={SUB_TABS}
      active={subTab}
      onChange={setSubTab}
      drawerTitle={SUB_TABS.find((tab) => tab.key === subTab)?.label}
    >
      <FadeSlideIn key={subTab} style={{ flex: 1 }}>
        <TownScreen selectedSlug={subTab} compact />
      </FadeSlideIn>
    </GameHubShell>
  );
}
