# Units
# Unit Types: :infantry, :ranged, :cavalry, :flying, :magic, :void
# Elements: :physical, :fire, :water, :nature, :holy, :void
[
  { 
    name: "Militia", slug: "militia", 
    power: 2, upkeep_cost: 1, mana_upkeep: 0, 
    attack: 1, defense: 1, 
    unit_type: "infantry", element: "physical", speed: 4,
    abilities: {},
    description: "Basic infantry. Cheap to recruit and maintain." 
  },
  { 
    name: "Archer", slug: "archer", 
    power: 4, upkeep_cost: 2, mana_upkeep: 0, 
    attack: 3, defense: 1, 
    unit_type: "ranged", element: "physical", speed: 12,
    abilities: { "bonus_vs_flying": 2.0 },
    description: "Ranged unit. Good for offense." 
  },
  { 
    name: "Footman", slug: "footman", 
    power: 4, upkeep_cost: 2, mana_upkeep: 0, 
    attack: 2, defense: 4, # Slightly buffed defense
    unit_type: "infantry", element: "physical", speed: 5,
    abilities: { "taunt": true },
    description: "Shielded infantry. Good for defense." 
  },
  { 
    name: "Knight", slug: "knight", 
    power: 9, upkeep_cost: 5, mana_upkeep: 0, 
    attack: 6, defense: 5, # Buffed
    unit_type: "cavalry", element: "holy", speed: 10,
    abilities: { "charge": true }, # Charge: First round bonus?
    description: "Elite cavalry. Powerful but expensive." 
  },
  { 
    name: "Battle Mage", slug: "battle_mage", 
    power: 10, upkeep_cost: 3, mana_upkeep: 5, 
    attack: 9, defense: 2, 
    unit_type: "magic", element: "fire", speed: 8,
    abilities: { "splash_damage": 0.5 },
    description: "Spellcaster unit. Requires Mana to sustain.", rarity: 1 
  },
  { 
    name: "Ghoul", slug: "ghoul", 
    power: 3, upkeep_cost: 0, mana_upkeep: 1, 
    attack: 3, defense: 2, 
    unit_type: "infantry", element: "void", speed: 6,
    abilities: { "life_leech": 0.2 },
    description: "Basic undead minion. Requires no food.", recruitable: false 
  },
  { 
    name: "Storm Wisp", slug: "storm_wisp", 
    power: 3, upkeep_cost: 0, mana_upkeep: 5, 
    attack: 4, defense: 1, 
    unit_type: "flying", element: "water", speed: 15,
    abilities: { "dodge": 0.3 },
    description: "A ball of crackling energy. Very fast but fragile.", recruitable: false 
  },
  { 
    name: "Explorer", slug: "explorer", 
    power: 2, upkeep_cost: 2, mana_upkeep: 0, 
    attack: 1, defense: 0, 
    unit_type: "infantry", element: "nature", speed: 20,
    abilities: { "scout": true },
    description: "Specialized unit for exploration. Extremely fast but defenseless." 
  }
].each do |unit_data|
  unit = Unit.find_or_initialize_by(slug: unit_data[:slug])
  
  # Base attributes
  attributes = {
    name: unit_data[:name],
    description: unit_data[:description],
    power: unit_data[:power] || (unit_data[:attack] + unit_data[:defense]),
    upkeep_cost: unit_data[:upkeep_cost],
    mana_upkeep: unit_data[:mana_upkeep] || 0,
    attack: unit_data[:attack],
    defense: unit_data[:defense],
    recruitable: unit_data.fetch(:recruitable, true),
    
    # New Stats
    unit_type: unit_data[:unit_type],
    element: unit_data[:element],
    speed: unit_data[:speed],
    abilities: unit_data[:abilities] || {}
  }
  
  # Requirements logic (unchanged for now, just simplified here)
  attributes[:requirements] = {
      barracks_level: case unit_data[:slug]
                      when "militia" then 1
                      when "archer" then 2
                      when "footman" then 3
                      when "knight" then 5
                      when "battle_mage" then 4
                      else 1
                      end,
      gold: case unit_data[:slug]
            when "militia" then 10
            when "archer" then 25
            when "footman" then 35
            when "knight" then 75
            when "battle_mage" then 100
            else 20
            end
  }

  unit.update!(attributes)
end
