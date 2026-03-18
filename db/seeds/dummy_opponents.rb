require "securerandom"

DUMMY_ACCOUNTS = [
  {
    username: "LordVex",
    kingdom_name: "Shadowmere",
    email: "vex@test.com",
    color: "voidwalker",
    land: 15,
    gold: 5000,
    mana: 200,
    units: { "Militia" => 80, "Footman" => 30 }
  },
  {
    username: "LadyEmber",
    kingdom_name: "Pyreheart",
    email: "ember@test.com",
    color: "pyromancer",
    land: 25,
    gold: 12000,
    mana: 500,
    units: { "Militia" => 40, "Archer" => 60, "Heavy Infantry" => 20, "Mage Apprentice" => 15 }
  },
  {
    username: "WardenThorne",
    kingdom_name: "Ironhold",
    email: "thorne@test.com",
    color: "geomancer",
    land: 40,
    gold: 25000,
    mana: 800,
    units: { "Footman" => 100, "Pikeman" => 80, "Knight" => 30, "Cavalier" => 20 },
    structures: { "barracks" => 4, "bank" => 3 }
  },
  {
    username: "SeerLyra",
    kingdom_name: "Moonspire",
    email: "lyra@test.com",
    color: "mindweaver",
    land: 55,
    gold: 40000,
    mana: 2000,
    units: { "Mage Apprentice" => 60, "Battle Mage" => 40, "Archmage Guard" => 10, "Paladin" => 15 },
    structures: { "barracks" => 5, "mana_core" => 4, "altar" => 3 }
  },
  {
    username: "Khargan",
    kingdom_name: "Warfang",
    email: "khargan@test.com",
    color: "pyromancer",
    land: 80,
    gold: 80000,
    mana: 3000,
    units: { "Heavy Infantry" => 120, "Knight" => 80, "Dragon Slayer" => 20, "Cavalier" => 50 },
    structures: { "barracks" => 7, "bank" => 5, "mana_core" => 3 }
  },
  {
    username: "HollowKing",
    kingdom_name: "Dreadmaw",
    email: "hollow@test.com",
    color: "voidwalker",
    land: 120,
    gold: 150000,
    mana: 5000,
    units: { "Archmage Guard" => 40, "Paladin" => 30, "Dragon Slayer" => 50, "Battle Mage" => 60, "Knight" => 100 },
    structures: { "barracks" => 9, "bank" => 6, "mana_core" => 5, "altar" => 5 }
  },
  {
    username: "PeasantTim",
    kingdom_name: "Mudville",
    email: "tim@test.com",
    color: "geomancer",
    land: 12,
    gold: 2000,
    mana: 50,
    units: { "Militia" => 150 }
  },
  {
    username: "CaptainReya",
    kingdom_name: "Stormwatch",
    email: "reya@test.com",
    color: "tempest",
    land: 35,
    gold: 18000,
    mana: 1000,
    units: { "Crossbowman" => 50, "Archer" => 40, "Footman" => 60, "Pikeman" => 30 },
    structures: { "barracks" => 3, "bank" => 2, "mana_core" => 2 }
  }
]

created = 0
DUMMY_ACCOUNTS.each do |acct|
  if User.exists?(email_address: acct[:email])
    u = User.find_by(email_address: acct[:email])
    puts "  EXISTS: #{acct[:username]} (power: #{u.net_power})"
    next
  end

  u = User.new(
    username: acct[:username],
    kingdom_name: acct[:kingdom_name],
    email_address: acct[:email],
    password: "password123",
    password_confirmation: "password123",
    color: acct[:color]
  )
  u.save!

  u.update_columns(
    land: acct[:land],
    gold: acct[:gold],
    mana: acct[:mana],
    protection_expires_at: nil
  )

  (acct[:units] || {}).each do |unit_name, qty|
    unit = Unit.find_by(name: unit_name)
    unless unit
      puts "  WARNING: Unit '#{unit_name}' not found, skipping"
      next
    end
    uu = u.user_units.find_or_create_by!(unit: unit)
    uu.update!(quantity: qty)
  end

  (acct[:structures] || {}).each do |slug, level|
    us = u.user_structures.joins(:structure).find_by(structures: { slug: slug })
    if us
      us.update!(level: level)
    else
      structure = Structure.find_by(slug: slug)
      if structure
        u.user_structures.create!(structure: structure, level: level)
      end
    end
  end

  u.reload
  puts "  CREATED: #{acct[:username]} | #{acct[:kingdom_name]} | land:#{u.land} | power:#{u.net_power}"
  created += 1
end

puts "\nDone! #{created} accounts created."
puts "\nAll users:"
User.all.each do |u|
  puts "  #{u.username || u.email_address} - power:#{u.net_power} land:#{u.land} army:#{u.army_strength}"
end
