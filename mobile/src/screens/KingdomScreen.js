import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { SubTabs, FadeSlideIn } from "../components/ui";
import { colors } from "../theme";
import TownScreen from "./TownScreen";
import TreasuryScreen from "./TreasuryScreen";
import MarketplaceScreen from "./MarketplaceScreen";

// Kingdom hub — everything about running your realm:
// build it, tax it, channel its mana, trade on the black market.
const SUB_TABS = [
  { key: "town", icon: "🏰", label: "Town" },
  { key: "tax", icon: "💰", label: "Tax" },
  { key: "mana", icon: "🔮", label: "Mana" },
  { key: "market", icon: "🛒", label: "Market" },
];

export default function KingdomScreen({ route }) {
  const [subTab, setSubTab] = useState(route?.params?.subTab || "town");

  useEffect(() => {
    if (route?.params?.subTab) setSubTab(route.params.subTab);
  }, [route?.params?.subTab]);

  return (
    <View style={styles.container}>
      <FadeSlideIn key={subTab} style={{ flex: 1 }}>
        {subTab === "town" && <TownScreen />}
        {subTab === "tax" && <TreasuryScreen fixedTab="tax" />}
        {subTab === "mana" && <TreasuryScreen fixedTab="mana" />}
        {subTab === "market" && <MarketplaceScreen />}
      </FadeSlideIn>
      <SubTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
