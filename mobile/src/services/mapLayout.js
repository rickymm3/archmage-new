// Persists the village grid layout ({ positions: { slug: {x, y} } })
// across sessions. expo-secure-store isn't available on web, so fall back
// to localStorage there (same pattern as services/api.js's token storage).
// Key bumped from v2 (old hotspot-map shape) so stale data is ignored.
import { Platform } from "react-native";

const KEY = "village_grid_v1";

let Store;
if (Platform.OS === "web") {
  Store = {
    getItemAsync: async (k) => localStorage.getItem(k),
    setItemAsync: async (k, v) => localStorage.setItem(k, v),
    deleteItemAsync: async (k) => localStorage.removeItem(k),
  };
} else {
  Store = require("expo-secure-store");
}

export async function loadMapLayout() {
  try {
    const raw = await Store.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function saveMapLayout(layout) {
  try {
    await Store.setItemAsync(KEY, JSON.stringify(layout));
  } catch (e) {}
}

export async function clearMapLayout() {
  try {
    await Store.deleteItemAsync(KEY);
  } catch (e) {}
}
