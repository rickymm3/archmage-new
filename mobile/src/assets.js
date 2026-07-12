// Central image registry.
//
// React Native's Metro bundler requires static, literal require() paths — you
// cannot build a require path from a runtime string. So every asset is listed
// explicitly here and looked up by key. Missing keys return undefined and the
// UI falls back to its emoji placeholder.

export const ui = {
  logo: require("../assets/ui/logo.png"),
  townPanorama: require("../assets/ui/town_panorama.png"),
  kingdomBanner: require("../assets/ui/kingdom_banner.png"),
  avatarDefault: require("../assets/ui/avatar_default.png"),
  bannerVictory: require("../assets/ui/banner_victory.png"),
  bannerDefeat: require("../assets/ui/banner_defeat.png"),
  expeditionMap: require("../assets/ui/expedition_map.png"),
};

// Structures: three growth tiers each.
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
