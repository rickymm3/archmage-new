# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
puts "Seeding Structures..."

[
  {
    slug: "town_center",
    name: "Town Center",
    description: "The heart of your empire. Gates all other structures. Boosts tax revenue, resource output, and army capacity.",
    requirements: { gold: 1500 },
    level_based: true,
    max_level: 10,
    land_cost: 0,
    production: { gold: 200, mana: 75, army_capacity: 25 }
  },
  {
    slug: "barracks",
    name: "Barracks",
    description: "Training grounds for your armies. Each level unlocks stronger units and increases army capacity.",
    requirements: { gold: 300 },
    level_based: true,
    max_level: 10,
    land_cost: 0,
    production: { army_capacity: 100 }
  },
  {
    slug: "bank",
    name: "Bank",
    description: "Financial institution. Generates substantial gold income per level.",
    requirements: { gold: 750 },
    level_based: true,
    max_level: 10,
    land_cost: 0,
    production: { gold: 500 }
  },
  {
    slug: "mana_core",
    name: "Mana Core",
    description: "A conduit for arcane energy. Generates mana and massively increases your mana capacity.",
    requirements: { gold: 600, mana: 150 },
    level_based: true,
    max_level: 10,
    land_cost: 0,
    production: { mana: 400 }
  },
  {
    slug: "altar",
    name: "Altar",
    description: "A sacred place of power. Dramatically increases magic power, boosting spell effectiveness and summon quantities.",
    requirements: { gold: 1200, mana: 200 },
    level_based: true,
    max_level: 10,
    land_cost: 0,
    production: { mana: 150 }
  },
  {
    slug: "farm",
    name: "Farm",
    description: "Generates Gold. Requires constant maintenance but provides steady income.",
    requirements: { gold: 50 },
    level_based: false,
    land_cost: 1,
    base_income_gold: 5
  },
  {
    slug: "field_camp",
    name: "Field Camp",
    description: "Increases army population limits. Essential for supporting large armies without morale penalties.",
    requirements: { gold: 100 },
    level_based: false,
    land_cost: 1,
    production: { army_capacity: 50 }
  }
].each do |structure_data|
  structure = Structure.find_or_initialize_by(slug: structure_data[:slug])
  structure.update!(structure_data)
end

puts "Structures seeded successfully."

puts "Loading Units..."
load File.join(Rails.root, 'db', 'seeds', 'units.rb')
puts "Units Loaded."

puts "Loading Production Balance..."
load File.join(Rails.root, 'db', 'seeds', 'balance_production.rb')
puts "Done."
