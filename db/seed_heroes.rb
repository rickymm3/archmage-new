# Heroes - Special powerful units
puts "Seeding Heroes..."

heroes = [
  {
    name: "Archmage Valerius",
    description: "A legendary spellcaster who has mastered the arcane arts.",
    unit_type: "hero",
    rarity: :legendary,
    recruitable: false,
    attack: 500,
    defense: 200,
    speed: 15,
    mana_upkeep: 50,
    upkeep_cost: 100,
    power: 1000,
    abilities: { cast_chance: 0.5, mana_regen: 10 }
  },
  {
    name: "General Kael",
    description: "A battle-hardened tactician whose presence boosts army morale.",
    unit_type: "hero",
    rarity: :legendary,
    recruitable: false,
    attack: 300,
    defense: 600,
    speed: 10,
    mana_upkeep: 0,
    upkeep_cost: 150,
    power: 900,
    abilities: { defense_bonus: 0.2 }
  },
  {
    name: "Ranger Sylas",
    description: "The fastest scout in the realm, capable of striking from shadows.",
    unit_type: "hero",
    rarity: :legendary,
    recruitable: false,
    attack: 400,
    defense: 150,
    speed: 30,
    mana_upkeep: 10,
    upkeep_cost: 80,
    power: 850,
    abilities: { first_strike: true }
  }
]

heroes.each do |hero_attrs|
  unit = Unit.find_or_initialize_by(name: hero_attrs[:name])
  unit.update!(hero_attrs)
end

puts "Heroes seeded!"
