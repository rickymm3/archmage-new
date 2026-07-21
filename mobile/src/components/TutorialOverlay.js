// The Steward — a spotlight/coach-mark tutorial. Instead of one menu card,
// it dims the screen, cuts a glowing hole over the REAL tab or sub-tab the
// player should tap, and anchors a small explanation bubble beside it. The
// backend (Tutorials::ProgressService) still drives step order and performs
// scripted actions; this component is purely the guided presentation.
//
// Two presentation modes per step:
//   · spotlight — the step navigates somewhere (COPY.nav). We highlight the
//     tab (or, once on that screen, the sub-tab) so the player learns the
//     route by tapping it. Tapping the hole OR the bubble button advances.
//   · bubble — informational or in-drawer action steps with no nav target:
//     a compact centered/near-drawer card with the action button.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { useTutorialRegistry } from "./TutorialTarget";
import * as api from "../services/api";
import { colors, alpha } from "../theme";

const NATIVE_DRIVER = Platform.OS !== "web";

// nav: [screen, subTab] — the destination this step teaches.
// waitKey: countdown gate (solo scout return). cta: button label.
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

function measureOrigin(node) {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== "function") return resolve(null);
    try {
      node.measureInWindow((x, y) => resolve(Number.isFinite(x) ? { x, y } : null));
    } catch (_) {
      resolve(null);
    }
  });
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function TutorialOverlay({ navigationRef }) {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const { showConfirm, showPrompt } = useModal();
  const registry = useTutorialRegistry();

  const [tutorial, setTutorial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [rect, setRect] = useState(null); // spotlight hole in overlay-local coords
  const [size, setSize] = useState({ w: 0, h: 0 });

  const containerRef = useRef(null);
  const lastRect = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

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

  const copy = tutorial ? COPY[tutorial.step] : null;
  const active = !!(isAuthenticated && tutorial && !tutorial.completed && copy);

  // Countdown ticker for gated steps (solo scout).
  useEffect(() => {
    if (!tutorial?.state?.wait_until) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [tutorial?.state?.wait_until]);

  const waitSeconds = useMemo(() => {
    const value = copy?.waitKey ? tutorial?.state?.[copy.waitKey] : null;
    return value ? Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000)) : 0;
  }, [copy, tutorial, now]);

  // Fade the overlay in/out as steps come and go.
  useEffect(() => {
    Animated.timing(fade, { toValue: active ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start();
  }, [active, fade]);

  // Perpetual pulse for the highlight ring.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Candidate targets for the current step: prefer the sub-tab (only
  // measurable once its screen is mounted, i.e. we're already there),
  // then fall back to the main tab.
  const candidates = useMemo(() => {
    if (!copy?.nav) return [];
    const [screen, subTab] = copy.nav;
    const ids = [];
    if (subTab) ids.push(`subtab:${subTab}`);
    ids.push(`tab:${screen}`);
    return ids;
  }, [copy]);

  // Re-measure on a light interval so the hole tracks navigation, mounting,
  // and drawer animation without wiring layout events across every screen.
  useEffect(() => {
    if (!active || candidates.length === 0 || !registry) {
      lastRect.current = null;
      setRect(null);
      return undefined;
    }
    // Fresh step → forget the previous target so the first match commits.
    lastRect.current = null;
    let cancelled = false;
    // Only push state when the rect meaningfully moved — the poll runs
    // often (to track nav/drawer animation) but positions rarely change.
    function commit(next) {
      if (cancelled) return;
      const prev = lastRect.current;
      const same =
        (!prev && !next) ||
        (prev && next &&
          Math.abs(prev.x - next.x) < 1 && Math.abs(prev.y - next.y) < 1 &&
          Math.abs(prev.w - next.w) < 1 && Math.abs(prev.h - next.h) < 1);
      if (same) return;
      lastRect.current = next;
      setRect(next);
    }
    async function tick() {
      const origin = await measureOrigin(containerRef.current);
      if (!origin || cancelled) return;
      for (const id of candidates) {
        const r = await registry.measure(id);
        if (r) return commit({ x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h });
      }
      commit(null); // target not mounted yet → bubble fallback
    }
    tick();
    const t = setInterval(tick, 300);
    return () => { cancelled = true; clearInterval(t); };
  }, [active, candidates, registry]);

  if (!active) return null;

  async function advance() {
    if (waitSeconds > 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!user?.has_kingdom_name) {
        const name = await showPrompt(
          "Name Your Kingdom",
          "Before the Steward begins, choose a name for your kingdom (3-15 characters, letters, numbers, and spaces).",
          { submitText: "Claim Name", defaultValue: "" }
        );
        if (!name?.trim()) return;
        await api.updateKingdomName(name.trim());
        await refreshUser();
      }
      navigateTo(navigationRef, copy.nav);
      const data = await api.advanceTutorial(tutorial.step);
      if (data.result?.battle_result) navigationRef.navigate("BattleResult", { result: data.result.battle_result });
      setTutorial(data.tutorial);
      setRect(null);
    } catch (e) {
      setError(e.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    const confirmed = await showConfirm(
      "Skip the Steward's Tour?",
      "You can learn the game on your own, but scripted tutorial rewards you have not earned will be forfeited.",
      { confirmText: "Skip Tutorial", destructive: true }
    );
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

  const canSkip = !busy && !!user?.has_kingdom_name;
  const label = waitSeconds > 0 ? `Scout returns in ${waitSeconds}s` : copy.cta;
  const disabled = busy || waitSeconds > 0;
  const stepNum = (tutorial.progress ?? 0) + 1;

  const { w: W, h: H } = size;
  const spotlight = !!(copy.nav && rect && W > 0);

  // Bubble content shared by both modes. A plain render function (not a
  // nested component) so the frequent re-measures reconcile in place rather
  // than remounting the subtree and dropping an in-flight tap.
  const renderBubble = ({ style, pointer } = {}) => (
    <View style={[styles.bubble, style]}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>THE STEWARD · {stepNum}/{tutorial.total}</Text>
        <TouchableOpacity onPress={skip} disabled={!canSkip} hitSlop={10}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      {spotlight && !disabled && (
        <Text style={styles.tapHint}>{pointer} Tap the highlighted button, or:</Text>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={advance}
        disabled={disabled}
        activeOpacity={0.85}
      >
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{label}</Text>}
      </TouchableOpacity>
    </View>
  );

  // ── spotlight geometry ──
  let holeContent = null;
  if (spotlight) {
    const P = 8;
    const hx = clamp(rect.x - P, 0, W);
    const hy = clamp(rect.y - P, 0, H);
    const hw = Math.min(rect.w + P * 2, W - hx);
    const hh = Math.min(rect.h + P * 2, H - hy);

    const holeCX = hx + hw / 2;
    const bubbleW = Math.min(320, W - 24);
    const bubbleLeft = clamp(holeCX - bubbleW / 2, 12, W - bubbleW - 12);
    // Targets live low (tab bar / sub-tabs) → bubble sits above them.
    const above = hy > H * 0.5;

    const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
    const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.45] });

    holeContent = (
      <>
        {/* four scrim panels around the lit target */}
        <View style={[styles.scrim, { left: 0, top: 0, right: 0, height: hy }]} />
        <View style={[styles.scrim, { left: 0, top: hy + hh, right: 0, bottom: 0 }]} />
        <View style={[styles.scrim, { left: 0, top: hy, width: hx, height: hh }]} />
        <View style={[styles.scrim, { left: hx + hw, top: hy, right: 0, height: hh }]} />

        {/* glowing ring around the target */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: hx, top: hy, width: hw, height: hh, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />

        {/* tap-through zone: doing the step from the real element's spot */}
        <Pressable
          style={{ position: "absolute", left: hx, top: hy, width: hw, height: hh }}
          onPress={advance}
          disabled={disabled}
        />

        <View style={{ position: "absolute", left: bubbleLeft, width: bubbleW, [above ? "bottom" : "top"]: above ? H - hy + 14 : hy + hh + 14 }}>
          {renderBubble({ pointer: above ? "▾" : "▴" })}
        </View>
      </>
    );
  }

  return (
    // Outer plain View is the measurement anchor (reliable measureInWindow);
    // the inner Animated.View carries the fade so measurement is unaffected.
    <View
      ref={containerRef}
      pointerEvents="box-none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, styles.root]}
    >
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        {spotlight ? (
          holeContent
        ) : (
          // Bubble mode: full dim + centered card (welcome/conclusion) or a
          // near-drawer card for in-place action steps.
          <>
            <View style={[styles.scrim, StyleSheet.absoluteFill]} />
            <View style={styles.bubbleModeWrap} pointerEvents="box-none">
              {renderBubble({ style: styles.bubbleCentered })}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000 },
  scrim: { position: "absolute", backgroundColor: "rgba(6,4,12,0.8)" },
  ring: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.gold,
    backgroundColor: alpha(colors.gold, "14"),
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  bubbleModeWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18 },
  bubble: {
    backgroundColor: alpha("#171020", "fb"),
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: alpha(colors.gold, "99"),
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 24,
  },
  bubbleCentered: { width: "100%", maxWidth: 460 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: colors.goldDim, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  skip: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  title: { color: colors.gold, fontSize: 18, fontWeight: "900", marginTop: 10, letterSpacing: 0.3 },
  body: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  tapHint: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 10 },
  error: { color: colors.dangerSoft, fontSize: 12, lineHeight: 17, marginTop: 8 },
  button: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12, minHeight: 44, justifyContent: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.bg, fontSize: 14, fontWeight: "900", textAlign: "center" },
});
