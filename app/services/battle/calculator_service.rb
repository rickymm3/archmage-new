require 'ostruct'

module Battle
  class CalculatorService
    attr_reader :result, :log

    # Multipliers
    TYPE_ADVANTAGE = {
      # Attacker => Strong Against
      'ranged' => ['flying', 'magic'],
      'cavalry' => ['ranged', 'magic'],
      'flying' => ['magic'],
      'infantry' => ['cavalry'],
      'magic' => ['infantry']
    }.freeze

    ELEMENT_ADVANTAGE = {
      'fire' => 'nature',
      'water' => 'fire',
      'nature' => 'water',
      'holy' => 'void',
      'void' => 'holy'
    }.freeze

    def initialize(attacker:, defender:)
      @log = []
      @turn = 0
      
      # We just store the data, Army creation happens in call()
      @attacker_data = attacker
      @defender_data = defender
    end

    def call
      @log << "=== BATTLE START ==="
      
      @attacker_army = Army.new(@attacker_data, :attacker)
      @defender_army = Army.new(@defender_data, :defender)

      @log << "[ATK] #{@attacker_army.name} (Power: #{@attacker_army.current_power})"
      @log << "[DEF] #{@defender_army.name} (Power: #{@defender_army.current_power})"
      
      winner = nil
      reason = nil

      # Battle Loop (Max 10 Rounds)
      10.times do |i|
        round = i + 1
        @log << "\n--- ROUND #{round} ---"

        # 1. Initiative Phase
        # Combine all active stacks from both armies
        all_stacks = (@attacker_army.active_stacks + @defender_army.active_stacks).sort_by { |s| -s.speed }

        if all_stacks.empty?
           winner = :draw
           reason = "Everyone is dead."
           break
        end

        # 2. Action Phase
        all_stacks.each do |stack|
          next if stack.dead? # Specific stack might have died this round

          # Find Enemy Army
          enemy_army = (stack.side == :attacker) ? @defender_army : @attacker_army
          
          # Skip if enemy is wiped out
          next if enemy_army.wiped_out?

          # Select Target
          target = select_target(stack, enemy_army)
          
          if target
            execute_attack(stack, target)
          else
            @log << "#{stack.name} found no valid targets!"
          end
        end

        # 3. End of Round Checks
        
        # 4. Win/Loss/Retreat Check
        if @attacker_army.wiped_out?
          winner = :defender
          reason = "Attacker was annihilated."
          break
        elsif @defender_army.wiped_out?
          winner = :attacker
          reason = "Defender was annihilated."
          break
        end
        
        # Morale/Retreat Check (Simulated)
        if @attacker_army.morale_broken?
           if rand < 0.5 # 50% chance to rout (increased from 30%)
             winner = :defender
             reason = "Attacker retreated in panic!"
             break
           else
             @log << "[ATK] ⚠ Morale is wavering!"
           end
        end

        if @defender_army.morale_broken?
           if rand < 0.5
             winner = :attacker
             reason = "Defender retreated in panic!"
             break
           else
             @log << "[DEF] ⚠ Morale is wavering!"
           end
        end
      end

      winner ||= :defender # Defender wins purely by surviving (Time Limit)
      reason ||= "Time Limit Reached."

      @log << "\n=== BATTLE END ==="
      @log << "Winner: #{winner.to_s.upcase} (#{reason})"
      
      OpenStruct.new(
        winner: winner,
        log: @log,
        attacker_army: @attacker_army,
        defender_army: @defender_army,
        attacker_remaining: @attacker_army.total_quantity,
        defender_remaining: @defender_army.total_quantity
      )
    end

    private

    def select_target(source, enemy_army)
      # Priority 0: Taunt
      taunters = enemy_army.active_stacks.select { |s| s.ability?('taunt') }
      return taunters.sample if taunters.any? && !source.ability?('ignore_taunt')

      # Priority 1: Type Advantage
      preferred_types = Array(TYPE_ADVANTAGE[source.unit_type])
      if preferred_types.any?
        targets = enemy_army.active_stacks.select { |s| preferred_types.include?(s.unit_type) }
        return targets.min_by(&:defense) if targets.any?
      end

      # Priority 2: Weakest Defense (Glass Cannons)
      enemy_army.active_stacks.min_by(&:defense)
    end

    def execute_attack(source, target)
      # 1. Initiative / Speed Bonus Check
      # If attacker is faster, they get a bonus to damage/hit chance
      speed_diff = [source.speed - target.speed, 0].max
      speed_bonus = 1.0 + (speed_diff * 0.05) # 5% per point of speed advantage

      # --- ATTACK PHASE ---
      side_tag = source.side == :attacker ? "[ATK]" : "[DEF]"
      enemy_tag = source.side == :attacker ? "[DEF]" : "[ATK]"
      @log << "#{side_tag} #{source.name} (×#{source.quantity}) engages #{enemy_tag} #{target.name} (×#{target.quantity})"
      
      damage_dealt = calculate_and_apply_damage(source, target, speed_bonus, false)
      
      # --- RETALIATION PHASE ---
      # If target survived, and isn't stunned/etc (future proofing), they fight back.
      # Generally retaliation is weaker or equal? Let's say equal but with remaining numbers.
      if (target.quantity > 0) || (target.hero && target.hero_hp > 0)
         # Check for Ranged Advantage: 
         # If Attacker is Ranged/Magic/Flying and Defender is Infantry/Cavalry, 
         # maybe retaliation is impossible or reduced?
         # For now, let's just reduce retaliation damage slightly to represent "Startled" or "Defensive" state.
         retaliation_mod = 0.75 
         
         # Speed penalty for retaliation? Slower units struggle to hit back fast ones?
         # If source is much faster, retaliation is harder.
         if source.speed > target.speed
            evasion_chance = (source.speed - target.speed) * 0.02 # 2% dodge per speed point
            if rand < evasion_chance
               @log << "  -> #{side_tag} #{source.name} creates distance, avoiding retaliation!"
               return
            end
         end

         calculate_and_apply_damage(target, source, retaliation_mod, true) 
      end
    end

    def calculate_and_apply_damage(attacker, defender, multiplier_bonus, is_retaliation)
      # Base Damage Calculation
      # DMG = (Quantity * Attack) or (Hero Attack if Qty=0)
      raw_damage = 0
      kills = 0 # Initialize return value
      
      if attacker.quantity > 0
        raw_damage = (attacker.quantity * attacker.attack).to_f
      elsif attacker.hero && attacker.hero_hp > 0
        raw_damage = attacker.hero_attack.to_f * 2.5 # Hero deals 250% base dmg when solo
        hero_tag = attacker.side == :attacker ? "[ATK]" : "[DEF]"
        @log << "  -> #{hero_tag} HERO STRIKE! #{attacker.hero[:name]} attacks alone!"
      else
        return # Attacker is truly dead
      end

      raw_damage *= rand(0.9..1.1)

      # Multipliers
      multiplier = multiplier_bonus
      bonuses = []
      
      if is_retaliation
         bonuses << "RETALIATION"
      elsif multiplier > 1.0
         bonuses << "SPEED(+#{((multiplier-1.0)*100).to_i}%)"
      end

      # Type Advantage
      # If hero solo, use hero unit type?
      u_type = attacker.quantity > 0 ? attacker.unit_type : (attacker.hero_unit&.unit_type || 'hero')
      elem = attacker.quantity > 0 ? attacker.element : (attacker.hero_unit&.element || 'physical')
      
      strong_against = Array(TYPE_ADVANTAGE[u_type])
      if strong_against.include?(defender.unit_type)
        multiplier += 0.5
        bonuses << "TYPE"
      end
      
      # Element Advantage
      att_elem = elem.to_s
      def_elem = defender.element.to_s
      
      if ELEMENT_ADVANTAGE[att_elem] == def_elem
        multiplier += 0.5
        bonuses << "ELEM"
      elsif ELEMENT_ADVANTAGE[def_elem] == att_elem
        multiplier -= 0.5 # Resist
        bonuses << "RESIST"
      end
      
      # Ability: Bonus Vs Flying (Archer)
      if attacker.ability?('bonus_vs_flying') && defender.unit_type == 'flying'
         multiplier += attacker.ability_val('bonus_vs_flying')
         bonuses << "AA"
      end

      final_damage = (raw_damage * multiplier).to_i
      final_damage = [final_damage, 1].max # Min 1 damage
      
      # --- APPLY DAMAGE TO DEFENDER ---
      
      att_tag = attacker.side == :attacker ? "[ATK]" : "[DEF]"
      def_tag = defender.side == :attacker ? "[ATK]" : "[DEF]"
      action_verb = is_retaliation ? "counter-attacks" : "hits"
      bonus_str = bonuses.any? ? "[#{bonuses.join('+')}]" : ""
      math_str = "#{attacker.quantity}×#{attacker.attack} ATK × #{('%.2f' % multiplier)} = #{final_damage} dmg"
      log_entry = "  -> #{att_tag} #{attacker.name} #{action_verb} #{def_tag} #{defender.name} #{bonus_str} (#{math_str})"
      
      if defender.quantity > 0
          # Standard Unit Damage
          # Effective HP = (Defense * 2) + 10
          unit_ehp = (defender.defense * 2) + 10
          
          kills = (final_damage / unit_ehp).floor
          # Can't kill more than exist
          kills = [kills, defender.quantity].min
          
          defender.quantity -= kills
          log_entry += " -> #{final_damage}/#{unit_ehp} EHP = #{kills} kills (#{defender.quantity} left)"
          
          if defender.quantity <= 0 && defender.hero && defender.hero_hp > 0
             log_entry += " (UNIT WIPED OUT! HERO EXPOSED!)"
          end
          
          @log << log_entry
      elsif defender.hero && defender.hero_hp > 0
          # Hero Damage Phase
          # Hero Effective HP = Hero HP + (Defense * 5?)
          # Let's say Defense reduces incoming damage percent?
          # Mitigation = Defense / (Defense + 200). 
          # Or simple subtraction for Hero?
          
          armor = defender.defense.to_f
          # Diminishing returns armor formula: Reduction = Armor / (Armor + 400)
          reduction = armor / (armor + 400.0) 
          actual_damage = (final_damage * (1.0 - reduction)).to_i
          
          defender.hero_hp -= actual_damage
          
          status = defender.hero_hp > 0 ? "HP: #{defender.hero_hp}/#{defender.hero_max_hp}" : "FALLEN"
          log_entry = "  -> #{att_tag} #{attacker.name} strikes HERO #{defender.hero[:name]} directly! #{actual_damage} dmg (#{('%.0f' % (reduction * 100))}% armor) → #{status}"
          @log << log_entry
      end

      # Abilities (Splash, Leech, etc.)
      # Simplified: Only allow splash if hitting units
      if defender.quantity > 0 && kills.to_i > 0
         # Splash Damage
         if attacker.ability?('splash_damage')
            splash_pct = attacker.ability_val('splash_damage')
            secondary_kills = (kills * splash_pct).to_i
            
            if secondary_kills > 0
               # Hit random neighbor
               neighbor = defender.army_ref.active_stacks.reject { |s| s == defender }.sample
               if neighbor
                  actual_splash = [secondary_kills, neighbor.quantity].min
                  neighbor.quantity -= actual_splash
                  @log << "    -> SPLASH! #{actual_splash} #{neighbor.name} hit by blast."
               end
            end
         end
         
         # Life Leech
         if attacker.ability?('life_leech')
             leech_pct = attacker.ability_val('life_leech')
             healed = (kills * leech_pct).to_i
             if healed > 0
                attacker.quantity += healed
                @log << "    -> LEECH! #{attacker.name} drains life, recovering #{healed}."
             end
         end
      end

      # Hero Reaction (Vengeance Mechanics)
      if defender.hero && !defender.dead?
         hero_name = defender.hero[:name].to_s.downcase
         power = defender.hero[:power].to_i
         power = 500 if power == 0
         
         threshold = defender.initial_quantity * 0.5
         
         # 1. General Kael: "Vengeance" (Single Target Nuke)
         # Triggers when unit drops below 50% strength
         if hero_name.include?('kael')
            already_triggered = defender.instance_variable_get(:@kael_vengeance_triggered)
            
            if defender.quantity < threshold && !already_triggered
               defender.instance_variable_set(:@kael_vengeance_triggered, true)
               
               damage = (power * 1.5).to_i
               
               # Apply damage to attacker
               target_ehp = (attacker.defense * 2) + 10
               hero_kills = (damage / target_ehp).floor
               hero_kills = [hero_kills, attacker.quantity].min
               
               if hero_kills > 0
                  attacker.quantity -= hero_kills
                  @log << "    -> #{defender.hero[:name]} leads a VENGEANCE CHARGE!"
                  @log << "       -> Critical Hit! Dealt #{damage} damage, slaying #{hero_kills} #{attacker.name}!"
               end
            end
         end
         
         # 2. Archmage Valerius: "Arcane Nova" (AoE Damage)
         if hero_name.include?('valerius')
            already_triggered = defender.instance_variable_get(:@valerius_nova_triggered)
            
            if defender.quantity < threshold && !already_triggered
               defender.instance_variable_set(:@valerius_nova_triggered, true)
               @log << "    -> #{defender.hero[:name]} unleashes ARCANE NOVA!"
               
               # Hit attacker + up to 2 random others
               targets = [attacker]
               attacker.army_ref.active_stacks.reject { |s| s == attacker }.sample(2).each do |s|
                   targets << s
               end
               
               base_damage = (power * 1.0).to_i
               
               targets.each do |t|
                  t_ehp = (t.defense * 2) + 10
                  kills = (base_damage / t_ehp).floor
                  kills = [kills, t.quantity].min
                  
                  if kills > 0
                     t.quantity -= kills
                     @log << "       -> The nova blasts #{t.name} for #{kills} casualties!"
                  end
               end
            end
         end
         
         # 3. Ranger Sylas: "Parting Shot" (Retreat Penalty)
         # Triggers on EVERY hit if Sylas' units are still alive? No, let's do the Panic threshold too.
         # "Desperate Volley": When < 50%, free attack on attacker regardless of type.
         if hero_name.include?('sylas')
            already_triggered = defender.instance_variable_get(:@sylas_volley_triggered)
            
            if defender.quantity < threshold && !already_triggered
               defender.instance_variable_set(:@sylas_volley_triggered, true)
               
               # High damage, ignores defense partly?
               damage = (power * 1.2).to_i
               target_ehp = (attacker.defense * 1.5) + 10 # Armor Piercing calculation
               
               kills = (damage / target_ehp).floor
               kills = [kills, attacker.quantity].min
               
               if kills > 0
                  attacker.quantity -= kills
                  @log << "    -> #{defender.hero[:name]} signals a DESPERATE VOLLEY!"
                  @log << "       -> Arrows darken the sky! #{kills} #{attacker.name} fall before they can close in."
               end
            end
         end
      end
      
      return kills
    end

    # --- Nested Classes ---

    class Army
      attr_reader :name, :side, :stacks, :initial_power, :max_power

      def initialize(data, side)
        @name = data[:name] || "Unknown Army"
        @side = side
        # Data[:stacks] expects array of hashes
        @stacks = (data[:stacks] || []).map { |h| Stack.new(h, self) }
        @initial_power = current_power
        @max_power = current_power
      end

      def active_stacks
        @stacks.select { |s| !s.dead? }
      end

      def wiped_out?
        active_stacks.empty?
      end
      
      def total_quantity
         active_stacks.sum(&:quantity)
      end

      def current_power
        active_stacks.sum(&:power_rating)
      end

      def morale_broken?
         # If current power < 50% of max
         current_power < (@max_power * 0.5)
      end
    end

    class Stack
      attr_accessor :name, :unit_id, :quantity, :initial_quantity, :defense, :unit_type, :element, :speed, :abilities, :army_ref, :hero
      attr_accessor :hero_hp, :hero_max_hp, :hero_attack, :hero_unit # New attrs
      attr_reader :attack # Made reader to allow override if needed

      def side
        @army_ref.side
      end

      def initialize(hash, army)
        @name = hash[:unit_name] || "Units"
        @unit_id = hash[:unit_id]
        @quantity = hash[:quantity].to_i
        @initial_quantity = @quantity
        @attack = hash[:attack].to_i
        @defense = hash[:defense].to_i
        
        # Normalize Type/Element
        @unit_type = (hash[:type] || 'infantry').to_s.downcase
        @element = (hash[:element] || 'physical').to_s.downcase
        
        @speed = hash[:speed] || 5
        @abilities = hash[:abilities] || {}
        @hero = hash[:hero]
        
        # Symbolize keys in abilities just in case
        if @abilities.is_a?(Hash)
            @abilities = @abilities.transform_keys(&:to_s) 
        end
        
        @army_ref = army

        # Setup Hero Combat Stats if present
        if @hero
           u = Unit.find_by(id: @hero[:id])
           if u
              @hero_unit = u
              @hero_hp = u.power # Use Power as HP
              @hero_max_hp = u.power
              @hero_attack = u.attack
           else
              @hero_hp = 1000
              @hero_max_hp = 1000
              @hero_attack = 100
           end
        end
        
        # Apply Hero Passives (Bonus to Unit Stack)
        apply_hero_bonuses if @hero
      end

      def apply_hero_bonuses
        return unless @hero
        hero_name = @hero[:name].to_s.downcase
        
        # 1. General Kael: "Physical Command"
        if hero_name.include?('kael') && @element == 'physical'
           @attack = (@attack * 1.15).ceil # 15% Boost
           @hero[:active_buff] = "Physical Command (+15% ATK)"
        end
        
        # 2. Archmage Valerius: "Arcane Resonance"
        # Boosts Magic units ATK by 20%
        if hero_name.include?('valerius') && (@unit_type == 'magic' || @element == 'magic')
           @attack = (@attack * 1.20).ceil
           @hero[:active_buff] = "Arcane Resonance (+20% ATK)"
        end
        
        # 3. Ranger Sylas: "Swift Strike"
        # Boosts Ranged units ATK by 10% and Speed by +5
        if hero_name.include?('sylas') && @unit_type == 'ranged'
           @attack = (@attack * 1.10).ceil
           @speed += 5
           @hero[:active_buff] = "Swift Strike (+10% ATK, +5 SPD)"
        end
      end

      def dead?
        if @hero
           # Hero is alive if quantity > 0 OR Hero HP > 0
           @quantity <= 0 && @hero_hp <= 0
        else
           @quantity <= 0
        end
      end

      def power_rating
         # Rough estimation of strength
         if @quantity > 0
            (@attack + @defense) * @quantity
         else
            # Hero Phase Power
            @hero ? (@hero_attack + @hero_hp) : 0
         end
      end
      
      def ability?(name)
        return false unless @abilities.is_a?(Hash)
        @abilities.key?(name.to_s)
      end

      def ability_val(name)
        return 0.0 unless ability?(name)
        val = @abilities[name.to_s]
        val.to_f
      end
    end
  end
end
