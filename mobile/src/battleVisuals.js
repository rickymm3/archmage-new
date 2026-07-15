import { colors } from "./theme";

// Shared between BattleResultScreen and BattleReplayScreen so both render
// stacks with the same icon/color conventions.
export const TYPE_ICONS = {
  infantry: "🗡",
  cavalry: "🐎",
  ranged: "🏹",
  flying: "🦅",
  magic: "✨",
  hero: "👑",
};

export const ELEM_COLORS = {
  fire: colors.danger,
  water: colors.info,
  nature: colors.success,
  holy: colors.gold,
  void: colors.arcane,
  physical: colors.textDim,
};
