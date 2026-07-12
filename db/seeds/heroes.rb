# Heroes are Units with unit_type: "hero".
# Combat semantics (see Battle::CalculatorService):
#   power   -> Hero HP when fighting solo
#   attack  -> Hero attack (solo strike deals 250% of this)
#   defense -> Armor (damage reduction: armor / (armor + 400))
# Passive stack buffs come either from name-based logic (Kael / Valerius / Sylas)
# or from the generic "buff_*" ability keys below.
# Heroes are never recruitable — they only appear on the black market.

[
  {
    slug: "general_kael",
    name: "General Kael",
    description: "A grizzled veteran of a hundred sieges. Physical Command: +15% attack to physical units he leads. Vengeance Charge: devastating counterattack when his stack falls below half strength.",
    requirements: {},
    upkeep_cost: 200, mana_upkeep: 0, power: 500,
    attack: 100, defense: 120, speed: 12,
    unit_type: "hero", element: "physical",
    abilities: { "passive" => "Physical Command (+15% ATK to physical units)", "trigger" => "Vengeance Charge" },
    recruitable: false, rarity: :legendary
  },
  {
    slug: "archmage_valerius",
    name: "Archmage Valerius",
    description: "Master of raw arcana. Arcane Resonance: +20% attack to magic units he leads. Arcane Nova: unleashes a battlefield-wide blast when his stack falls below half strength.",
    requirements: {},
    upkeep_cost: 220, mana_upkeep: 10, power: 450,
    attack: 130, defense: 80, speed: 10,
    unit_type: "hero", element: "fire",
    abilities: { "passive" => "Arcane Resonance (+20% ATK to magic units)", "trigger" => "Arcane Nova" },
    recruitable: false, rarity: :legendary
  },
  {
    slug: "ranger_sylas",
    name: "Ranger Sylas",
    description: "A phantom of the deep woods. Swift Strike: +10% attack and +5 speed to ranged units he leads. Desperate Volley: armor-piercing barrage when his stack falls below half strength.",
    requirements: {},
    upkeep_cost: 180, mana_upkeep: 0, power: 400,
    attack: 110, defense: 70, speed: 18,
    unit_type: "hero", element: "nature",
    abilities: { "passive" => "Swift Strike (+10% ATK, +5 SPD to ranged units)", "trigger" => "Desperate Volley" },
    recruitable: false, rarity: :legendary
  },
  {
    slug: "lady_seraphine",
    name: "Lady Seraphine",
    description: "Oracle of the Dawn. Radiant Aegis: +20% defense to holy units she leads.",
    requirements: {},
    upkeep_cost: 190, mana_upkeep: 5, power: 420,
    attack: 90, defense: 110, speed: 11,
    unit_type: "hero", element: "holy",
    abilities: { "passive" => "Radiant Aegis (+20% DEF to holy units)", "buff_element" => "holy", "buff_defense_pct" => 0.20 },
    recruitable: false, rarity: :rare
  },
  {
    slug: "morgrim_the_deathless",
    name: "Morgrim the Deathless",
    description: "A lich-lord bound to the mortal plane by spite alone. Dread Presence: +15% attack to void units he leads.",
    requirements: {},
    upkeep_cost: 210, mana_upkeep: 15, power: 480,
    attack: 105, defense: 95, speed: 8,
    unit_type: "hero", element: "void",
    abilities: { "passive" => "Dread Presence (+15% ATK to void units)", "buff_element" => "void", "buff_attack_pct" => 0.15 },
    recruitable: false, rarity: :rare
  },
  {
    slug: "captain_thorne",
    name: "Captain Thorne",
    description: "A mercenary captain who has never lost a contract. Iron Discipline: +10% attack and +10% defense to infantry he leads.",
    requirements: {},
    upkeep_cost: 150, mana_upkeep: 0, power: 350,
    attack: 85, defense: 100, speed: 10,
    unit_type: "hero", element: "physical",
    abilities: { "passive" => "Iron Discipline (+10% ATK/DEF to infantry)", "buff_type" => "infantry", "buff_attack_pct" => 0.10, "buff_defense_pct" => 0.10 },
    recruitable: false, rarity: :rare
  },
  {
    slug: "skyla_stormrider",
    name: "Skyla Stormrider",
    description: "Tamer of thunderbirds and terror of the high winds. Gale Command: +15% attack and +3 speed to flying units she leads.",
    requirements: {},
    upkeep_cost: 170, mana_upkeep: 8, power: 380,
    attack: 95, defense: 75, speed: 22,
    unit_type: "hero", element: "water",
    abilities: { "passive" => "Gale Command (+15% ATK, +3 SPD to flying units)", "buff_type" => "flying", "buff_attack_pct" => 0.15, "buff_speed" => 3 },
    recruitable: false, rarity: :rare
  },
  {
    slug: "sir_aldric",
    name: "Sir Aldric",
    description: "A knight-errant sworn to the charge. Thundering Lance: +15% attack to cavalry he leads.",
    requirements: {},
    upkeep_cost: 160, mana_upkeep: 0, power: 360,
    attack: 90, defense: 90, speed: 14,
    unit_type: "hero", element: "holy",
    abilities: { "passive" => "Thundering Lance (+15% ATK to cavalry)", "buff_type" => "cavalry", "buff_attack_pct" => 0.15 },
    recruitable: false, rarity: :rare
  }
].each do |hero_data|
  hero = Unit.find_or_initialize_by(slug: hero_data[:slug])
  hero.update!(hero_data)
end

puts "Heroes seeded: #{Unit.where(unit_type: 'hero').count}"
