# Update production values for structures
# Format: { slug: { gold: X, mana: Y, ... } }
# This is a centralized place to balance the economy.

PRODUCTIONS = {
  "town_center" => { gold: 200, mana: 75, army_capacity: 25 },
  "barracks"    => { army_capacity: 100 },
  "bank"        => { gold: 500 },
  "mana_core"   => { mana: 400 },
  "altar"       => { mana: 150 },
  "farm"        => { gold: 50, food: 20 }
}

PRODUCTIONS.each do |slug, prod|
  structure = Structure.find_by(slug: slug)
  if structure
    structure.update!(production: prod)
    puts "Updated #{structure.name} production: #{prod}"
  else
    puts "Warning: Structure '#{slug}' not found."
  end
end
