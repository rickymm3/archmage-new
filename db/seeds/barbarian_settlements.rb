# Persistent NPC targets for the Barbarians feature (see BarbarianSettlement,
# Barbarians::AttackService). Each has a level band it respawns within after
# being defeated — higher level means a tougher defending army and better
# odds at rare/legendary item drops (see BarbarianSettlement#rarity_weights).

[
  { slug: "bandit_hideout", name: "Bandit Hideout",
    description: "A ramshackle camp of opportunistic thieves.",
    element: "physical", min_level: 1, max_level: 2 },
  { slug: "wolfsworn_raiders", name: "Wolfsworn Raiders",
    description: "Raiders who run with the wolves of the deep forest.",
    element: "nature", min_level: 2, max_level: 4 },
  { slug: "ironback_camp", name: "Ironback Camp",
    description: "Hardened mercenaries dug into a fortified ridge.",
    element: "physical", min_level: 3, max_level: 5 },
  { slug: "sunken_cultists", name: "Sunken Cultists",
    description: "Cultists who worship something that stirs beneath the marsh.",
    element: "void", min_level: 5, max_level: 7 },
  { slug: "emberfang_warband", name: "Emberfang Warband",
    description: "Marauders who march behind banners of living flame.",
    element: "fire", min_level: 6, max_level: 8 },
  { slug: "stormcallers_bastion", name: "Stormcaller's Bastion",
    description: "A fortress-camp where storm-priests command the weather itself.",
    element: "water", min_level: 8, max_level: 10 },
  { slug: "shrouded_necropolis", name: "Shrouded Necropolis",
    description: "The dead do not rest quietly here, and neither do their keepers.",
    element: "void", min_level: 9, max_level: 10 }
].each do |data|
  settlement = BarbarianSettlement.find_or_initialize_by(slug: data[:slug])
  settlement.assign_attributes(data)
  settlement.level ||= rand(data[:min_level]..data[:max_level])
  settlement.save!
end
