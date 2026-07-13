# Idempotent spell seeding — safe to run repeatedly (upserts by name,
# never destroys player spell progress).
def upsert_spell(attrs)
  spell = Spell.find_or_initialize_by(name: attrs[:name])
  spell.update!(attrs)
end

puts "Seeding Spells..."

# ═══════════════════════════════════════════════════════════════════
# GENERAL SPELLS (Everyone can learn)
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Serenity",
  description: "Calms the populace. +5 Morale per hour for 4 hours.",
  rank: 1, affinity: "general", mana_cost: 20, research_cost: 100,
  spell_type: "self",
  configuration: { stat_target: "morale", base_magnitude: 5, duration: 14400 }
)

upsert_spell(
  name: "Minor Heal",
  description: "Divine energy restores 10 Morale instantly.",
  rank: 1, affinity: "general", mana_cost: 20, research_cost: 200,
  spell_type: "self",
  configuration: { stat_target: "morale", base_magnitude: 10, duration: 3600 }
)

upsert_spell(
  name: "Arcane Bolt",
  description: "Blasts enemy army. +3 attack bonus when attacking for 4 hours.",
  rank: 1, affinity: "general", mana_cost: 30, research_cost: 300,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 3, duration: 14400 }
)

upsert_spell(
  name: "Detect Magic",
  description: "Reveals active spells and enchantments on a target enemy kingdom.",
  rank: 1, affinity: "general", mana_cost: 15, research_cost: 150,
  spell_type: "enemy",
  configuration: { stat_target: "intel", base_magnitude: 1, duration: 0 }
)

upsert_spell(
  name: "Mage Armor",
  description: "Protective ward. +4 Army Defense for 4 hours.",
  rank: 2, affinity: "general", mana_cost: 40, research_cost: 500,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 4, duration: 14400 }
)

upsert_spell(
  name: "Magic Missile",
  description: "Barrage of force. +5 attack bonus when attacking for 4 hours.",
  rank: 2, affinity: "general", mana_cost: 45, research_cost: 600,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 5, duration: 14400 }
)

upsert_spell(
  name: "Focus",
  description: "Channeling trance. Increases Mana production by 20% for 2 hours.",
  rank: 2, affinity: "general", mana_cost: 10, research_cost: 400,
  spell_type: "self",
  configuration: { stat_target: "mana_production", base_magnitude: 20, duration: 7200 }
)

upsert_spell(
  name: "Web",
  description: "Ensnares invaders. +6 defense bonus when defending for 4 hours.",
  rank: 3, affinity: "general", mana_cost: 60, research_cost: 800,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 6, duration: 14400 }
)

upsert_spell(
  name: "Dispel Magic",
  description: "Removes one positive enchantment from an enemy kingdom.",
  rank: 4, affinity: "general", mana_cost: 80, research_cost: 1200,
  spell_type: "enemy",
  configuration: { stat_target: "dispel", base_magnitude: 1, duration: 0 }
)

upsert_spell(
  name: "Phantom Steed",
  description: "Summons a magical mount to join your ranks.",
  rank: 3, affinity: "general", mana_cost: 50, research_cost: 900,
  spell_type: "summon",
  configuration: { unit_slug: "phantom_steed", quantity: 1 }
)

upsert_spell(
  name: "Dimension Door",
  description: "Shortens the duration of current Exploration by 50%.",
  rank: 5, affinity: "general", mana_cost: 150, research_cost: 2500,
  spell_type: "self",
  configuration: { stat_target: "exploration_speed", base_magnitude: 50, duration: 3600 }
)

upsert_spell(
  name: "Wall of Force",
  description: "Impenetrable barrier. +15 defense bonus when defending for 2 hours.",
  rank: 6, affinity: "general", mana_cost: 200, research_cost: 4000,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 15, duration: 7200 }
)

upsert_spell(
  name: "True Seeing",
  description: "Reveals exact unit counts and building levels of a target kingdom.",
  rank: 7, affinity: "general", mana_cost: 250, research_cost: 6000,
  spell_type: "enemy",
  configuration: { stat_target: "intel", base_magnitude: 2, duration: 0 }
)

upsert_spell(
  name: "Time Stop",
  description: "Chronal Shift. Instantly completes all active building constructions.",
  rank: 9, affinity: "general", mana_cost: 500, research_cost: 15000,
  spell_type: "self",
  configuration: { stat_target: "build_speed", base_magnitude: 100, duration: 0 }
)

upsert_spell(
  name: "Wish",
  description: "Reality bending. Grants a massive amount of Gold, Mana, and Population.",
  rank: 10, affinity: "general", mana_cost: 1000, research_cost: 50000,
  spell_type: "self",
  configuration: { stat_target: "resources", base_magnitude: 500, duration: 0 }
)

# ═══════════════════════════════════════════════════════════════════
# PYROMANCER (Red/Fire) — Aggressive, high damage, glass cannon
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Flame Lance",
  description: "Searing blast. +4 attack bonus when attacking for 4 hours.",
  rank: 1, affinity: "pyromancer", mana_cost: 25, research_cost: 200,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 4, duration: 14400 }
)

upsert_spell(
  name: "Fireball",
  description: "Explosive destruction. +8 attack bonus when attacking for 4 hours.",
  rank: 2, affinity: "pyromancer", mana_cost: 50, research_cost: 800,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 8, duration: 14400 }
)

upsert_spell(
  name: "Summon Fire Elemental",
  description: "Conjures a living inferno to serve you.",
  rank: 2, affinity: "pyromancer", mana_cost: 80, research_cost: 1000,
  spell_type: "summon",
  configuration: { unit_slug: "fire_elemental", quantity: 1 }
)

upsert_spell(
  name: "Summon Phoenix",
  description: "Summons a being of living flame.",
  rank: 4, affinity: "pyromancer", mana_cost: 150, research_cost: 2500,
  spell_type: "summon",
  configuration: { unit_slug: "phoenix", quantity: 1 }
)

upsert_spell(
  name: "Molten Shield",
  description: "Magma barrier. +5 defense bonus for 3 hours. Burns attackers.",
  rank: 3, affinity: "pyromancer", mana_cost: 70, research_cost: 1200,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 5, duration: 10800 }
)

upsert_spell(
  name: "Inferno",
  description: "Devastating firestorm. +15 attack bonus when attacking for 2 hours.",
  rank: 5, affinity: "pyromancer", mana_cost: 200, research_cost: 3500,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 15, duration: 7200 }
)

# ═══════════════════════════════════════════════════════════════════
# MINDWEAVER (Blue/Illusion) — Control, deception, intel
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Confusion",
  description: "Sows chaos. +5 defense bonus for 4 hours (enemy miscoordinates).",
  rank: 1, affinity: "mindweaver", mana_cost: 30, research_cost: 300,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 5, duration: 14400 }
)

upsert_spell(
  name: "Mind Blast",
  description: "Psychic assault. +6 attack bonus when attacking for 4 hours.",
  rank: 2, affinity: "mindweaver", mana_cost: 50, research_cost: 800,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 6, duration: 14400 }
)

upsert_spell(
  name: "Mirror Image",
  description: "Illusory doubles. +8 defense bonus for 4 hours.",
  rank: 3, affinity: "mindweaver", mana_cost: 80, research_cost: 1500,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 8, duration: 14400 }
)

upsert_spell(
  name: "Summon Mirror Knight",
  description: "Conjures an illusory warrior that reflects damage.",
  rank: 3, affinity: "mindweaver", mana_cost: 100, research_cost: 1800,
  spell_type: "summon",
  configuration: { unit_slug: "mirror_knight", quantity: 1 }
)

upsert_spell(
  name: "Dominate",
  description: "Seize control. +12 attack bonus when attacking for 2 hours.",
  rank: 4, affinity: "mindweaver", mana_cost: 150, research_cost: 2500,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 12, duration: 7200 }
)

upsert_spell(
  name: "Mass Hysteria",
  description: "Panic grips the enemy. +10 defense bonus for 3 hours.",
  rank: 5, affinity: "mindweaver", mana_cost: 180, research_cost: 3500,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 10, duration: 10800 }
)

# ═══════════════════════════════════════════════════════════════════
# GEOMANCER (Green/Nature) — Defensive, tanky, sustain
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Barkskin",
  description: "Toughens armor with bark. +4 defense bonus for 4 hours.",
  rank: 1, affinity: "geomancer", mana_cost: 25, research_cost: 200,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 4, duration: 14400 }
)

upsert_spell(
  name: "Stone Skin",
  description: "Hardens unit armor. +8 defense bonus for 4 hours.",
  rank: 2, affinity: "geomancer", mana_cost: 50, research_cost: 800,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 8, duration: 14400 }
)

upsert_spell(
  name: "Earthquake",
  description: "Shakes the battlefield. +6 attack bonus when attacking for 4 hours.",
  rank: 2, affinity: "geomancer", mana_cost: 60, research_cost: 1000,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 6, duration: 14400 }
)

upsert_spell(
  name: "Summon Treant",
  description: "Animates a protector of the forest.",
  rank: 3, affinity: "geomancer", mana_cost: 100, research_cost: 1500,
  spell_type: "summon",
  configuration: { unit_slug: "treant", quantity: 1 }
)

upsert_spell(
  name: "Summon Earth Golem",
  description: "Forges an indestructible stone guardian.",
  rank: 5, affinity: "geomancer", mana_cost: 200, research_cost: 3500,
  spell_type: "summon",
  configuration: { unit_slug: "earth_golem", quantity: 1 }
)

upsert_spell(
  name: "Ironwood Fortress",
  description: "Nature's bulwark. +18 defense bonus for 2 hours.",
  rank: 5, affinity: "geomancer", mana_cost: 180, research_cost: 3000,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 18, duration: 7200 }
)

# ═══════════════════════════════════════════════════════════════════
# TEMPEST (Yellow/Air) — Speed, evasion, lightning
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Call Storm Wisp",
  description: "Congregate static electricity into a sentient wisp.",
  rank: 1, affinity: "tempest", mana_cost: 40, research_cost: 150,
  spell_type: "summon",
  configuration: { unit_slug: "storm_wisp", quantity: 1 }
)

upsert_spell(
  name: "Tailwind",
  description: "Favorable winds. +4 attack bonus for 4 hours.",
  rank: 1, affinity: "tempest", mana_cost: 25, research_cost: 200,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 4, duration: 14400 }
)

upsert_spell(
  name: "Fog",
  description: "Dense fog hides your army size from rankings.",
  rank: 2, affinity: "tempest", mana_cost: 60, research_cost: 500,
  spell_type: "self",
  configuration: {
    stat_target: "army_size_hidden",
    base_magnitude: 1,
    duration: 14400,
    scaling: { attribute: "duration", function: "linear", rate: 50, base: 0, unit: "seconds" }
  }
)

upsert_spell(
  name: "Chain Lightning",
  description: "Strikes multiple targets. +10 attack bonus when attacking for 3 hours.",
  rank: 3, affinity: "tempest", mana_cost: 70, research_cost: 1200,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 10, duration: 10800 }
)

upsert_spell(
  name: "Haste",
  description: "Swift marches. +6 attack and speed bonus for 4 hours.",
  rank: 3, affinity: "tempest", mana_cost: 80, research_cost: 1500,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 6, duration: 14400 }
)

upsert_spell(
  name: "Summon Thunderbird",
  description: "Calls a massive storm-born raptor from the clouds.",
  rank: 4, affinity: "tempest", mana_cost: 160, research_cost: 2500,
  spell_type: "summon",
  configuration: { unit_slug: "thunderbird", quantity: 1 }
)

upsert_spell(
  name: "Static Field",
  description: "Crackling barrier. +7 defense bonus for 4 hours.",
  rank: 3, affinity: "tempest", mana_cost: 65, research_cost: 1000,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 7, duration: 14400 }
)

# ═══════════════════════════════════════════════════════════════════
# VOIDWALKER (Black/Dark) — Necromancy, drain, swarm
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Raise Dead",
  description: "Raises a Ghoul from the earth to serve you.",
  rank: 1, affinity: "voidwalker", mana_cost: 35, research_cost: 150,
  spell_type: "summon",
  configuration: { unit_slug: "ghoul", quantity: 2 }
)

upsert_spell(
  name: "Dark Pact",
  description: "Unholy strength. +5 attack bonus for 4 hours.",
  rank: 1, affinity: "voidwalker", mana_cost: 30, research_cost: 250,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 5, duration: 14400 }
)

upsert_spell(
  name: "Life Drain",
  description: "Vampiric rite. +7 attack bonus and steals life for 4 hours.",
  rank: 2, affinity: "voidwalker", mana_cost: 60, research_cost: 1000,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 7, duration: 14400 }
)

upsert_spell(
  name: "Summon Shade",
  description: "Call forth a shadow from the void.",
  rank: 3, affinity: "voidwalker", mana_cost: 100, research_cost: 1500,
  spell_type: "summon",
  configuration: { unit_slug: "shade", quantity: 1 }
)

upsert_spell(
  name: "Bone Armor",
  description: "Shield of the dead. +6 defense bonus for 4 hours.",
  rank: 2, affinity: "voidwalker", mana_cost: 45, research_cost: 800,
  spell_type: "defense",
  configuration: { stat_target: "army_defense", base_magnitude: 6, duration: 14400 }
)

upsert_spell(
  name: "Summon Wraith",
  description: "Binds a tormented spirit to your service.",
  rank: 5, affinity: "voidwalker", mana_cost: 200, research_cost: 3500,
  spell_type: "summon",
  configuration: { unit_slug: "wraith", quantity: 1 }
)

upsert_spell(
  name: "Soul Harvest",
  description: "Reap the battlefield. +14 attack bonus when attacking for 2 hours.",
  rank: 4, affinity: "voidwalker", mana_cost: 150, research_cost: 2500,
  spell_type: "attack",
  configuration: { stat_target: "army_attack", base_magnitude: 14, duration: 7200 }
)

# ═══════════════════════════════════════════════════════════════════
# SECOND WAVE OF SUMMONS — a swarm option and an apex creature per school
# (invest more mana at cast time to summon proportionally more)
# ═══════════════════════════════════════════════════════════════════

upsert_spell(
  name: "Summon Ember Imps",
  description: "Sparks a mischief of living cinders. Cheap, fast, and eager to burn.",
  rank: 1, affinity: "pyromancer", mana_cost: 40, research_cost: 200,
  spell_type: "summon",
  configuration: { unit_slug: "ember_imp", quantity: 3 }
)

upsert_spell(
  name: "Summon Magma Behemoth",
  description: "Calls a mountain of molten rock up from the deep. The earth groans under it.",
  rank: 6, affinity: "pyromancer", mana_cost: 260, research_cost: 4800,
  spell_type: "summon",
  configuration: { unit_slug: "magma_behemoth", quantity: 1 }
)

upsert_spell(
  name: "Summon Tide Serpent",
  description: "Coils a serpent of storm-water into being — swift, slippery, spiteful.",
  rank: 2, affinity: "tempest", mana_cost: 90, research_cost: 800,
  spell_type: "summon",
  configuration: { unit_slug: "tide_serpent", quantity: 1 }
)

upsert_spell(
  name: "Summon Storm Titan",
  description: "Binds a walking thunderhead to your banner. Lightning follows it to war.",
  rank: 6, affinity: "tempest", mana_cost: 250, research_cost: 4500,
  spell_type: "summon",
  configuration: { unit_slug: "storm_titan", quantity: 1 }
)

upsert_spell(
  name: "Summon Thorn Sprites",
  description: "Wakes a handful of bramble spirits armed with needle and spite.",
  rank: 1, affinity: "geomancer", mana_cost: 35, research_cost: 150,
  spell_type: "summon",
  configuration: { unit_slug: "thorn_sprite", quantity: 3 }
)

upsert_spell(
  name: "Summon Mountain Wyrm",
  description: "Wakes the serpent sleeping under the range. It rises hungry.",
  rank: 6, affinity: "geomancer", mana_cost: 270, research_cost: 4800,
  spell_type: "summon",
  configuration: { unit_slug: "mountain_wyrm", quantity: 1 }
)

upsert_spell(
  name: "Summon Dream Wisps",
  description: "Loosens a few flickers of borrowed thought into the waking world.",
  rank: 1, affinity: "mindweaver", mana_cost: 35, research_cost: 150,
  spell_type: "summon",
  configuration: { unit_slug: "dream_wisp", quantity: 3 }
)

upsert_spell(
  name: "Summon Thought Tyrant",
  description: "Gives a vast and terrible intellect a body. Its scream rends formations.",
  rank: 6, affinity: "mindweaver", mana_cost: 250, research_cost: 4500,
  spell_type: "summon",
  configuration: { unit_slug: "thought_tyrant", quantity: 1 }
)

upsert_spell(
  name: "Summon Bone Dragon",
  description: "Knits a dragon's bones together with pure hatred. It remembers how to fly.",
  rank: 6, affinity: "voidwalker", mana_cost: 280, research_cost: 5000,
  spell_type: "summon",
  configuration: { unit_slug: "bone_dragon", quantity: 1 }
)

puts "Spells seeded: #{Spell.count}"
