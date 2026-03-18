# Seeding Units
# Unit Types: infantry, ranged, cavalry, flying, magic
# Elements: physical, fire, water, nature, holy, void

[
  # ── Tier 1 (Barracks L1) ────────────────────────────────────────
  {
    slug: "militia",
    name: "Militia",
    description: "Cheap, untrained peasants armed with simple tools.",
    requirements: { "gold" => 10, "barracks_level" => 1 },
    upkeep_cost: 1, mana_upkeep: 0, power: 2,
    attack: 2, defense: 1, speed: 5,
    unit_type: "infantry", element: "physical",
    abilities: {}
  },

  # ── Tier 2 (Barracks L2) ────────────────────────────────────────
  {
    slug: "footman",
    name: "Footman",
    description: "Standard infantry unit with shield training.",
    requirements: { "gold" => 50, "barracks_level" => 2 },
    upkeep_cost: 3, mana_upkeep: 0, power: 5,
    attack: 5, defense: 5, speed: 5,
    unit_type: "infantry", element: "physical",
    abilities: { "taunt" => true }
  },
  {
    slug: "archer",
    name: "Archer",
    description: "Ranged unit effective from a distance.",
    requirements: { "gold" => 75, "barracks_level" => 2 },
    upkeep_cost: 4, mana_upkeep: 0, power: 5,
    attack: 8, defense: 2, speed: 12,
    unit_type: "ranged", element: "physical",
    abilities: { "bonus_vs_flying" => 2.0 }
  },

  # ── Tier 3 (Barracks L3) ────────────────────────────────────────
  {
    slug: "pikeman",
    name: "Pikeman",
    description: "Defensive unit with long reach, perfect for holding the line.",
    requirements: { "gold" => 100, "barracks_level" => 3 },
    upkeep_cost: 5, mana_upkeep: 0, power: 7,
    attack: 6, defense: 8, speed: 5,
    unit_type: "infantry", element: "physical",
    abilities: { "taunt" => true }
  },

  # ── Tier 4 (Barracks L4) ────────────────────────────────────────
  {
    slug: "crossbowman",
    name: "Crossbowman",
    description: "Slow but powerful ranged unit capable of piercing armor.",
    requirements: { "gold" => 150, "barracks_level" => 4 },
    upkeep_cost: 8, mana_upkeep: 0, power: 9,
    attack: 12, defense: 4, speed: 4,
    unit_type: "ranged", element: "physical",
    abilities: { "bonus_vs_flying" => 1.5 }
  },

  # ── Tier 5 (Barracks L5) ────────────────────────────────────────
  {
    slug: "heavy_infantry",
    name: "Heavy Infantry",
    description: "Heavily armored soldiers that form the backbone of any army.",
    requirements: { "gold" => 200, "barracks_level" => 5 },
    upkeep_cost: 12, mana_upkeep: 0, power: 14,
    attack: 10, defense: 15, speed: 4,
    unit_type: "infantry", element: "physical",
    abilities: { "taunt" => true }
  },

  # ── Tier 6 (Barracks L6) ────────────────────────────────────────
  {
    slug: "knight",
    name: "Knight",
    description: "Heavily armored mounted unit with devastating charges.",
    requirements: { "gold" => 300, "barracks_level" => 6 },
    upkeep_cost: 20, mana_upkeep: 0, power: 20,
    attack: 25, defense: 15, speed: 15,
    unit_type: "cavalry", element: "holy",
    abilities: { "charge" => true }
  },

  # ── Tier 7 (Barracks L7) ────────────────────────────────────────
  {
    slug: "mage_apprentice",
    name: "Mage Apprentice",
    description: "A novice spellcaster beginning to master the arcane arts.",
    requirements: { "gold" => 400, "barracks_level" => 7 },
    upkeep_cost: 15, mana_upkeep: 5, power: 18,
    attack: 30, defense: 5, speed: 6,
    unit_type: "magic", element: "fire",
    abilities: { "splash_damage" => 0.3 }
  },

  # ── Tier 8 (Barracks L8) ────────────────────────────────────────
  {
    slug: "cavalier",
    name: "Cavalier",
    description: "Elite mounted warrior with superior speed and combat prowess.",
    requirements: { "gold" => 500, "barracks_level" => 8 },
    upkeep_cost: 35, mana_upkeep: 0, power: 32,
    attack: 40, defense: 25, speed: 18,
    unit_type: "cavalry", element: "physical",
    abilities: { "charge" => true }
  },

  # ── Tier 9 (Barracks L9) ────────────────────────────────────────
  {
    slug: "battle_mage",
    name: "Battle Mage",
    description: "A spellcaster trained in both martial and arcane combat.",
    requirements: { "gold" => 750, "barracks_level" => 9 },
    upkeep_cost: 30, mana_upkeep: 10, power: 40,
    attack: 55, defense: 30, speed: 8,
    unit_type: "magic", element: "fire",
    abilities: { "splash_damage" => 0.5 }
  },

  # ── Tier 10 (Barracks L10) ─────────────────────────────────────
  {
    slug: "paladin",
    name: "Paladin",
    description: "Holy warrior dedicated to smiting evil and defending the realm.",
    requirements: { "gold" => 1000, "barracks_level" => 10 },
    upkeep_cost: 50, mana_upkeep: 5, power: 55,
    attack: 60, defense: 60, speed: 12,
    unit_type: "cavalry", element: "holy",
    abilities: { "charge" => true }
  },
  {
    slug: "archmage_guard",
    name: "Archmage Guard",
    description: "The personal guard of the Archmage, wielding magical weapons.",
    requirements: { "gold" => 1500, "barracks_level" => 10 },
    upkeep_cost: 60, mana_upkeep: 15, power: 70,
    attack: 80, defense: 70, speed: 10,
    unit_type: "magic", element: "holy",
    abilities: { "splash_damage" => 0.4 }
  },
  {
    slug: "dragon_slayer",
    name: "Dragon Slayer",
    description: "Legendary warrior known for slaying the mightiest beasts.",
    requirements: { "gold" => 2500, "barracks_level" => 10 },
    upkeep_cost: 75, mana_upkeep: 0, power: 95,
    attack: 120, defense: 90, speed: 12,
    unit_type: "infantry", element: "physical",
    abilities: { "bonus_vs_flying" => 3.0 }
  },

  # ── Explorer (Special) ─────────────────────────────────────────
  {
    slug: "explorer",
    name: "Explorer",
    description: "Specialized unit for exploration. Extremely fast but defenseless.",
    requirements: { "gold" => 20, "barracks_level" => 1 },
    upkeep_cost: 2, mana_upkeep: 0, power: 2,
    attack: 1, defense: 0, speed: 20,
    unit_type: "infantry", element: "nature",
    abilities: { "scout" => true }
  },

  # ── Summonable Units (Not recruitable) ──────────────────────────
  # Voidwalker summons
  {
    slug: "ghoul",
    name: "Ghoul",
    description: "Undead servant raised by necromancy. Drains life in combat.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 1, power: 3,
    attack: 3, defense: 2, speed: 6,
    unit_type: "infantry", element: "void",
    abilities: { "life_leech" => 0.2 },
    recruitable: false
  },
  {
    slug: "shade",
    name: "Shade",
    description: "Shadowy entity from the void. Swift and deadly but fragile.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 4, power: 12,
    attack: 20, defense: 5, speed: 20,
    unit_type: "infantry", element: "void",
    abilities: { "life_leech" => 0.3 },
    recruitable: false
  },
  {
    slug: "wraith",
    name: "Wraith",
    description: "A tormented spirit that weakens all who stand near it.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 8, power: 25,
    attack: 35, defense: 15, speed: 14,
    unit_type: "magic", element: "void",
    abilities: { "life_leech" => 0.4, "splash_damage" => 0.2 },
    recruitable: false
  },

  # Tempest summons
  {
    slug: "storm_wisp",
    name: "Storm Wisp",
    description: "A ball of crackling energy. Very fast but fragile.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 2, power: 4,
    attack: 4, defense: 1, speed: 25,
    unit_type: "flying", element: "water",
    abilities: { "dodge" => 0.3 },
    recruitable: false
  },
  {
    slug: "thunderbird",
    name: "Thunderbird",
    description: "A massive storm-born raptor that unleashes chain lightning in flight.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 6, power: 20,
    attack: 28, defense: 12, speed: 30,
    unit_type: "flying", element: "water",
    abilities: { "splash_damage" => 0.4 },
    recruitable: false
  },

  # Pyromancer summons
  {
    slug: "phoenix",
    name: "Phoenix",
    description: "Creature of living flame. Burns everything in its path.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 8, power: 22,
    attack: 25, defense: 15, speed: 22,
    unit_type: "flying", element: "fire",
    abilities: { "splash_damage" => 0.5 },
    recruitable: false
  },
  {
    slug: "fire_elemental",
    name: "Fire Elemental",
    description: "A living inferno that scorches the battlefield.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 5, power: 15,
    attack: 18, defense: 8, speed: 10,
    unit_type: "magic", element: "fire",
    abilities: { "splash_damage" => 0.6 },
    recruitable: false
  },

  # Geomancer summons
  {
    slug: "treant",
    name: "Treant",
    description: "Guardian of the forest. Immensely tough but slow.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 3, power: 20,
    attack: 15, defense: 30, speed: 3,
    unit_type: "infantry", element: "nature",
    abilities: { "taunt" => true },
    recruitable: false
  },
  {
    slug: "earth_golem",
    name: "Earth Golem",
    description: "A massive construct of stone and iron. Nearly indestructible.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 7, power: 30,
    attack: 20, defense: 45, speed: 2,
    unit_type: "infantry", element: "nature",
    abilities: { "taunt" => true },
    recruitable: false
  },

  # Mindweaver summons
  {
    slug: "phantom_steed",
    name: "Phantom Steed",
    description: "Magical mount conjured from illusion. Fast and elusive.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 3, power: 10,
    attack: 12, defense: 8, speed: 20,
    unit_type: "cavalry", element: "holy",
    abilities: { "dodge" => 0.2 },
    recruitable: false
  },
  {
    slug: "mirror_knight",
    name: "Mirror Knight",
    description: "An illusory warrior that reflects damage back to attackers.",
    requirements: {},
    upkeep_cost: 0, mana_upkeep: 6, power: 18,
    attack: 15, defense: 25, speed: 10,
    unit_type: "infantry", element: "holy",
    abilities: {},
    recruitable: false
  }
].each do |unit_data|
  unit = Unit.find_or_initialize_by(slug: unit_data[:slug])
  unit.recruitable = unit_data[:recruitable].nil? ? true : unit_data[:recruitable]
  unit.update!(unit_data)
end

