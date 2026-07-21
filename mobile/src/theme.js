// Central design tokens for the whole app.
// Every screen should pull colors/spacing/type from here — never hardcode hex values.
import { Platform } from "react-native";

export const colors = {
  // Surfaces
  bg: "#0f0f1a",        // screen background
  card: "#1a1a2e",      // primary card / header surface
  cardAlt: "#252545",   // nested / secondary surface
  border: "#2a2a4a",

  // Brand
  accent: "#7c5cbf",    // arcane purple — primary actions, highlights

  // Text
  text: "#e0e0e0",
  textDim: "#aaa",
  muted: "#888",
  faint: "#666",
  white: "#fff",

  // Semantic
  gold: "#f1c40f",
  goldDim: "#d4c17a",
  success: "#2ecc71",
  danger: "#e74c3c",
  dangerSoft: "#e07070",
  info: "#3498db",
  warning: "#f39c12",
  arcane: "#9b59b6",
  accentDim: "#8888cc",
  black: "#000",
};

// Tint helper: alpha("#2ecc71", "33") -> "#2ecc7133"
export const alpha = (hex, aa) => `${hex}${aa}`;

// Spread into a conventional full-screen container's style to keep its
// content a centered phone-width column when the web frame widens out.
// Screens with full-bleed scene art (GameHubShell, the kingdom map) handle
// this themselves so the art can span the whole frame; this is for plain
// stacked-card screens (settings, auth, battle reports, …) that would
// otherwise stretch edge to edge. No-op on native.
export const webColumn =
  Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
};

export const type = {
  title: 24,
  heading: 18,
  section: 16,
  body: 14,
  small: 12,
  tiny: 11,
};

// Affinity accent colors (matches backend Affinity ids)
export const affinityColors = {
  pyromancer: "#e74c3c",
  mindweaver: "#3498db",
  geomancer: "#2ecc71",
  tempest: "#f1c40f",
  voidwalker: "#9b59b6",
};

// Element accent colors for units/spells
export const elementColors = {
  physical: "#95a5a6",
  fire: "#e74c3c",
  water: "#3498db",
  nature: "#2ecc71",
  holy: "#f1c40f",
  void: "#9b59b6",
};

// Rarity accent colors for marketplace/heroes
export const rarityColors = {
  common: "#95a5a6",
  uncommon: "#2ecc71",
  rare: "#3498db",
  legendary: "#f39c12",
};
