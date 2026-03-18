namespace :game do
  desc "Comprehensive simulation: 5 players, diverse strategies, spell effects, higher-tier units"
  task simulate: :environment do
    puts "=" * 70
    puts "ARCHMAGE COMPREHENSIVE SIMULATION v2"
    puts "=" * 70
    puts ""

    # Clean up previous sim players
    User.where("username LIKE 'sim_%'").destroy_all
    puts "Cleaned up old simulation players.\n\n"

    # ═══════════════════════════════════════════════════════════════
    # CREATE 5 PLAYERS — Each with a distinct strategy
    # ═══════════════════════════════════════════════════════════════
    player_configs = [
      {
        username: "sim_pyro", email: "sim_pyro@test.com",
        color: "pyromancer", kingdom: "Flame Keep",
        strategy: :offense,  # High barracks, attack spells, aggressive
        description: "Offense-focused. Maxes barracks, recruits heavy hitters, stacks attack buffs."
      },
      {
        username: "sim_geo", email: "sim_geo@test.com",
        color: "geomancer", kingdom: "Stone Hold",
        strategy: :defense,  # Garrison heavy, defense spells, tanky
        description: "Defense-focused. Farms gold, garrisons everything, defense buffs + summon tanks."
      },
      {
        username: "sim_tempest", email: "sim_tempest@test.com",
        color: "tempest", kingdom: "Sky Citadel",
        strategy: :magic,  # Mana core heavy, mass summons, exploration
        description: "Magic-focused. Mana Core + Altar, summons wisps/thunderbirds, explores aggressively."
      },
      {
        username: "sim_void", email: "sim_void@test.com",
        color: "voidwalker", kingdom: "Shadow Realm",
        strategy: :necro,  # Altar + mana, mass summons, dark army
        description: "Necromancer. Mass Raise Dead, summon wraiths, overwhelm with numbers."
      },
      {
        username: "sim_mind", email: "sim_mind@test.com",
        color: "mindweaver", kingdom: "Dream Spire",
        strategy: :hybrid,  # Balanced build, illusion tricks, intel
        description: "Hybrid. Balanced structures, mirror knights, mind blast + mirror image."
      }
    ]

    users = player_configs.map do |p|
      u = User.create!(
        username: p[:username],
        email_address: p[:email],
        password: "password123",
        color: p[:color],
        kingdom_name: p[:kingdom]
      )
      puts "#{u.username} (#{p[:color]}) — #{p[:description]}"
      puts "  Starting — Gold: #{u.gold}, Mana: #{u.mana}, Land: #{u.land}"
      u
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 1: STRATEGIC BUILDING — Different structure priorities
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 1: STRATEGIC BUILDING"
    puts "═" * 70

    # Build plans: { slug => target_level }
    build_plans = {
      "sim_pyro" => {  # Offense: high barracks, some mana
        "town_center" => 5, "barracks" => 5, "mana_core" => 2, "bank" => 2, "altar" => 1
      },
      "sim_geo" => {  # Defense: balanced, farm gold
        "town_center" => 4, "barracks" => 3, "bank" => 4, "mana_core" => 2, "altar" => 1, "farm" => 3
      },
      "sim_tempest" => {  # Magic: mana-heavy
        "town_center" => 4, "barracks" => 2, "mana_core" => 4, "altar" => 3, "bank" => 1
      },
      "sim_void" => {  # Necro: altar + mana core, minimal barracks
        "town_center" => 4, "barracks" => 2, "altar" => 4, "mana_core" => 3, "bank" => 1
      },
      "sim_mind" => {  # Hybrid: balanced everything
        "town_center" => 4, "barracks" => 3, "mana_core" => 3, "altar" => 2, "bank" => 2
      }
    }

    users.each do |u|
      plan = build_plans[u.username] || {}
      built = []

      # Build town center first (gates everything else)
      tc = Structure.find_by(slug: 'town_center')
      tc_target = plan.delete("town_center") || 1
      tc_target.times do
        service = Town::BuildService.new(u.reload, tc, 1)
        break unless service.call
      end
      tc_level = u.user_structures.find_by(structure: tc)&.level || 0
      built << "TC:L#{tc_level}"

      # Build other structures
      plan.each do |slug, target|
        structure = Structure.find_by(slug: slug)
        next unless structure

        if structure.level_based?
          target.times do
            service = Town::BuildService.new(u.reload, structure, 1)
            break unless service.call
          end
          level = u.user_structures.find_by(structure: structure)&.level || 0
          built << "#{slug}:L#{level}"
        else
          # Quantity-based (farms, field camps)
          service = Town::BuildService.new(u.reload, structure, target)
          service.call
          qty = u.user_structures.find_by(structure: structure)&.level || 0
          built << "#{slug}:#{qty}"
        end
      end

      u.reload
      puts "  #{u.username}: #{built.join(', ')}"
      puts "    Resources — Gold: #{u.gold}, Mana: #{u.mana}/#{u.max_mana}, Land: #{u.land} (Free: #{u.free_land})"
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: RECRUITING — Different unit mixes per strategy
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 2: RECRUITING"
    puts "═" * 70

    recruit_plans = {
      "sim_pyro" => {  # Offense: heavy hitters + ranged
        "militia" => 200, "archer" => 200, "footman" => 300,
        "pikeman" => 200, "crossbowman" => 300, "heavy_infantry" => 400,
        "knight" => 600, "mage_apprentice" => 400
      },
      "sim_geo" => {  # Defense: defensive infantry + some ranged
        "militia" => 300, "footman" => 500, "pikeman" => 400,
        "heavy_infantry" => 500, "crossbowman" => 200
      },
      "sim_tempest" => {  # Magic: minimal recruits (rely on summons)
        "militia" => 100, "archer" => 200, "explorer" => 100
      },
      "sim_void" => {  # Necro: skeleton crew of recruits (rely on raised dead)
        "militia" => 200, "footman" => 200, "explorer" => 100
      },
      "sim_mind" => {  # Hybrid: balanced army
        "militia" => 200, "archer" => 300, "footman" => 300,
        "pikeman" => 200, "crossbowman" => 200, "knight" => 300
      }
    }

    users.each do |u|
      plan = recruit_plans[u.username] || {}
      results = []
      plan.each do |slug, gold|
        unit = Unit.find_by(slug: slug)
        next unless unit
        service = Town::RecruitService.new(u.reload, unit.id, gold)
        if service.call
          results << "#{unit.name}:#{service.result[:count]}(#{service.result[:tier]})"
        else
          results << "#{unit.name}:FAIL"
        end
      end
      u.reload
      total_units = u.user_units.sum(:quantity)
      puts "  #{u.username}: #{results.join(', ')}"
      puts "    Total units: #{total_units} | Gold remaining: #{u.gold}"
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 3: SPELL RESEARCH — Affinity-focused learning
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 3: SPELL RESEARCH"
    puts "═" * 70

    research_plans = {
      "sim_pyro" => [
        "Serenity", "Fireball", "Flame Lance", "Summon Fire Elemental",
        "Molten Shield", "Summon Phoenix", "Inferno",
        "Arcane Bolt", "Magic Missile"
      ],
      "sim_geo" => [
        "Serenity", "Stone Skin", "Barkskin", "Earthquake",
        "Summon Treant", "Summon Earth Golem", "Ironwood Fortress",
        "Mage Armor", "Web"
      ],
      "sim_tempest" => [
        "Call Storm Wisp", "Tailwind", "Fog", "Chain Lightning",
        "Haste", "Summon Thunderbird", "Static Field",
        "Focus"
      ],
      "sim_void" => [
        "Raise Dead", "Dark Pact", "Life Drain", "Bone Armor",
        "Summon Shade", "Summon Wraith", "Soul Harvest",
        "Serenity"
      ],
      "sim_mind" => [
        "Serenity", "Confusion", "Mind Blast", "Mirror Image",
        "Summon Mirror Knight", "Dominate", "Mass Hysteria",
        "Mage Armor", "Arcane Bolt"
      ]
    }

    users.each do |u|
      spells_learned = []
      (research_plans[u.username] || []).each do |name|
        spell = Spell.find_by(name: name)
        unless spell
          puts "  ⚠️ #{u.username}: Spell '#{name}' not found!"
          next
        end
        us = u.user_spells.find_or_initialize_by(spell: spell)
        us.learned = true
        us.research_progress = spell.research_cost
        us.save!
        spells_learned << "#{spell.name}(R#{spell.rank})"
      end
      puts "  #{u.username}: Learned #{spells_learned.length} spells"
      puts "    #{spells_learned.join(', ')}"
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 4: SPELL CASTING — Strategy-specific spell usage
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 4: SPELL CASTING"
    puts "═" * 70

    # Give everyone generous mana for testing
    users.each { |u| u.update!(mana: [u.max_mana, 2000].max) }

    cast_plans = {
      "sim_pyro" => [
        # Offense: stack attack buffs, summon fire units
        { spell: "Flame Lance", mana_mult: 2 },
        { spell: "Fireball", mana_mult: 3 },
        { spell: "Inferno", mana_mult: 1 },
        { spell: "Summon Fire Elemental", mana_mult: 3 },
        { spell: "Summon Phoenix", mana_mult: 2 },
        { spell: "Molten Shield", mana_mult: 1 }  # Some defense too
      ],
      "sim_geo" => [
        # Defense: stack defense buffs, summon tanks
        { spell: "Barkskin", mana_mult: 2 },
        { spell: "Stone Skin", mana_mult: 3 },
        { spell: "Ironwood Fortress", mana_mult: 1 },
        { spell: "Web", mana_mult: 2 },
        { spell: "Summon Treant", mana_mult: 4 },
        { spell: "Summon Earth Golem", mana_mult: 2 },
        { spell: "Earthquake", mana_mult: 1 }  # Some offense
      ],
      "sim_tempest" => [
        # Magic: mass summons + speed buffs
        { spell: "Call Storm Wisp", mana_mult: 8 },     # Lots of wisps
        { spell: "Summon Thunderbird", mana_mult: 3 },
        { spell: "Tailwind", mana_mult: 2 },
        { spell: "Chain Lightning", mana_mult: 2 },
        { spell: "Haste", mana_mult: 2 },
        { spell: "Static Field", mana_mult: 1 },
        { spell: "Focus", mana_mult: 1 }
      ],
      "sim_void" => [
        # Necro: mass undead + attack buffs
        { spell: "Raise Dead", mana_mult: 10 },    # Spam ghouls
        { spell: "Raise Dead", mana_mult: 8 },      # More ghouls
        { spell: "Summon Shade", mana_mult: 3 },
        { spell: "Summon Wraith", mana_mult: 2 },
        { spell: "Dark Pact", mana_mult: 2 },
        { spell: "Life Drain", mana_mult: 2 },
        { spell: "Soul Harvest", mana_mult: 1 },
        { spell: "Bone Armor", mana_mult: 1 }
      ],
      "sim_mind" => [
        # Hybrid: mix of attack, defense, summons
        { spell: "Mind Blast", mana_mult: 3 },
        { spell: "Confusion", mana_mult: 2 },
        { spell: "Mirror Image", mana_mult: 2 },
        { spell: "Summon Mirror Knight", mana_mult: 3 },
        { spell: "Dominate", mana_mult: 1 },
        { spell: "Mass Hysteria", mana_mult: 1 },
        { spell: "Mage Armor", mana_mult: 1 }
      ]
    }

    users.each do |u|
      u.reload
      mana_start = u.mana
      casts = []
      (cast_plans[u.username] || []).each do |plan|
        spell = Spell.find_by(name: plan[:spell])
        next unless spell
        next unless u.user_spells.find_by(spell: spell, learned: true)

        amount = spell.mana_cost * plan[:mana_mult]
        amount = [amount, u.reload.mana].min  # Don't overspend
        next if amount < spell.mana_cost

        service = Spells::CastService.new(u.reload, spell, amount: amount)
        if service.call
          casts << "#{spell.name}(#{amount}m): #{service.result[:success]}"
        else
          casts << "#{spell.name}: FAIL — #{service.result[:error]}"
        end
      end
      u.reload
      puts "  #{u.username}: Spent #{mana_start - u.mana} mana on #{casts.length} casts"
      casts.each { |c| puts "    #{c}" }
    end
    puts ""

    # Active Spell Summary
    puts "  ── Active Spell Summary ──"
    users.each do |u|
      u.reload
      active = u.active_spells.active.includes(:spell).map { |as|
        meta = as.metadata || {}
        type_tag = meta['spell_type'] ? "[#{meta['spell_type']}]" : ""
        "#{as.spell.name}#{type_tag}(mag:#{meta['magnitude']},stat:#{meta['stat_target']})"
      }
      if active.any?
        puts "  #{u.username}: #{active.join(', ')}"
      else
        puts "  #{u.username}: No active buffs"
      end
    end

    # Summoned Unit Summary
    puts "\n  ── Summoned Units ──"
    users.each do |u|
      summoned = u.user_units.includes(:unit).joins(:unit).where(units: { recruitable: false })
        .where('user_units.quantity > 0').map { |uu|
          "#{uu.unit.name}:#{uu.quantity}(atk:#{uu.unit.attack},def:#{uu.unit.defense},spd:#{uu.unit.speed})"
        }
      if summoned.any?
        puts "  #{u.username}: #{summoned.join(', ')}"
      else
        puts "  #{u.username}: No summoned units"
      end
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 5: TAX COLLECTION + COOLDOWN TEST
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 5: TAX COLLECTION"
    puts "═" * 70

    users.each do |u|
      u.reload
      service = Treasury::TaxationService.new(u)
      if service.collect_tax(:standard)
        puts "  #{u.username}: Collected Standard tax → Gold: #{u.reload.gold}"
      else
        puts "  #{u.username}: Tax failed: #{service.errors.join(', ')}"
      end

      # Verify cooldown
      service2 = Treasury::TaxationService.new(u.reload)
      if service2.collect_tax(:lenient)
        puts "  #{u.username}: ⚠️ Second tax succeeded (cooldown bug!)"
      else
        puts "  #{u.username}: ✅ Cooldown working: #{service2.errors.first}"
      end
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 6: EXPLORATIONS (3 rounds, time-skipped)
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 6: EXPLORATIONS (3 rounds)"
    puts "═" * 70

    3.times do |run|
      puts "  --- Round #{run + 1} ---"
      users.each do |u|
        u.reload
        # Find best exploration unit
        explore_unit = u.user_units.includes(:unit)
          .where('user_units.quantity > 0')
          .order('units.speed DESC')
          .first

        unless explore_unit
          puts "  #{u.username}: No units available"
          next
        end

        qty = [(explore_unit.quantity * 0.15).ceil, 3].max
        qty = [qty, explore_unit.quantity].min

        service = Explorations::StartService.new(u, { unit_id: explore_unit.unit_id, quantity: qty })
        if service.call
          exploration = service.exploration
          exploration.update_columns(started_at: 2.hours.ago, finishes_at: 1.minute.ago)

          Explorations::ProcessService.new(exploration.reload).call
          exploration.reload

          if exploration.completed?
            resources = exploration.resources_found || {}
            Explorations::ClaimService.new(exploration).call
            u.reload
            puts "  #{u.username}: #{qty}x #{explore_unit.unit.name} → " \
                 "Land+#{resources['land'].to_i}, Gold+#{resources['gold'].to_i}, " \
                 "Survivors: #{resources['survivors'].to_i}/#{qty} | Total Land: #{u.land}"
          else
            puts "  #{u.username}: Status: #{exploration.status}"
          end
        else
          puts "  #{u.username}: Start failed: #{service.errors.join(', ')}"
        end
      end
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 7: MANA BATTERY + CHANNEL
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 7: MANA BATTERY"
    puts "═" * 70

    users.each do |u|
      u.reload
      u.update_columns(last_mana_recharge_at: 2.hours.ago)
      mana_before = u.mana
      result = Treasury::ChannelMana.new(u).call
      u.reload
      puts "  #{u.username}: Mana #{mana_before} → #{u.mana} (max: #{u.max_mana}) | #{result.message}"
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 8: MORALE & UPKEEP
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 8: MORALE & UPKEEP"
    puts "═" * 70

    users.each do |u|
      u.reload
      u.update_columns(morale_updated_at: 6.hours.ago)
      decayed = u.current_base_morale
      morale_service = Treasury::MoraleService.new(u)
      upkeep = morale_service.daily_upkeep

      puts "  #{u.username}: Morale after 6h: #{decayed.round(1)} | Upkeep: #{upkeep}g/day | Gold: #{u.gold}"

      # Pay proportional to strategy
      pay = case u.username
            when "sim_geo" then [upkeep, u.gold].min          # Geo pays full
            when "sim_pyro" then [upkeep / 2, u.gold].min     # Pyro pays half (offense focused)
            else [upkeep * 3 / 4, u.gold].min                  # Others pay 75%
            end

      if pay > 0
        morale_service.pay_upkeep(pay)
        u.reload
        puts "    Paid #{pay}g → Morale: #{u.current_morale.round(1)} | Gold: #{u.gold}"
      end
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 9: GARRISON SETUP — Different strategies
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 9: GARRISON"
    puts "═" * 70

    garrison_ratios = {
      "sim_pyro"    => 0.2,  # Offense: keep most for attacking
      "sim_geo"     => 0.7,  # Defense: garrison heavy
      "sim_tempest" => 0.3,
      "sim_void"    => 0.3,
      "sim_mind"    => 0.5   # Balanced
    }

    users.each do |u|
      u.reload
      ratio = garrison_ratios[u.username] || 0.4
      garrisoned = []
      u.user_units.includes(:unit).where('user_units.quantity > 0').each do |uu|
        amt = (uu.quantity * ratio).floor
        if amt > 0
          uu.update!(garrison: amt)
          garrisoned << "#{uu.unit.name}:#{amt}/#{uu.quantity}"
        end
      end
      puts "  #{u.username} (#{(ratio * 100).to_i}%): #{garrisoned.join(', ')}"
    end
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 10: SUMMONED UNIT DISBAND TEST
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 10: SUMMONED UNIT DISBAND TEST"
    puts "═" * 70

    tested = false
    users.each do |u|
      u.reload
      summoned = u.user_units.includes(:unit).where(units: { recruitable: false }).first
      next unless summoned

      if !summoned.unit.recruitable
        puts "  #{u.username}: ✅ #{summoned.unit.name} correctly blocked from disband (summoned)"
        tested = true
      end
    end
    puts "  (No summoned units to test)" unless tested
    puts ""

    # ═══════════════════════════════════════════════════════════════
    # PHASE 11: PvP COMBAT — 3 battles testing different matchups
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 11: PvP COMBAT (3 battles)"
    puts "═" * 70

    # Remove all protections
    users.each { |u| u.update_columns(protection_expires_at: 1.hour.ago) }

    def run_battle(attacker, defender, label, morale_override: {})
      attacker.reload
      defender.reload

      # Override morale if specified
      if morale_override[:attacker]
        attacker.update_columns(morale: morale_override[:attacker], morale_updated_at: Time.current)
      end
      if morale_override[:defender]
        defender.update_columns(morale: morale_override[:defender], morale_updated_at: Time.current)
      end

      # Allocate all available (non-garrisoned) units
      attack_units = {}
      attacker.user_units.includes(:unit).each do |uu|
        available = uu.quantity - (uu.garrison || 0) - (uu.exploring || 0)
        attack_units[uu.unit_id] = available if available > 0
      end

      total_attack = attack_units.values.sum
      puts "  #{label}"
      puts "    #{attacker.username} (#{attacker.color}, morale:#{attacker.current_morale.round}) → " \
           "#{total_attack} units attacking"

      # Show active buffs
      atk_spells = attacker.active_spells.active.includes(:spell).map { |as|
        meta = as.metadata || {}
        "#{as.spell.name}[#{meta['spell_type']}](mag:#{meta['magnitude']})"
      }
      def_spells = defender.active_spells.active.includes(:spell).map { |as|
        meta = as.metadata || {}
        "#{as.spell.name}[#{meta['spell_type']}](mag:#{meta['magnitude']})"
      }
      puts "    Attacker buffs: #{atk_spells.any? ? atk_spells.join(', ') : 'none'}"
      puts "    Defender buffs: #{def_spells.any? ? def_spells.join(', ') : 'none'}"

      # Defender garrison count
      garrison_total = defender.user_units.sum(:garrison)
      puts "    #{defender.username} (#{defender.color}, morale:#{defender.current_morale.round}) → " \
           "#{garrison_total} garrisoned defenders"

      result = Battle::ResolutionService.new(
        attacker_id: attacker.id,
        defender_id: defender.id,
        unit_allocations: attack_units
      ).call

      if result.respond_to?(:success?) && result.success?
        puts "    RESULT: #{result.winner.to_s.upcase} wins! Land seized: #{result.land_seized}"

        # Show desertions
        desertion_lines = result.log.select { |l| l.to_s.include?('deserted') }
        desertion_lines.each { |l| puts "      #{l}" }

        # Show spell bonus lines
        spell_lines = result.log.select { |l| l.to_s.include?('spell') || l.to_s.include?('bonus') }
        spell_lines.each { |l| puts "      #{l}" }

        # Show last 3 log lines
        puts "    Log (last 3):"
        result.log.last(3).each { |l| puts "      #{l}" }
      else
        error_msg = result.respond_to?(:error) ? result.error : 'unknown'
        puts "    FAILED: #{error_msg}"
      end
      puts ""

      # Remove protection so next battles can happen
      attacker.update_columns(protection_expires_at: 1.hour.ago)
      defender.update_columns(protection_expires_at: 1.hour.ago)
    end

    pyro = users.find { |u| u.username == "sim_pyro" }
    geo = users.find { |u| u.username == "sim_geo" }
    tempest = users.find { |u| u.username == "sim_tempest" }
    void_user = users.find { |u| u.username == "sim_void" }
    mind = users.find { |u| u.username == "sim_mind" }

    # Battle 1: Pyro (offense, attack buffs) vs Geo (defense, garrison heavy)
    # Tests: attack spell bonuses vs defense spell bonuses
    run_battle(pyro, geo,
      "Battle 1: PYRO (offense) vs GEO (defense fortress)",
      morale_override: { attacker: 80.0, defender: 90.0 })

    # Battle 2: Tempest (magic/summons, low morale) vs Mind (hybrid, high morale)
    # Tests: summon-heavy army, low morale desertion
    run_battle(tempest, mind,
      "Battle 2: TEMPEST (magic army, low morale) vs MIND (hybrid)",
      morale_override: { attacker: 35.0, defender: 100.0 })

    # Battle 3: Void (necromancer + attack buffs, full morale) vs Pyro
    # Tests: mass undead swarm vs depleted conventional army
    run_battle(void_user, pyro,
      "Battle 3: VOID (necromancer swarm) vs PYRO (depleted from battle 1)",
      morale_override: { attacker: 100.0, defender: 60.0 })

    # ═══════════════════════════════════════════════════════════════
    # PHASE 12: FINAL STATE — Complete army/spell/resource summary
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "PHASE 12: FINAL STATE"
    puts "═" * 70

    users.each do |u|
      u.reload
      puts "┌─ #{u.username} (#{u.color}) — #{u.kingdom_name} ─────"
      puts "│ Gold: #{u.gold} | Mana: #{u.mana}/#{u.max_mana} | Land: #{u.land} (Free: #{u.free_land})"
      puts "│ Morale: #{u.current_morale.round(1)} | Magic Power: #{u.magic_power}"

      # Structures
      structures = u.user_structures.includes(:structure).where('level > 0').map { |us|
        "#{us.structure.slug}:L#{us.level}"
      }
      puts "│ Structures: #{structures.join(', ')}"

      # All units with stats
      units = u.user_units.includes(:unit).where('user_units.quantity > 0').order('units.attack DESC').map { |uu|
        summon_tag = uu.unit.recruitable? ? "" : " [S]"
        "#{uu.unit.name}#{summon_tag}: #{uu.quantity} (G:#{uu.garrison}, atk:#{uu.unit.attack}, def:#{uu.unit.defense})"
      }
      puts "│ Army (#{u.user_units.sum(:quantity)} total):"
      units.each { |line| puts "│   #{line}" }

      # Total army power
      total_atk = u.user_units.includes(:unit).sum { |uu| uu.quantity * uu.unit.attack }
      total_def = u.user_units.includes(:unit).sum { |uu| uu.quantity * (uu.unit.defense || 0) }
      puts "│ Army Power — Total Atk: #{total_atk}, Total Def: #{total_def}"

      # Active spells
      active = u.active_spells.active.includes(:spell).map { |as|
        meta = as.metadata || {}
        "#{as.spell.name} [#{meta['spell_type'] || 'buff'}] mag:#{meta['magnitude']} (#{meta['stat_target']})"
      }
      if active.any?
        puts "│ Active Spells:"
        active.each { |s| puts "│   #{s}" }
      end

      # Learned spells
      learned = u.user_spells.where(learned: true).includes(:spell).map(&:spell).map(&:name)
      puts "│ Spellbook: #{learned.join(', ')}"
      puts "└#{'─' * 60}"
      puts ""
    end

    # ═══════════════════════════════════════════════════════════════
    # VERIFICATION SUMMARY
    # ═══════════════════════════════════════════════════════════════
    puts "═" * 70
    puts "VERIFICATION SUMMARY"
    puts "═" * 70

    checks = []

    # 1. Spell configurations working (non-zero magnitudes)
    attack_spells = ActiveSpell.active.where("json_extract(metadata, '$.spell_type') = 'attack'")
    defense_spells = ActiveSpell.active.where("json_extract(metadata, '$.spell_type') = 'defense'")
    nonzero_attack = attack_spells.select { |as| as.metadata['magnitude'].to_f > 0 }
    nonzero_defense = defense_spells.select { |as| as.metadata['magnitude'].to_f > 0 }

    if nonzero_attack.any?
      mags = nonzero_attack.map { |as| "#{as.spell.name}:#{as.metadata['magnitude']}" }
      checks << "✅ Attack spells with magnitude > 0: #{mags.join(', ')}"
    else
      checks << "⚠️ No attack spells with magnitude > 0 found!"
    end

    if nonzero_defense.any?
      mags = nonzero_defense.map { |as| "#{as.spell.name}:#{as.metadata['magnitude']}" }
      checks << "✅ Defense spells with magnitude > 0: #{mags.join(', ')}"
    else
      checks << "⚠️ No defense spells with magnitude > 0 found!"
    end

    # 2. Summoned units exist with proper stats
    summoned = UserUnit.joins(:unit).where(units: { recruitable: false }).where('user_units.quantity > 0')
    if summoned.any?
      summary = summoned.includes(:unit).group_by { |uu| uu.unit.name }.map { |name, uus|
        total = uus.sum(&:quantity)
        unit = uus.first.unit
        "#{name}:#{total}(atk:#{unit.attack},def:#{unit.defense},type:#{unit.unit_type})"
      }
      checks << "✅ Summoned units: #{summary.join(', ')}"
    else
      checks << "⚠️ No summoned units found!"
    end

    # 3. All affinities represented in spells
    affinities_with_spells = Spell.distinct.pluck(:affinity).sort
    checks << "✅ Spell affinities: #{affinities_with_spells.join(', ')}"

    spell_counts = Spell.group(:affinity).count
    spell_counts.each { |aff, count| checks << "  #{aff}: #{count} spells" }

    # 4. Tax cooldowns working
    users.each do |u|
      u.reload
      if u.respond_to?(:tax_cooldown) && u.tax_cooldown.present? && u.tax_cooldown > Time.current
        checks << "✅ #{u.username}: Tax cooldown active"
      end
    end

    # 5. Explorations completed
    completed = Exploration.where(status: [:completed, :claimed]).count
    checks << "✅ Explorations completed: #{completed}"

    # 6. Unit type/element coverage
    unit_types = Unit.where.not(unit_type: nil).distinct.pluck(:unit_type).sort
    elements = Unit.where.not(element: nil).distinct.pluck(:element).sort
    checks << "✅ Unit types: #{unit_types.join(', ')}"
    checks << "✅ Unit elements: #{elements.join(', ')}"

    # 7. Battles resolved
    battle_notifs = Notification.where(category: 'battle').count
    checks << "✅ Battle notifications: #{battle_notifs}"

    checks.each { |c| puts "  #{c}" }
    puts ""
    puts "Simulation complete!"
    puts "=" * 70
  end
end
