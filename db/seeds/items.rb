# Items are their own table (see Item model, which includes Marketable for
# rarity/base_price/auction support).
#
# Equippable items (weapon/armor/accessory) use the same "buff_*" ability keys
# that hero passives use (see Battle::CalculatorService::Stack#apply_generic_hero_passive):
#   buff_type / buff_element -> filters which stacks the bonus applies to
#   buff_attack_pct / buff_defense_pct -> percentage stat boosts
#   buff_speed -> flat speed boost
#
# Consumables use a "use_effect" hash resolved by Items::UseService, mapped
# onto existing User mechanics (gold/mana/land grants, morale restore,
# protection extension, settlement recon).

[
  # ── Weapons (buff_attack_pct) ───────────────────────────────────
  {
    slug: "rusty_shortsword",
    name: "Rusty Shortsword",
    description: "A pitted blade, better than bare fists.",
    item_type: :weapon, rarity: :common,
    abilities: { "buff_attack_pct" => 0.03 }
  },
  {
    slug: "steel_warblade",
    name: "Steel Warblade",
    description: "Well-balanced steel favored by disciplined infantry.",
    item_type: :weapon, rarity: :uncommon,
    abilities: { "buff_attack_pct" => 0.08, "buff_type" => "infantry" }
  },
  {
    slug: "longbow_of_the_hawk",
    name: "Longbow of the Hawk",
    description: "Fletched with hawk feathers; arrows fly truer at range.",
    item_type: :weapon, rarity: :rare,
    abilities: { "buff_attack_pct" => 0.15, "buff_type" => "ranged" }
  },
  {
    slug: "emberforge_greatsword",
    name: "Emberforge Greatsword",
    description: "Forged in dying embers, it never cools. Fire units strike harder wielding it.",
    item_type: :weapon, rarity: :legendary,
    abilities: { "buff_attack_pct" => 0.25, "buff_element" => "fire" }
  },

  # ── Armor (buff_defense_pct) ─────────────────────────────────────
  {
    slug: "padded_leather_vest",
    name: "Padded Leather Vest",
    description: "Simple but sturdy protection.",
    item_type: :armor, rarity: :common,
    abilities: { "buff_defense_pct" => 0.03 }
  },
  {
    slug: "chainmail_hauberk",
    name: "Chainmail Hauberk",
    description: "Interlocking rings turn aside glancing blows.",
    item_type: :armor, rarity: :uncommon,
    abilities: { "buff_defense_pct" => 0.08 }
  },
  {
    slug: "reinforced_plate_mail",
    name: "Reinforced Plate Mail",
    description: "Heavy plate favored by disciplined shield walls.",
    item_type: :armor, rarity: :rare,
    abilities: { "buff_defense_pct" => 0.15, "buff_type" => "infantry" }
  },
  {
    slug: "aegis_of_the_fallen_king",
    name: "Aegis of the Fallen King",
    description: "A dead monarch's shield, still humming with old oaths.",
    item_type: :armor, rarity: :legendary,
    abilities: { "buff_defense_pct" => 0.25, "buff_type" => "infantry" }
  },

  # ── Accessories (mixed) ──────────────────────────────────────────
  {
    slug: "travelers_boots",
    name: "Traveler's Boots",
    description: "Well-worn boots that make the march a little lighter.",
    item_type: :accessory, rarity: :common,
    abilities: { "buff_speed" => 1 }
  },
  {
    slug: "brooch_of_protection",
    name: "Brooch of Protection",
    description: "A ward against incoming blows.",
    item_type: :accessory, rarity: :uncommon,
    abilities: { "buff_defense_pct" => 0.08 }
  },
  {
    slug: "windrider_signet",
    name: "Windrider Signet",
    description: "A cavalry ring said to carry the wearer like the wind.",
    item_type: :accessory, rarity: :rare,
    abilities: { "buff_speed" => 4, "buff_type" => "cavalry" }
  },
  {
    slug: "crown_of_the_archmage",
    name: "Crown of the Archmage",
    description: "A crown that hums with arcane current, amplifying spellcraft.",
    item_type: :accessory, rarity: :legendary,
    abilities: { "buff_attack_pct" => 0.15, "buff_type" => "magic" }
  },

  # ── Consumables (use_effect) ─────────────────────────────────────
  {
    slug: "mana_crystal",
    name: "Mana Crystal",
    description: "A crystallized reservoir of arcane energy. Use to refill your mana battery.",
    item_type: :consumable, rarity: :common,
    use_effect: { "mana" => 150 }
  },
  {
    slug: "sack_of_gold",
    name: "Sack of Gold",
    description: "A satisfyingly heavy sack of coin.",
    item_type: :consumable, rarity: :common,
    use_effect: { "gold" => 300 }
  },
  {
    slug: "potion_of_valor",
    name: "Potion of Valor",
    description: "Steadies nerves and steels resolve, restoring morale.",
    item_type: :consumable, rarity: :uncommon,
    use_effect: { "restore_morale" => 30 }
  },
  {
    slug: "ash_of_invisibility",
    name: "Ash of Invisibility",
    description: "Scatter this ash to slip from your enemies' sight for a time.",
    item_type: :consumable, rarity: :uncommon,
    use_effect: { "protection_minutes" => 120 }
  },
  {
    slug: "scroll_of_reconnaissance",
    name: "Scroll of Reconnaissance",
    description: "Unfurls a vision of every barbarian settlement's current strength.",
    item_type: :consumable, rarity: :rare,
    use_effect: { "reveal_settlements" => true }
  },
  {
    slug: "deed_of_conquered_land",
    name: "Deed of Conquered Land",
    description: "A forged but binding claim to unclaimed acreage.",
    item_type: :consumable, rarity: :legendary,
    use_effect: { "land" => 3 }
  }
].each do |item_data|
  item = Item.find_or_initialize_by(slug: item_data[:slug])
  item.update!(item_data)
end
