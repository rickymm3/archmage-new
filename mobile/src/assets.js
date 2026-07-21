// Central image registry.
//
// React Native's Metro bundler requires static, literal require() paths — you
// cannot build a require path from a runtime string. So every asset is listed
// explicitly here and looked up by key. Missing keys return undefined and the
// UI falls back to its emoji placeholder.

// Full-screen building interiors ("scenes"). 1024x1536 portrait, rendered
// with cover-crop; see SceneBackground. Replace these files with real art —
// composition contract: top 20% calm (HUD), 20-45% hero band, bottom 55%
// dark/empty floor (UI overlays), key detail within central 80% width.
const SCENES = {
  barracks: require("../assets/scenes/barracks.jpg"),
  army_command: require("../assets/scenes/army_command.png"),
  army_command_v2: require("../assets/scenes/army_command_v2.png"),
  war_camp: require("../assets/scenes/war_camp.png"),
  magic_sanctum: require("../assets/scenes/magic_sanctum.png"),
};

export function sceneImage(key) {
  return key ? SCENES[key] : undefined;
}

export const ui = {
  logo: require("../assets/ui/logo.png"),
  // Kingdom map background (KingdomMapScreen). Currently a daytime green
  gameNav: require("../assets/ui/generated/game-nav.png"),
  gameHud: require("../assets/ui/generated/game-hud.png"),
  gameSubmenuTile: require("../assets/ui/generated/game-submenu-tile.png"),
  gameTitlePlaque: require("../assets/ui/generated/game-title-plaque.png"),
  // clearing — mismatched against the twilight purple/gold theme used
  universalHudV2Rail: require("../assets/ui/universal-hud-v2/final/resource-rail.png"),
  universalHudV2PowerCrest: require("../assets/ui/universal-hud-v2/final/power-crest.png"),
  universalHudV2Settings: require("../assets/ui/universal-hud-v2/final/settings-button.png"),
  universalHudV2GoldIcon: require("../assets/ui/universal-hud-v2/final/gold-icon.png"),
  universalHudV2ManaIcon: require("../assets/ui/universal-hud-v2/final/mana-icon.png"),
  universalHudV2LandIcon: require("../assets/ui/universal-hud-v2/final/land-icon.png"),
  // everywhere else (kingdom_banner.png, expedition_map.png). No code
  universalHudV3StatRail: require("../assets/ui/universal-hud-v3/final/stat-rail.png"),
  universalHudV3PowerShield: require("../assets/ui/universal-hud-v3/final/power-shield.png"),
  universalHudV3AvatarFrame: require("../assets/ui/universal-hud-v3/final/avatar-frame.png"),
  universalHudV3Settings: require("../assets/ui/universal-hud-v3/final/settings-button.png"),
  universalHudV3TitlePlaque: require("../assets/ui/universal-hud-v3/final/title-plaque.png"),
  // V4 is one finished rail with built-in end caps, so the right edge
  // remains intentional instead of looking like clipped, stretched chrome.
  universalHudV4StatRail: require("../assets/ui/universal-hud-v4/final/stat-rail.png"),
  // change needed to replace it: overwrite this same file with new art.
  townPanorama: require("../assets/ui/town_panorama.png"),
  // Fixed kingdom map scene with all 6 buildings painted directly into the
  // art (replaces the old townPanorama + separate structure-icon overlay
  // approach). 941x1672 native.
  kingdomBackground: require("../assets/ui/kingdom-background.png"),
  kingdomBanner: require("../assets/ui/kingdom_banner.png"),
  avatarDefault: require("../assets/ui/avatar_default.png"),
  bannerVictory: require("../assets/ui/banner_victory.png"),
  bannerDefeat: require("../assets/ui/banner_defeat.png"),
  expeditionMap: require("../assets/ui/expedition_map.png"),

  // Kingdom map HUD chrome
  collectTaxesBtn: require("../assets/ui/collect-taxes.png"),
  collectManaBtn: require("../assets/ui/collect-mana.png"),
  zoomBar: require("../assets/ui/zoom.png"),
  coinIcon: require("../assets/ui/coin-icon.png"),
  manaIcon: require("../assets/ui/mana-icon.png"),
  diamondIcon: require("../assets/ui/diamond-icon.png"),
  currencyTop: require("../assets/ui/currency-top.png"),

  // Bottom tab bar background — one seamless pre-assembled bar (see
  // navigation/CustomTabBar.js, which overlays 5 interactive tab zones on
  // top). menu-bar-bg.png is menu-empty.png cropped to its actual visible
  // content band (the source canvas has a lot of transparent vertical
  // padding around the bar shape). menuLeft/Right/Middle/Spacing were an
  // earlier attempt to piece the bar together from fragments — kept
  // registered since they're valid assets, but each has its own
  // independent shading, so stitching them side by side produced visible
  // seams; not currently used anywhere.
  menuBarBg: require("../assets/ui/menu-bar-bg.png"),
  menuEmpty: require("../assets/ui/menu-empty.png"),
  menuLeft: require("../assets/ui/menu-left.png"),
  menuRight: require("../assets/ui/menu-right.png"),
  menuMiddle: require("../assets/ui/menu-middle.png"),
  menuSpacing: require("../assets/ui/menu-spacing.png"),
};

// Structures: three growth tiers each.
//

const SUBMENU_ICONS = {
  "home-overview": require("../assets/ui/submenu-icons/final/home-overview.png"),
  "home-tax": require("../assets/ui/submenu-icons/final/home-tax.png"),
  "home-mana": require("../assets/ui/submenu-icons/final/home-mana.png"),
  "kingdom-keep": require("../assets/ui/submenu-icons/final/kingdom-keep.png"),
  "kingdom-barracks": require("../assets/ui/submenu-icons/final/kingdom-barracks.png"),
  "kingdom-bank": require("../assets/ui/submenu-icons/final/kingdom-bank.png"),
  "kingdom-core": require("../assets/ui/submenu-icons/final/kingdom-core.png"),
  "kingdom-altar": require("../assets/ui/submenu-icons/final/kingdom-altar.png"),
  "kingdom-farm": require("../assets/ui/submenu-icons/final/kingdom-farm.png"),
  "kingdom-camp": require("../assets/ui/submenu-icons/final/kingdom-camp.png"),
  "kingdom-market": require("../assets/ui/submenu-icons/final/kingdom-market.png"),
  "army-overview": require("../assets/ui/submenu-icons/final/army-overview.png"),
  "army-units": require("../assets/ui/submenu-icons/final/army-units.png"),
  "army-defense": require("../assets/ui/submenu-icons/final/army-defense.png"),
  "army-recruit": require("../assets/ui/submenu-icons/final/army-recruit.png"),
  "army-gear": require("../assets/ui/submenu-icons/final/army-gear.png"),
  "war-attack": require("../assets/ui/submenu-icons/final/war-attack.png"),
  "war-explore": require("../assets/ui/submenu-icons/final/war-explore.png"),
  "war-barbarians": require("../assets/ui/submenu-icons/final/war-barbarians.png"),
  "war-rankings": require("../assets/ui/submenu-icons/final/war-rankings.png"),
  "magic-research": require("../assets/ui/submenu-icons/final/magic-research.png"),
  "magic-cast": require("../assets/ui/submenu-icons/final/magic-cast.png"),
  "magic-active": require("../assets/ui/submenu-icons/final/magic-active.png"),
};

export function submenuIcon(key) {
  return key ? SUBMENU_ICONS[key] : undefined;
}
// TODO once art arrives — two KingdomMapScreen buildings have no real art
// yet and fall back to an emoji glyph (🏆 / 🛒). Drop the files at these
// exact paths, then add ONE line each to the STRUCTURES map below
// (Metro requires a static, literal path, so the require() can't be added
// until the file actually exists):
//   mobile/assets/structures/hall_of_legends.png   hall_of_legends: [require("../assets/structures/hall_of_legends.png")],
//   mobile/assets/structures/black_market.png       black_market: [require("../assets/structures/black_market.png")],
// Then in screens/KingdomMapScreen.js's POIS array, swap
// `emoji: "🏆"` / `emoji: "🛒"` for `img: () => structureImage("hall_of_legends")` / `img: () => structureImage("black_market")`.
const STRUCTURES = {
  town_center: [require("../assets/structures/town_center_t1.png"), require("../assets/structures/town_center_t2.png"), require("../assets/structures/town_center_t3.png")],
  barracks:    [require("../assets/structures/barracks_t1.png"),    require("../assets/structures/barracks_t2.png"),    require("../assets/structures/barracks_t3.png")],
  bank:        [require("../assets/structures/bank_t1.png"),        require("../assets/structures/bank_t2.png"),        require("../assets/structures/bank_t3.png")],
  mana_core:   [require("../assets/structures/mana_core_t1.png"),   require("../assets/structures/mana_core_t2.png"),   require("../assets/structures/mana_core_t3.png")],
  altar:       [require("../assets/structures/altar_t1.png"),       require("../assets/structures/altar_t2.png"),       require("../assets/structures/altar_t3.png")],
  farm:        [require("../assets/structures/farm_t1.png"),        require("../assets/structures/farm_t2.png"),        require("../assets/structures/farm_t3.png")],
  field_camp:  [require("../assets/structures/field_camp_t1.png"),  require("../assets/structures/field_camp_t2.png"),  require("../assets/structures/field_camp_t3.png")],
};

const UNITS = {
  militia: require("../assets/units/militia.png"),
  footman: require("../assets/units/footman.png"),
  archer: require("../assets/units/archer.png"),
  pikeman: require("../assets/units/pikeman.png"),
  crossbowman: require("../assets/units/crossbowman.png"),
  heavy_infantry: require("../assets/units/heavy_infantry.png"),
  knight: require("../assets/units/knight.png"),
  mage_apprentice: require("../assets/units/mage_apprentice.png"),
  cavalier: require("../assets/units/cavalier.png"),
  battle_mage: require("../assets/units/battle_mage.png"),
  paladin: require("../assets/units/paladin.png"),
  archmage_guard: require("../assets/units/archmage_guard.png"),
  dragon_slayer: require("../assets/units/dragon_slayer.png"),
  explorer: require("../assets/units/explorer.png"),
  ghoul: require("../assets/units/ghoul.png"),
  shade: require("../assets/units/shade.png"),
  wraith: require("../assets/units/wraith.png"),
  storm_wisp: require("../assets/units/storm_wisp.png"),
  thunderbird: require("../assets/units/thunderbird.png"),
  phoenix: require("../assets/units/phoenix.png"),
  fire_elemental: require("../assets/units/fire_elemental.png"),
  treant: require("../assets/units/treant.png"),
  earth_golem: require("../assets/units/earth_golem.png"),
  phantom_steed: require("../assets/units/phantom_steed.png"),
  mirror_knight: require("../assets/units/mirror_knight.png"),
};

const HEROES = {
  general_kael: require("../assets/heroes/general_kael.png"),
  archmage_valerius: require("../assets/heroes/archmage_valerius.png"),
  ranger_sylas: require("../assets/heroes/ranger_sylas.png"),
  lady_seraphine: require("../assets/heroes/lady_seraphine.png"),
  morgrim_the_deathless: require("../assets/heroes/morgrim_the_deathless.png"),
  captain_thorne: require("../assets/heroes/captain_thorne.png"),
  skyla_stormrider: require("../assets/heroes/skyla_stormrider.png"),
  sir_aldric: require("../assets/heroes/sir_aldric.png"),
};

const SPELLS = {
  general: require("../assets/spells/general.png"),
  pyromancer: require("../assets/spells/pyromancer.png"),
  mindweaver: require("../assets/spells/mindweaver.png"),
  geomancer: require("../assets/spells/geomancer.png"),
  tempest: require("../assets/spells/tempest.png"),
  voidwalker: require("../assets/spells/voidwalker.png"),
};

const CRESTS = {
  pyromancer: require("../assets/affinities/crest_pyromancer.png"),
  mindweaver: require("../assets/affinities/crest_mindweaver.png"),
  geomancer: require("../assets/affinities/crest_geomancer.png"),
  tempest: require("../assets/affinities/crest_tempest.png"),
  voidwalker: require("../assets/affinities/crest_voidwalker.png"),
};

// ── Lookups (return undefined when absent → caller shows emoji) ──

export function unitImage(slug) {
  return slug ? UNITS[slug] : undefined;
}

// Heroes are units too; try the hero set first, then regular units.
export function heroImage(slug) {
  if (!slug) return undefined;
  return HEROES[slug] || UNITS[slug];
}

// Any unit slug — resolves heroes or regular units (marketplace, armies).
export function anyUnitImage(slug) {
  if (!slug) return undefined;
  return UNITS[slug] || HEROES[slug];
}

export function structureImage(slug, tier = 0) {
  const set = STRUCTURES[slug];
  if (!set) return undefined;
  return set[Math.max(0, Math.min(tier, set.length - 1))];
}

export function spellImage(affinity) {
  return affinity ? SPELLS[affinity] : undefined;
}

export function affinityCrest(affinity) {
  return affinity ? CRESTS[affinity] : undefined;
}
