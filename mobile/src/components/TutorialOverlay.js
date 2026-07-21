import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import * as api from "../services/api";
import { colors, alpha } from "../theme";

const COPY = {
  welcome: { title: "Welcome, Archmage", body: "Your kingdom is small, but every empire begins with a single holding. The Steward will show you how to expand, command an army, and wield magic.", cta: "Begin the Tour" },
  explore_intro: { title: "Find New Land", body: "Your kingdom needs Land to grow. The safest way to find it is by exploring beyond your borders.", cta: "Go to Explore", nav: ["War", "explore"] },
  solo_exploration: { title: "A Solo Expedition", body: "You may explore without an escort. It costs nothing, but ordinary unprotected expeditions are dangerous. This first scout will return safely in five seconds.", cta: "Send the Scout" },
  solo_wait: { title: "The Scout Is Returning", body: "Only one expedition may be active at a time. When the scout returns, claim the reward to add its Land to your kingdom.", cta: "Claim Land", waitKey: "wait_until" },
  keep_intro: { title: "Strengthen the Keep", body: "Land gives your kingdom room to expand. Your Town Center controls how advanced every other structure may become.", cta: "Visit the Town Center", nav: ["Kingdom", "town_center"] },
  upgrade_keep: { title: "Upgrade the Town Center", body: "The Town Center itself costs gold to upgrade. Raising it to level 2 unlocks level 2 structures throughout your kingdom.", cta: "Upgrade for 1,500 Gold" },
  recruit_intro: { title: "Recruit Help", body: "Expansion becomes dangerous. Explorers are swift scouts who can locate more territory, though they are poor fighters.", cta: "Go to Recruitment", nav: ["Army", "recruit"] },
  recruit_explorers: { title: "Recruit Explorers", body: "Recruitment normally takes time and uses a recruitment slot. The Steward will instantly finish this one order.", cta: "Recruit 5 Explorers — 100 Gold" },
  send_explorers: { title: "Explore with an Escort", body: "More Explorers can discover more Land. Faster units shorten the journey, but expedition encounters may cause permanent casualties.", cta: "Send 5 Explorers", nav: ["War", "explore"] },
  barbarian_intro: { title: "Another Path to Power", body: "Exploration is not the only way to expand. Barbarian settlements hold gold, artifacts, and sometimes territory.", cta: "Find the Broken Tusk Camp", nav: ["War", "barbarians"] },
  barbarian_attack: { title: "Your First Battle", body: "The Steward has called in twenty Militia. Lead them against this tutorial camp. They will remain in your army afterward.", cta: "Attack with 20 Militia" },
  magic_intro: { title: "The Arcane Arts", body: "Armies conquer with steel. Archmages reshape kingdoms with magic. We will begin with the General spell Meditation.", cta: "Open Spell Research", nav: ["Magic", "research"] },
  research_half: { title: "Fund Research Gradually", body: "Spell research does not need to be completed at once. Invest half now; your progress will remain until you finish it.", cta: "Invest 100 Mana" },
  mana_intro: { title: "Channel Mana", body: "Mana gathers inside your kingdom over four hours. Waiting is more efficient, but you may release the charge whenever you need power. The Steward has accelerated this lesson.", cta: "Visit the Mana Core", nav: ["Home", "mana"] },
  release_mana: { title: "Release the Charge", body: "Research created room in your mana reserves. Release the half-filled channel now to replenish some of it.", cta: "Release Mana" },
  finish_research: { title: "Complete Meditation", body: "Return to your research and invest the remaining mana. Learned spells remain available permanently.", cta: "Finish Research — 100 Mana", nav: ["Magic", "research"] },
  cast_spell: { title: "Cast upon Your Kingdom", body: "Meditation uses gold when cast and improves mana production for two hours. Spell costs and durations vary.", cta: "Cast Meditation — 250 Gold", nav: ["Magic", "cast"] },
  buffs_intro: { title: "Active Enchantments", body: "Enchantments do not last forever. Inspect their strength and remaining duration from the Active spells panel.", cta: "View Active Effects", nav: ["Magic", "active"] },
  tax_intro: { title: "Fund the Realm", body: "Those new soldiers expect payment. Taxes provide immediate gold, but stronger tax policies impose longer cooldowns.", cta: "Open Tax Collection", nav: ["Home", "tax"] },
  collect_taxes: { title: "Collect Standard Taxes", body: "Standard taxes balance income and cooldown. Collect them now so the treasury can cover your army's upkeep.", cta: "Collect Standard Taxes" },
  upkeep_intro: { title: "Army Morale", body: "Morale falls over time and drains faster when your army exceeds its capacity. Paying upkeep restores it and keeps soldiers willing to fight.", cta: "Visit Your Army", nav: ["Army", "overview"] },
  pay_troops: { title: "Pay the Troops", body: "Your new militia are restless. Pay the recommended upkeep amount to restore their morale.", cta: "Pay Recommended Upkeep" },
  claim_expedition: { title: "The Explorers Return", body: "Your escorted expedition is back. As your Land grows, future searches take longer—so faster and larger parties become increasingly valuable.", cta: "Claim Expedition Rewards", nav: ["War", "explore"] },
  conclusion: { title: "Your Reign Begins", body: "You can now grow, recruit, explore, conquer, and cast magic. Your kingdom has 24 hours of protection from other players. One legend remains: a spell powerful enough to end the age itself. No Archmage has yet survived the ritual.", cta: "Begin My Reign" },
};

function navigateTo(navigationRef, destination) {
  if (!destination || !navigationRef?.isReady?.()) return;
  const [screen, subTab] = destination;
  navigationRef.navigate("MainTabs", { screen, params: { subTab } });
}

export default function TutorialOverlay({ navigationRef }) {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const { showConfirm, showPrompt } = useModal();
  const [tutorial, setTutorial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.getTutorial();
      setTutorial(data.tutorial);
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") setError(e.message);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!tutorial?.state?.wait_until) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [tutorial?.state?.wait_until]);

  const copy = tutorial ? COPY[tutorial.step] : null;
  const waitSeconds = useMemo(() => {
    const value = copy?.waitKey ? tutorial?.state?.[copy.waitKey] : null;
    return value ? Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000)) : 0;
  }, [copy, tutorial, now]);

  if (!isAuthenticated || !tutorial || tutorial.completed || !copy) return null;

  async function advance() {
    if (waitSeconds > 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!user?.has_kingdom_name) {
        const name = await showPrompt(
          'Name Your Kingdom',
          'Before the Steward begins, choose a name for your kingdom (3-15 characters, letters, numbers, and spaces).',
          { submitText: 'Claim Name', defaultValue: '' }
        );
        if (!name?.trim()) return;
        await api.updateKingdomName(name.trim());
        await refreshUser();
      }
      navigateTo(navigationRef, copy.nav);
      const data = await api.advanceTutorial(tutorial.step);
      if (data.result?.battle_result) navigationRef.navigate("BattleResult", { result: data.result.battle_result });
      setTutorial(data.tutorial);
    } catch (e) {
      setError(e.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    const confirmed = await showConfirm("Skip the Steward's Tour?", "You can learn the game on your own, but scripted tutorial rewards you have not earned will be forfeited.", { confirmText: "Skip Tutorial", destructive: true });
    if (!confirmed) return;
    setBusy(true);
    try {
      const data = await api.skipTutorial();
      setTutorial(data.tutorial);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const label = waitSeconds > 0 ? `Scout returns in ${waitSeconds}s` : copy.cta;
  const progress = Math.min(100, Math.round((tutorial.progress / tutorial.total) * 100));

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.scrim} pointerEvents="none" />
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.eyebrow}>THE STEWARD · {tutorial.progress + 1}/{tutorial.total}</Text>
            <TouchableOpacity onPress={skip} disabled={busy || !user?.has_kingdom_name} hitSlop={10}><Text style={styles.skip}>Skip</Text></TouchableOpacity>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={[styles.button, (busy || waitSeconds > 0) && styles.buttonDisabled]} onPress={advance} disabled={busy || waitSeconds > 0} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{label}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", padding: 12, paddingBottom: 22 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.62)" },
  card: { width: "100%", maxWidth: 520, backgroundColor: alpha("#171020", "fa"), borderRadius: 18, borderWidth: 1.5, borderColor: alpha(colors.gold, "99"), padding: 18, shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 30 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: colors.goldDim, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  skip: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.gold },
  title: { color: colors.gold, fontSize: 21, fontWeight: "900", marginTop: 15, letterSpacing: 0.3 },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 8 },
  error: { color: colors.dangerSoft, fontSize: 12, lineHeight: 17, marginTop: 10 },
  button: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 16, minHeight: 46, justifyContent: "center" },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: colors.bg, fontSize: 14, fontWeight: "900", textAlign: "center" },
});
