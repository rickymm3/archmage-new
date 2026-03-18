module Battle
  class ResolutionService
    def initialize(attacker_id:, defender_id:, unit_allocations:, hero_allocations: {})
      @attacker = User.find(attacker_id)
      @defender = User.find(defender_id)
      
      # Determine allocations safely, handling ActionController::Parameters
      raw_units = unit_allocations.respond_to?(:to_unsafe_h) ? unit_allocations.to_unsafe_h : unit_allocations
      @unit_allocations = raw_units.to_h.transform_keys(&:to_i).transform_values(&:to_i)

      raw_heroes = hero_allocations.respond_to?(:to_unsafe_h) ? hero_allocations.to_unsafe_h : hero_allocations
      @hero_allocations = raw_heroes.to_h.transform_keys(&:to_i).transform_values(&:to_i)
    end

    def call
      return failed_attack("Target is under magical protection.") if @defender.under_protection?
      return failed_attack("No units selected.") if @unit_allocations.empty? || @unit_allocations.values.sum <= 0

      # 1. Prepare Attacker Stacks
      attacker_stacks = prepare_attacker_stacks
      return failed_attack("Insufficient units or invalid selection.") if attacker_stacks.nil?

      # Morale desertion check for attacker
      attacker_stacks, attacker_deserted = apply_morale_desertion(@attacker, attacker_stacks)
      return failed_attack("Your army's morale is too low — all units deserted!") if attacker_stacks.empty?

      # Apply active attack spell bonuses to attacker
      attacker_stacks = apply_active_spell_bonuses(@attacker, attacker_stacks, 'attack')

      ActiveRecord::Base.transaction do
        # 2. Prepare Defender Stacks
        # Auto-recharge defender's mana battery so magic_power is current for defense
        @defender.update!(last_mana_recharge_at: Time.current)

        defender_stacks = prepare_defender_stacks
        # Defenders do NOT suffer morale desertion — it's the attacker's choice to attack
        defender_deserted = []

        # Apply active defense spell bonuses to defender
        defender_stacks = apply_active_spell_bonuses(@defender, defender_stacks, 'defense')
        
        # 3. Calculate Battle
        calculator = Battle::CalculatorService.new(
          attacker: { name: @attacker.username, stacks: attacker_stacks },
          defender: { name: @defender.username, stacks: defender_stacks }
        )
        
        result = calculator.call

        # Prepend desertion info to battle log
        desertion_log = []
        attacker_deserted.each do |d|
          desertion_log << "#{d[:lost]} #{d[:unit_name]} deserted #{@attacker.username}'s army (low morale)!"
        end
        defender_deserted.each do |d|
          desertion_log << "#{d[:lost]} #{d[:unit_name]} deserted #{@defender.username}'s army (low morale)!"
        end
        result.log.insert(1, *desertion_log) if desertion_log.any?
        
        # 4. Apply Casualties
        process_loss(result) unless result.winner.nil?
        
        # 5. Apply Land & Notifications
        process_outcome(result)
      end
    rescue ActiveRecord::RecordNotFound
      failed_attack("Target not found.")
    end

    private

    def failed_attack(reason)
      OpenStruct.new(success?: false, error: reason)
    end

    def prepare_attacker_stacks
      stacks = []
      used_heroes = Set.new
      
      @unit_allocations.each do |unit_id, quantity|
        qty = quantity.to_i
        next if qty <= 0
        uu = @attacker.user_units.find_by(unit_id: unit_id)
        # Verify ownership and availability
        return nil if uu.nil? || uu.available_quantity < qty
        
        # Check for Hero Assignment
        hero_data = nil
        if @hero_allocations[unit_id].present?
           hero_id = @hero_allocations[unit_id]
           
           # Verify hero ownership
           hero_uu = @attacker.user_units.find_by(unit_id: hero_id)
           if hero_uu && hero_uu.quantity > 0 && !used_heroes.include?(hero_id)
              # Also ensure hero isn't exploring or garrisoned elsewhere? 
              # For now, simplistic check: user owns hero unit.
              
              hero_data = {
                 id: hero_uu.unit.id,
                 name: hero_uu.unit.name
              }
              used_heroes.add(hero_id)
           end
        end

        stacks << format_stack(uu.unit, qty, hero_data)
      end
      return nil if stacks.empty?
      stacks
    end

    def prepare_defender_stacks
      stacks = []
      @defender.user_units.includes(:unit).each do |uu|
        # Defender uses all troops present at home (Quantity - Exploring)
        current_defending = uu.quantity - (uu.exploring || 0)
        next if current_defending <= 0
        
        # Check assigned hero via DB column
        hero_data = nil
        if uu.assigned_hero
           hero_data = {
             id: uu.assigned_hero.id,
             name: uu.assigned_hero.name
           }
        end

        stacks << format_stack(uu.unit, current_defending, hero_data)
      end
      stacks
    end

    def format_stack(unit, quantity, hero_data = nil)
      {
        unit_id: unit.id,
        unit_name: unit.name,
        quantity: quantity,
        attack: unit.attack,
        defense: unit.defense,
        speed: unit.speed,
        type: unit.unit_type,
        element: unit.element,
        hero: hero_data
        # abilities: unit.respond_to?(:abilities) ? unit.abilities : {} 
      }
    end
    
    def process_loss(result)
       apply_casualties(@attacker, result.attacker_army)
       apply_casualties(@defender, result.defender_army)
    end

    def serialize_army(army)
      {
        name: army.name,
        stacks: army.stacks.map do |s|
          {
            name: s.name,
            initial_quantity: s.initial_quantity,
            remaining_quantity: s.quantity,
            lost: s.initial_quantity - s.quantity,
            hero: s.hero,
            hero_alive: (s.hero_hp || 0) > 0
          }
        end
      }
    end

    def process_outcome(result)
        land_seized = 0
        
        # Serialize Data for Notification
        battle_data = {
          winner: result.winner,
          log: result.log,
          attacker: { username: @attacker.username },
          defender: { username: @defender.username },
          attacker_army: serialize_army(result.attacker_army),
          defender_army: serialize_army(result.defender_army)
        }
        
        if result.winner == :attacker
          # Winner takes 5-10% of loser's land
          percentage = 0.05 + (rand * 0.05)
          raw_land_seized = (@defender.land * percentage).floor
          # Minimum 5 acres if they have it, else all
          land_seized = [raw_land_seized, [5, @defender.land].min].max 
          
          # Cap at defenders current land
          current_land = @defender.land
          land_seized = current_land if land_seized > current_land 
          
          if land_seized > 0
            @attacker.increment!(:land, land_seized)
            @defender.decrement!(:land, land_seized)
          end
          
          battle_data[:land_seized] = land_seized
          
          # Apply Protection to Defender (8 hours)
          @defender.update!(protection_expires_at: 8.hours.from_now)
          
          # Notify Defender (Defeat)
          Notification.create!(
            user: @defender,
            title: "Defeat: Land Lost!",
            content: "You were attacked by #{@attacker.username}. You lost #{land_seized} acres of land and your forces suffered casualties. You are now under protection for 8 hours.",
            category: "battle",
            data: battle_data
          )
          
          # Notify Attacker (Victory)
          Notification.create!(
            user: @attacker,
            title: "Victory: Land Seized!",
            content: "You successfully attacked #{@defender.username} and seized #{land_seized} acres. Your forces suffered casualties.",
            category: "battle",
            data: battle_data
          )
        else
           battle_data[:land_seized] = 0
           
           # Notify Defender (Victory)
           Notification.create!(
            user: @defender,
            title: "Victory: Attack Repelled!",
            content: "You successfully defended your land against an attack from #{@attacker.username}. However, your forces suffered casualties.",
            category: "battle",
            data: battle_data
          )
          
          # Notify Attacker (Defeat)
          Notification.create!(
            user: @attacker,
            title: "Defeat: Attack Failed!",
            content: "Your forces were repelled by #{@defender.username} and suffered casualties.",
            category: "battle",
            data: battle_data
          )
        end
        
        OpenStruct.new(
           success?: true,
           winner: result.winner,
           land_seized: land_seized,
           log: result.log,
           attacker: @attacker,
           defender: @defender,
           attacker_army: result.attacker_army,
           defender_army: result.defender_army
        )
    end

    def apply_morale_desertion(user, stacks)
      morale = user.current_morale
      deserted = []

      # High morale: no desertion
      return [stacks, deserted] if morale >= 75

      # Determine desertion chance per unit based on morale tier
      if morale <= 0
        desert_pct = 0.5  # 50% of each stack deserts
      elsif morale < 20
        desert_pct = 0.25 # 25% desert
      else
        desert_pct = 0.10 # 10% desert (morale 20-74)
      end

      stacks.each do |stack|
        next if stack[:type] == 'hero'
        qty = stack[:quantity]
        lost = (qty * desert_pct * rand(0.5..1.0)).floor
        next if lost <= 0

        stack[:quantity] -= lost
        deserted << { unit_name: stack[:unit_name], lost: lost }

        # Actually remove the deserted units from the user's army
        uu = user.user_units.find_by(unit_id: stack[:unit_id])
        if uu
          new_qty = [uu.quantity - lost, 0].max
          new_garrison = [uu.garrison, new_qty].min
          uu.update!(quantity: new_qty, garrison: new_garrison)
        end
      end

      stacks.reject! { |s| s[:quantity] <= 0 }
      [stacks, deserted]
    end

    def apply_casualties(user, army)
       army.stacks.each do |stack|
          # Calculate loss: Initial - Current (surviving)
          loss = stack.initial_quantity - stack.quantity
          next if loss <= 0
          
          uu = user.user_units.find_by(unit_id: stack.unit_id)
          next unless uu
          
          current_quantity = uu.quantity
          new_quantity = current_quantity - loss
          new_quantity = 0 if new_quantity < 0
          
          # Reduce garrison count if total quantity drops below it
          new_garrison = [uu.garrison, new_quantity].min
          
          uu.update!(quantity: new_quantity, garrison: new_garrison)
       end
    end

    def apply_active_spell_bonuses(user, stacks, spell_type)
      total_bonus = 0

      user.active_spells.active.includes(:spell).each do |active|
        meta = active.metadata || {}
        next unless meta['spell_type'] == spell_type

        magnitude = meta['magnitude'].to_f
        total_bonus += magnitude if magnitude > 0
      end

      return stacks if total_bonus <= 0

      stat_key = spell_type == 'attack' ? :attack : :defense
      stacks.each do |stack|
        stack[stat_key] = (stack[stat_key] + total_bonus).to_i
      end

      stacks
    end
  end
end
