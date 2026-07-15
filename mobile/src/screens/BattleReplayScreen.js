import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { ProgressBar, PressableScale, FadeSlideIn, Badge } from "../components/ui";
import { TYPE_ICONS, ELEM_COLORS } from "../battleVisuals";
import { colors, alpha } from "../theme";

const SIDE_COLOR = { attacker: colors.info, defender: colors.dangerSoft };

const DWELL_MS = {
  battle_start: 1400,
  round_start: 700,
  no_target: 500,
  morale_warning: 1100,
  evasion: 900,
  splash: 1000,
  leech: 1000,
  hero_reaction: 2100,
  attack: 1200,
  battle_end: 1600,
};

function dwellForEvent(evt) {
  if (!evt) return 900;
  if (evt.type === "attack" && (evt.source_is_hero_solo || evt.damage_phase === "hero")) return 2100;
  return DWELL_MS[evt.type] || 1000;
}

function keyFor(ref) {
  return `${ref.side}-${ref.index}`;
}

// Seed every stack at its PRE-battle values (initial quantity, full hero HP)
// — the timeline of events then drives it forward to the final state that's
// already stored in the army summary, exactly like the real fight unfolded.
function buildInitialState(attackerArmy, defenderArmy) {
  const state = {};
  (attackerArmy?.stacks || []).forEach((s, i) => {
    state[`attacker-${i}`] = { quantity: s.initial, hero_hp: s.hero ? s.hero_max_hp ?? 0 : null };
  });
  (defenderArmy?.stacks || []).forEach((s, i) => {
    state[`defender-${i}`] = { quantity: s.initial, hero_hp: s.hero ? s.hero_max_hp ?? 0 : null };
  });
  return state;
}

function applyEvent(state, evt) {
  if (evt.target && evt.target.side != null) {
    const k = keyFor(evt.target);
    if (state[k]) {
      if (evt.target_quantity_after != null) state[k].quantity = evt.target_quantity_after;
      if (evt.target_hero_hp_after != null) state[k].hero_hp = evt.target_hero_hp_after;
    }
  }
  (evt.secondary_targets || []).forEach((t) => {
    const k = keyFor(t);
    if (state[k] && t.quantity_after != null) state[k].quantity = t.quantity_after;
  });
}

function UnitCard({ stack, live, side, active, hit }) {
  const typeIcon = TYPE_ICONS[stack.unit_type] || "⚔️";
  const elemColor = ELEM_COLORS[stack.element] || colors.textDim;
  const sideColor = SIDE_COLOR[side];
  const wiped = live.quantity <= 0 && !(stack.hero && live.hero_hp > 0);
  const heroFallen = stack.hero && live.hero_hp <= 0;

  return (
    <View
      style={[
        styles.card,
        { borderColor: active ? sideColor : alpha(colors.border, "66") },
        active && styles.cardActive,
        wiped && styles.cardWiped,
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardIcon}>{typeIcon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{stack.name}</Text>
          <View style={[styles.elemBadge, { borderColor: alpha(elemColor, "66") }]}>
            <Text style={[styles.elemText, { color: elemColor }]}>{stack.element || "physical"}</Text>
          </View>
        </View>
        {hit && <Text style={styles.hitFlash}>{hit}</Text>}
      </View>

      <View style={styles.barRow}>
        <Text style={styles.barLabel}>{Math.max(live.quantity, 0)} / {stack.initial}</Text>
      </View>
      <ProgressBar
        percent={stack.initial > 0 ? (Math.max(live.quantity, 0) / stack.initial) * 100 : 0}
        color={wiped ? colors.faint : sideColor}
        height={7}
      />

      {stack.hero && (
        <>
          <View style={styles.barRow}>
            <Text style={[styles.barLabel, { color: colors.gold }]}>
              👑 {stack.hero.name} {Math.max(live.hero_hp, 0)}/{stack.hero_max_hp}
            </Text>
          </View>
          <ProgressBar
            percent={stack.hero_max_hp > 0 ? (Math.max(live.hero_hp, 0) / stack.hero_max_hp) * 100 : 0}
            color={heroFallen ? colors.faint : colors.gold}
            height={5}
          />
        </>
      )}

      {wiped && (
        <View style={styles.wipedTag}>
          <Text style={styles.wipedTagText}>💀 WIPED OUT</Text>
        </View>
      )}
      {heroFallen && !wiped && (
        <View style={styles.wipedTag}>
          <Text style={styles.wipedTagText}>👑 HERO FALLEN</Text>
        </View>
      )}
    </View>
  );
}

function eventHeadline(evt) {
  if (!evt) return "";
  switch (evt.type) {
    case "battle_start": return "⚔️ The armies clash!";
    case "round_start": return `— Round ${evt.round} —`;
    case "battle_end": return `🏁 ${evt.winner ? evt.winner.toUpperCase() : "DRAW"} wins the field!`;
    case "no_target": return `${evt.source?.name} finds no targets.`;
    case "morale_warning": return `⚠ ${evt.side === "attacker" ? "Attacker" : "Defender"} morale is wavering!`;
    case "evasion": return `💨 ${evt.source?.name} dodges the counter!`;
    case "splash": return `💥 SPLASH! ${evt.target?.name} caught in the blast (${evt.kills} lost)`;
    case "leech": return `🩸 LEECH! ${evt.source?.name} drains ${evt.healed} life`;
    case "hero_reaction": {
      const names = { vengeance_charge: "VENGEANCE CHARGE", arcane_nova: "ARCANE NOVA", desperate_volley: "DESPERATE VOLLEY" };
      return `👑 ${names[evt.hero_reaction_name] || "HERO REACTION"}! ${evt.source?.name}`;
    }
    case "attack": {
      const verb = evt.is_retaliation ? "counters" : evt.source_is_hero_solo ? "strikes alone" : "attacks";
      return `${evt.source?.name} ${verb} ${evt.target?.name}`;
    }
    default: return evt.text?.split("\n")[0] || "";
  }
}

function isBigMoment(evt) {
  if (!evt) return false;
  return evt.type === "hero_reaction" || evt.type === "battle_end" ||
    (evt.type === "attack" && (evt.source_is_hero_solo || evt.damage_phase === "hero"));
}

export default function BattleReplayScreen({ route, navigation }) {
  const { result, viewer = "attacker" } = route.params;
  const events = result.events || [];

  const [appliedCount, setAppliedCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const attackerArmy = result.attacker_army;
  const defenderArmy = result.defender_army;

  // No structured events — nothing to replay, bounce straight to the static report.
  useEffect(() => {
    if (events.length === 0) {
      navigation.replace("BattleResult", { result, viewer });
    }
  }, []);

  const initialState = useMemo(() => buildInitialState(attackerArmy, defenderArmy), [attackerArmy, defenderArmy]);

  const stackState = useMemo(() => {
    const state = {};
    Object.keys(initialState).forEach((k) => { state[k] = { ...initialState[k] }; });
    for (let i = 0; i < appliedCount; i++) applyEvent(state, events[i]);
    return state;
  }, [appliedCount, initialState, events]);

  const currentEvent = appliedCount > 0 ? events[appliedCount - 1] : null;
  const finished = appliedCount >= events.length;

  const advance = useCallback(() => {
    setAppliedCount((c) => Math.min(c + 1, events.length));
  }, [events.length]);

  useEffect(() => {
    if (!playing) return;
    if (finished) { setPlaying(false); return; }
    const dwell = dwellForEvent(currentEvent) / speed;
    const t = setTimeout(advance, dwell);
    return () => clearTimeout(t);
  }, [playing, appliedCount, speed]);

  function cycleSpeed() {
    setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1));
  }

  const yourSide = viewer === "attacker" ? "attacker" : "defender";
  const enemySide = viewer === "attacker" ? "defender" : "attacker";
  const yourArmy = viewer === "attacker" ? attackerArmy : defenderArmy;
  const enemyArmy = viewer === "attacker" ? defenderArmy : attackerArmy;

  function isInvolved(side, index) {
    if (!currentEvent) return false;
    if (currentEvent.source && currentEvent.source.side === side && currentEvent.source.index === index) return true;
    if (currentEvent.target && currentEvent.target.side === side && currentEvent.target.index === index) return true;
    if ((currentEvent.secondary_targets || []).some((t) => t.side === side && t.index === index)) return true;
    return false;
  }

  function hitFor(side, index) {
    if (!currentEvent) return null;
    const isTarget = currentEvent.target && currentEvent.target.side === side && currentEvent.target.index === index;
    const secondary = (currentEvent.secondary_targets || []).find((t) => t.side === side && t.index === index);
    if (isTarget) {
      if (currentEvent.damage != null) return `-${currentEvent.kills ?? currentEvent.damage}`;
      if (currentEvent.healed != null) return `+${currentEvent.healed}`;
    }
    if (secondary) return `-${secondary.kills}`;
    return null;
  }

  function renderColumn(label, army, side, sideColor) {
    if (!army) return null;
    return (
      <View style={styles.column}>
        <Text style={[styles.columnLabel, { color: sideColor }]}>{label}</Text>
        {army.stacks.map((s, i) => (
          <UnitCard
            key={i}
            stack={s}
            live={stackState[`${side}-${i}`] || { quantity: s.initial, hero_hp: s.hero_max_hp }}
            side={side}
            active={isInvolved(side, i)}
            hit={hitFor(side, i)}
          />
        ))}
      </View>
    );
  }

  const big = isBigMoment(currentEvent);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerRound}>{currentEvent ? `Round ${currentEvent.round}` : "—"}</Text>
        <Text style={styles.headerCount}>{appliedCount} / {events.length}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        <View style={styles.battlefield}>
          {renderColumn("⚔️ YOUR FORCES", yourArmy, yourSide, colors.info)}
          {renderColumn("🛡 ENEMY FORCES", enemyArmy, enemySide, colors.dangerSoft)}
        </View>
      </ScrollView>

      {/* Event ticker */}
      <FadeSlideIn key={appliedCount} style={{ flex: 0 }} duration={180}>
        <View style={[styles.ticker, big && styles.tickerBig]}>
          <Text style={[styles.tickerText, big && styles.tickerTextBig]} numberOfLines={2}>
            {eventHeadline(currentEvent) || "Ready to begin…"}
          </Text>
          {currentEvent?.bonuses?.length > 0 && (
            <View style={styles.bonusRow}>
              {currentEvent.bonuses.map((b, i) => (
                <Badge key={i} label={b} color={colors.warning} style={{ marginRight: 4 }} />
              ))}
            </View>
          )}
        </View>
      </FadeSlideIn>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => setAppliedCount((c) => Math.max(0, c - 1))} disabled={playing || appliedCount === 0}>
          <Text style={[styles.ctrlTxt, (playing || appliedCount === 0) && styles.ctrlTxtDisabled]}>⏮</Text>
        </TouchableOpacity>
        <PressableScale style={styles.playBtn} onPress={() => setPlaying((p) => !p)} scaleTo={0.92}>
          <Text style={styles.playTxt}>{finished ? "↺" : playing ? "⏸" : "▶"}</Text>
        </PressableScale>
        <TouchableOpacity style={styles.ctrlBtn} onPress={advance} disabled={playing || finished}>
          <Text style={[styles.ctrlTxt, (playing || finished) && styles.ctrlTxtDisabled]}>⏭</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.speedBtn} onPress={cycleSpeed}>
          <Text style={styles.speedTxt}>{speed}×</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.reportBtn}
        onPress={() => navigation.replace("BattleResult", { result, viewer })}
      >
        <Text style={styles.reportBtnText}>{finished ? "▶ View Full Report" : "Skip to Report"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRound: { color: colors.gold, fontSize: 13, fontWeight: "800" },
  headerCount: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },

  battlefield: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 8, gap: 8 },
  column: { flex: 1 },
  columnLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 8,
    marginBottom: 6,
  },
  cardActive: { shadowColor: colors.gold, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4 },
  cardWiped: { opacity: 0.45 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardIcon: { fontSize: 16 },
  cardName: { color: colors.text, fontSize: 12, fontWeight: "700" },
  elemBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, marginTop: 1 },
  elemText: { fontSize: 9, fontWeight: "600", textTransform: "capitalize" },
  hitFlash: { color: colors.danger, fontWeight: "900", fontSize: 13 },

  barRow: { marginTop: 2, marginBottom: 1 },
  barLabel: { color: colors.muted, fontSize: 10, fontVariant: ["tabular-nums"] },

  wipedTag: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: alpha(colors.danger, "22"),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wipedTagText: { color: colors.danger, fontSize: 10, fontWeight: "800" },

  ticker: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tickerBig: {
    borderColor: colors.gold,
    backgroundColor: alpha(colors.gold, "14"),
  },
  tickerText: { color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "center" },
  tickerTextBig: { color: colors.gold, fontSize: 15, fontWeight: "900" },
  bonusRow: { flexDirection: "row", marginTop: 6 },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 10,
  },
  ctrlBtn: { padding: 8 },
  ctrlTxt: { fontSize: 20, color: colors.text },
  ctrlTxtDisabled: { color: colors.faint },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  playTxt: { fontSize: 22, color: colors.white },
  speedBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speedTxt: { color: colors.textDim, fontSize: 13, fontWeight: "700" },

  reportBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.border,
  },
  reportBtnText: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
