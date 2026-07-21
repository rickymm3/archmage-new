import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import { LoadingState, EmptyState } from "../components/ui";
import { useDrawer } from "../components/GameHubShell";
import { CompactShell, StatStrip, CompactNote } from "../components/DrawerCompact";
import { colors, alpha, elementColors } from "../theme";

function levelMeta(level) {
  if (level <= 3) return { color: colors.success, label: "Low Threat" };
  if (level <= 6) return { color: colors.gold, label: "Moderate Threat" };
  if (level <= 8) return { color: colors.warning, label: "High Threat" };
  return { color: colors.danger, label: "Extreme Threat" };
}

function cooldownLeft(respawnAt) {
  if (!respawnAt) return "";
  const mins = Math.max(0, Math.ceil((new Date(respawnAt).getTime() - Date.now()) / 60000));
  if (mins >= 60) return `${Math.ceil(mins / 60)}h`;
  return `${mins}m`;
}

function SettlementCard({ s, onAttack }) {
  const meta = levelMeta(s.level);
  const elemColor = elementColors[s.element] || colors.textDim;

  return (
    <View style={styles.card}>
      <View style={styles.levelBadge}>
        <Text style={styles.levelTxt}>Lv{s.level}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.elemTag, { borderColor: alpha(elemColor, "77") }]}>
            <Text style={[styles.elemTxt, { color: elemColor }]}>{s.element}</Text>
          </View>
          <Text style={[styles.threatTxt, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.powerTxt}>⚡ {s.power_target}</Text>
        </View>
      </View>

      {s.on_cooldown ? (
        <View style={[styles.attackBtn, styles.attackBtnDisabled]}>
          <Text style={styles.cooldownTxt}>🕐{"\n"}{cooldownLeft(s.respawn_at)}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.attackBtn} activeOpacity={0.85} onPress={() => onAttack(s)}>
          <Text style={styles.attackTxt}>⚔️{"\n"}Attack</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function BarbariansScreen({ navigation }) {
  const { showAlert } = useModal();
  const drawer = useDrawer();
  const expanded = drawer ? drawer.expanded : true;
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadSettlements() {
    try {
      setData(await api.getBarbarianSettlements());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadSettlements(); }, []));

  function handleAttack(s) {
    navigation.navigate("BarbarianAttackSetup", { settlementId: s.id, settlementName: s.name });
  }

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  const settlements = data.settlements || [];

  // Collapsed drawer: camp counts + the easiest camp that's ready to hit,
  // attackable in one tap. The full camp list lives above.
  if (!expanded) {
    const ready = settlements.filter((s) => !s.on_cooldown);
    const easiest = ready.length > 0 ? [...ready].sort((a, b) => (a.level || 0) - (b.level || 0))[0] : null;
    return (
      <CompactShell hint="Pull up for all camps">
        <StatStrip
          items={[
            { value: `${settlements.length}`, label: "Camps" },
            { value: `${ready.length}`, label: "Attackable", color: ready.length > 0 ? colors.success : colors.muted },
          ]}
        />
        {easiest ? (
          <View style={styles.compactCamp}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.compactCampName} numberOfLines={1}>
                Lv{easiest.level} {easiest.name}
              </Text>
              <Text style={styles.compactCampMeta} numberOfLines={1}>
                {easiest.element} · <Text style={{ color: levelMeta(easiest.level).color }}>{levelMeta(easiest.level).label}</Text> · ⚡ {easiest.power_target}
              </Text>
            </View>
            <TouchableOpacity style={styles.compactAttackBtn} activeOpacity={0.85} onPress={() => handleAttack(easiest)}>
              <Text style={styles.compactAttackTxt}>⚔️ Attack</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CompactNote>All camps are rebuilding — check back soon.</CompactNote>
        )}
      </CompactShell>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Barbarian Settlements ({settlements.length})</Text>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadSettlements(); setRefreshing(false); }}
            tintColor={colors.gold}
          />
        }
      >
        {settlements.map((s) => (
          <SettlementCard key={s.id} s={s} onAttack={handleAttack} />
        ))}

        {settlements.length === 0 && (
          <EmptyState icon="🏕️" title="No settlements found" subtitle="Check back later." />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Collapsed-drawer layout
  compactCamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  compactCampName: { color: colors.text, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  compactCampMeta: { color: colors.muted, fontSize: 10, marginTop: 1, textTransform: "capitalize" },
  compactAttackBtn: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  compactAttackTxt: { color: colors.white, fontSize: 11, fontWeight: "800" },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: alpha(colors.warning, "1f"),
    borderWidth: 1,
    borderColor: alpha(colors.warning, "55"),
    alignItems: "center",
    justifyContent: "center",
  },
  levelTxt: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  desc: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  elemTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  elemTxt: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  threatTxt: { fontSize: 11, fontWeight: "700" },
  powerTxt: { color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  attackBtn: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attackTxt: { color: colors.white, fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 16 },
  attackBtnDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cooldownTxt: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 14 },
});
