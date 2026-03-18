import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config";

const TOKEN_KEY = "auth_token";

async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (response.status === 401) {
    await clearToken();
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.errors?.join(". ") || "Request failed"
    );
  }

  return data;
}

// Auth
export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.token);
  return data;
}

export async function register({ username, email, password, passwordConfirmation, color }) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
      color,
    }),
  });
  await setToken(data.token);
  return data;
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "DELETE" });
  } finally {
    await clearToken();
  }
}

export async function getMe() {
  return apiRequest("/auth/me");
}

export async function updateKingdomName(kingdomName) {
  return apiRequest("/auth/kingdom_name", {
    method: "PATCH",
    body: JSON.stringify({ kingdom_name: kingdomName }),
  });
}

// Dashboard
export async function getDashboard() {
  return apiRequest("/dashboard");
}

// Town
export async function getTown() {
  return apiRequest("/town");
}

export async function buildStructure(structureId, quantity = 1) {
  return apiRequest("/town/build", {
    method: "POST",
    body: JSON.stringify({ structure_id: structureId, quantity }),
  });
}

export async function demolishStructure(structureId, quantity = 1) {
  return apiRequest("/town/demolish", {
    method: "POST",
    body: JSON.stringify({ structure_id: structureId, quantity }),
  });
}

export async function townRecruit(unitId, goldAmount) {
  return apiRequest("/town/recruit", {
    method: "POST",
    body: JSON.stringify({ unit_id: unitId, gold_amount: goldAmount }),
  });
}

// Army
export async function getArmy() {
  return apiRequest("/army");
}

export async function payUpkeep(amount) {
  return apiRequest("/army/pay_upkeep", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function disbandUnits(unitId, quantity) {
  return apiRequest("/army/disband", {
    method: "POST",
    body: JSON.stringify({ unit_id: unitId, quantity }),
  });
}

export async function getGarrison() {
  return apiRequest("/army/garrison");
}

export async function updateGarrison(units, activeDefenseSpellId) {
  return apiRequest("/army/garrison", {
    method: "PATCH",
    body: JSON.stringify({ units, active_defense_spell_id: activeDefenseSpellId }),
  });
}

export async function assignHero(unitId, heroId) {
  return apiRequest("/army/assign_hero", {
    method: "PATCH",
    body: JSON.stringify({ unit_id: unitId, hero_id: heroId }),
  });
}

// Spells
export async function getSpells() {
  return apiRequest("/spells");
}

export async function getCastingSpells() {
  return apiRequest("/spells/casting");
}

export async function researchSpell(spellId, amount) {
  return apiRequest(`/spells/${spellId}/research`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function castSpell(spellId, amount) {
  return apiRequest(`/spells/${spellId}/cast`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

// Battles
export async function getBattles() {
  return apiRequest("/battles");
}

export async function scout() {
  return apiRequest("/battles/scout", { method: "POST" });
}

export async function getBattleSetup(targetId) {
  return apiRequest(`/battles/${targetId}/setup`);
}

export async function createBattle(targetId, units, heroes) {
  return apiRequest("/battles", {
    method: "POST",
    body: JSON.stringify({ target_id: targetId, units, heroes }),
  });
}

// Explorations
export async function getExplorations() {
  return apiRequest("/explorations");
}

export async function startExploration(unitId, quantity) {
  return apiRequest("/explorations", {
    method: "POST",
    body: JSON.stringify({ exploration: { unit_id: unitId, quantity } }),
  });
}

export async function claimExploration(explorationId) {
  return apiRequest(`/explorations/${explorationId}/claim`, { method: "POST" });
}

// Marketplace
export async function getMarketplace(filter = "regular") {
  return apiRequest(`/marketplace?filter=${filter}`);
}

export async function placeBid(listingId, amount) {
  return apiRequest(`/marketplace/${listingId}/bid`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function collectListing(listingId) {
  return apiRequest(`/marketplace/${listingId}/collect`, { method: "POST" });
}

// Treasury
export async function getTreasury() {
  return apiRequest("/treasury");
}

export async function collectTax(tier) {
  return apiRequest("/treasury/tax", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
}

export async function rechargeMana() {
  return apiRequest("/treasury/mana/recharge", { method: "POST" });
}

export async function getManaStatus() {
  return apiRequest("/treasury/mana/status");
}

// Notifications
export async function getNotifications(limit = 50) {
  return apiRequest(`/notifications?limit=${limit}`);
}

export async function getNotification(id) {
  return apiRequest(`/notifications/${id}`);
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/mark_all_read", { method: "POST" });
}

// Rankings
export async function getRankings() {
  return apiRequest("/rankings");
}

// Active Spells
export async function getActiveSpells() {
  return apiRequest("/active_spells");
}

export async function cancelActiveSpell(id, type) {
  const params = type === "sustained" ? "?type=sustained" : "";
  return apiRequest(`/active_spells/${id}${params}`, { method: "DELETE" });
}

// Recruit
export async function getRecruitableUnits() {
  return apiRequest("/recruit");
}

export async function recruitUnits(unitId, tier) {
  return apiRequest("/recruit", {
    method: "POST",
    body: JSON.stringify({ unit_id: unitId, tier }),
  });
}

export async function acceptRecruitOrder(orderId) {
  return apiRequest(`/recruit/${orderId}/accept`, { method: "POST" });
}

export async function cancelRecruitOrder(orderId) {
  return apiRequest(`/recruit/${orderId}/cancel`, { method: "POST" });
}

export { getToken, setToken, clearToken };
