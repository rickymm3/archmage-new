import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as api from "../services/api";
import { useModal } from "../context/ModalContext";
import { LoadingState, EmptyState } from "../components/ui";
import { colors, alpha } from "../theme";

// Threat rating relative to your power (target power / your power).
function threatMeta(ratio) {
  if (ratio <= 0.6) return { skulls: "💀", label: "Easy Prey", color: colors.success };
  if (ratio <= 0.9) return { skulls: "💀💀", label: "Weaker", color: colors.success };
  if (ratio <= 1.15) return { skulls: "⚖️", label: "Even Match", color: colors.gold };
  if (ratio <= 1.6) return { skulls: "💀💀💀", label: "Risky", color: colors.warning };
  return { skulls: "💀💀💀💀", label: "Dangerous", color: colors.danger };
}

function protectionLeft(expiresAt) {
  if (!expiresAt) return "";
  const mins = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
  if (mins >= 60) return `${Math.ceil(mins / 60)}h`;
  return `${mins}m`;
}

function TargetCard({ t, onAttack, dim }) {
  const threat = threatMeta(t.ratio || 1);
  const attackable = !t.under_protection && (t.in_range !== false);

  return (
    <View style={[styles.card, dim && { opacity: 0.55 }]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankTxt}>#{t.rank}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.targetName} numberOfLines={1}>{t.kingdom_name || t.username}</Text>
        <Text style={styles.targetMeta}>
          💪 {Number(t.net_power).toLocaleString()}   🏔 {t.land} land
        </Text>
        <View style={styles.threatRow}>
          <Text style={[styles.threatSkulls]}>{threat.skulls}</Text>
          <Text style={[styles.threatLabel, { color: threat.color }]}>{threat.label}</Text>
          {t.under_protection && (
            <View style={styles.shieldTag}>
              <Text style={styles.shieldTagTxt}>🛡 {protectionLeft(t.protection_expires_at)}</Text>
            </View>
          )}
        </View>
        {t.reason && t.in_range === false && (
          <Text style={styles.reasonTxt}>{t.reason}</Text>
        )}
      </View>

      {attackable ? (
        <TouchableOpacity style={styles.attackBtn} activeOpacity={0.85} onPress={() => onAttack(t)}>
          <Text style={styles.attackTxt}>⚔️{"\n"}Attack</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.attackBtn, styles.attackBtnDisabled]}>
          <Text style={styles.attackTxtDisabled}>{t.under_protection ? "🛡" : "✕"}</Text>
        </View>
      )}
    </View>
  );
}

export default function BattlesScreen({ navigation }) {
  const { showAlert } = useModal();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  async function loadTargets() {
    try {
      setData(await api.getBattles());
    } catch (e) {
      if (e.message !== "UNAUTHORIZED") showAlert("Error", e.message);
    }
  }

  useFocusEffect(useCallback(() => { loadTargets(); }, []));

  function onQueryChange(q) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchTargets(q.trim());
        setResults(res.results || []);
      } catch (e) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function handleAttack(t) {
    navigation.navigate("AttackSetup", {
      targetId: t.id,
      targetName: t.kingdom_name || t.username,
    });
  }

  if (!data) {
    return <View style={styles.container}><LoadingState /></View>;
  }

  const showingSearch = results !== null;
  const list = showingSearch ? results : (data.targets || []);

  return (
    <View style={styles.container}>
      {/* War room plaque */}
      <View style={styles.plaque}>
        <View style={styles.plaqueItem}>
          <Text style={styles.plaqueValue}>#{data.my_rank}</Text>
          <Text style={styles.plaqueLabel}>Your Rank</Text>
        </View>
        <View style={styles.plaqueDivider} />
        <View style={styles.plaqueItem}>
          <Text style={[styles.plaqueValue, { color: colors.gold }]}>💪 {Number(data.my_power).toLocaleString()}</Text>
          <Text style={styles.plaqueLabel}>Your Power</Text>
        </View>
        <View style={styles.plaqueDivider} />
        <View style={styles.plaqueItem}>
          <Text style={[styles.plaqueValue, { color: colors.danger }]}>
            {Number(data.range?.min || 0).toLocaleString()}–{Number(data.range?.max || 0).toLocaleString()}
          </Text>
          <Text style={styles.plaqueLabel}>Strike Range</Text>
        </View>
      </View>

      {/* Manual targeting */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Seek a kingdom by name…"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults(null); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>
        {showingSearch
          ? searching ? "Searching…" : `Search results (${list.length})`
          : `Kingdoms in your strike range (${list.length})`}
      </Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadTargets(); setRefreshing(false); }}
            tintColor={colors.gold}
          />
        }
      >
        {list.map((t) => (
          <TargetCard key={t.id} t={t} onAttack={handleAttack} dim={t.in_range === false} />
        ))}

        {list.length === 0 && !searching && (
          showingSearch ? (
            <EmptyState icon="🌫" title="No kingdom by that name" subtitle="Check the spelling — or perhaps they were wiped from the map." />
          ) : (
            <EmptyState icon="🕊" title="No kingdoms in range" subtitle="Grow your power, or seek a specific kingdom by name above." />
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* plaque */
  plaque: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  plaqueItem: { flex: 1, alignItems: "center" },
  plaqueValue: { color: colors.text, fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  plaqueLabel: { color: colors.muted, fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  plaqueDivider: { width: 1, backgroundColor: colors.border },

  /* search */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  clearBtn: { color: colors.muted, fontSize: 16, padding: 4 },

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

  /* target cards */
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
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: alpha(colors.accent, "1f"),
    borderWidth: 1,
    borderColor: alpha(colors.accent, "55"),
    alignItems: "center",
    justifyContent: "center",
  },
  rankTxt: { color: colors.accent, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  targetName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  targetMeta: { color: colors.muted, fontSize: 12, marginTop: 2, fontVariant: ["tabular-nums"] },
  threatRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  threatSkulls: { fontSize: 11 },
  threatLabel: { fontSize: 11, fontWeight: "700" },
  shieldTag: {
    backgroundColor: alpha(colors.success, "1f"),
    borderWidth: 1,
    borderColor: alpha(colors.success, "66"),
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  shieldTagTxt: { color: colors.success, fontSize: 10, fontWeight: "700" },
  reasonTxt: { color: colors.dangerSoft, fontSize: 11, fontStyle: "italic", marginTop: 3 },
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
  attackTxtDisabled: { color: colors.faint, fontSize: 16 },
});
