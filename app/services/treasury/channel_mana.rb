require 'ostruct'

module Treasury
  class ChannelMana
    BREACH_THRESHOLD_YIELD = 0.5 # If channeling < 50% charged
    BASE_RISK_FACTOR = 0.5       # Max 50% base chance at 0% yield
    
    attr_reader :result

    def initialize(user)
      @user = user
      @result = {}
    end

    def call
      # Capacitor charges 0% → 100% over 4 hours
      # At 100% the capacitor overloads — release to collect mana
      
      # Step 1: Calculate Net Mana Change
      # Instead of "efficiency", we simply calculate income vs expenses over time
      
      elapsed_seconds = Time.current - (@user.last_mana_recharge_at || Time.current)
      cycle_duration = @user.mana_drain_duration.to_f # 4 hours in seconds
      
      # Fraction of cycle elapsed (0.0 = just released, 1.0 = fully charged)
      # Cap at 1.0 (100% charged / overload)
      time_factor = [elapsed_seconds / cycle_duration, 1.0].min
      
      # Calculate Net Income per Cycle
      # Example: 
      # Generation: 500
      # Upkeep: 600
      # Net: -100 per 4 hours
      net_potential = @user.net_mana_potential
      
      # Actual Mana Change
      # Yield uses base (60% linear) + bonus (40% quadratic) to reward waiting.
      # Early release gets mostly base; full charge gets full bonus.
      yield_factor = @user.mana_total_yield(time_factor)
      mana_change = (net_potential * yield_factor).to_i
      
      # Calculate New Mana Total
      projected_mana = @user.mana + mana_change
      
      # Breach Logic
      # Breach occurs if projected_mana < 0
      if projected_mana < 0
        breach_occurred = true
        breach_result = handle_breach(projected_mana)
        breach_message = breach_result[:message]
        penalty_details = breach_result[:penalty]
        
        # Reset Mana to 0 (or keep negative? usually 0 after breach)
        final_mana = 0
      else
        breach_occurred = false
        final_mana = [projected_mana, @user.max_mana].min
      end

      # Execute Transaction
      ActiveRecord::Base.transaction do
        @user.update!(
          mana: final_mana, 
          last_mana_recharge_at: Time.current
        )
        
        if breach_occurred && penalty_details
           apply_penalties(penalty_details)
        end
      end

      message = "Channeled #{mana_change} Mana!"
      type = :notice
      
      notification = nil
      if breach_occurred
        if penalty_details
            message = "⚠️ VOID BREACH! #{breach_message} (Check Notifications)"
            type = :alert
             notification = @user.notifications.create!(
              title: "DEFEAT: Void Breach",
              content: "The Void overwhelmed your garrison. #{breach_message}",
              category: 'battle',
              data: { log: breach_result[:log], penalty: penalty_details, result: 'defeat' }
            )
        else
            message = "⚔️ VOID BREACH REPELLED! (Check Notifications)"
            type = :warning
            notification = @user.notifications.create!(
              title: "VICTORY: Void Breach Repelled",
              content: "Your garrison successfully defended the Mana Core.",
              category: 'battle',
              data: { log: breach_result[:log], result: 'victory' }
            )
        end
      elsif mana_change < 0
        message = "Channeled... but the upkeep drained #{mana_change.abs} Mana!"
        type = :warning
      end

      OpenStruct.new(success?: true, message: message, type: type, notification: notification)
    end

    private

    def handle_breach(projected_negative_mana)
      severity = [projected_negative_mana.abs / 500.0, 1.0].min
      void_power = (@user.current_power * (0.2 + (0.8 * severity))).to_i
      void_power = [void_power, 50].max

      defender = build_defender_army
      # Make sure defender has a name
      defender[:name] = "Garrison" if defender[:name].to_s.strip.empty?
      
      attacker = build_void_army(void_power)

      battle = Battle::CalculatorService.new(
        attacker: attacker,
        defender: defender
      ).call

      if battle.winner == :defender
        {
          message: "VICTORY! Garrison repelled the Breach (Void Power: #{void_power}).",
          penalty: nil,
          log: battle.log
        }
      else
        loss_gold = (@user.gold * 0.1).to_i
        loss_morale = 15
        {
          message: "DEFEAT! The Void Overwhelmed you (Void Power: #{void_power}).",
          penalty: { gold: loss_gold, morale: loss_morale },
          log: battle.log
        }
      end
    end

    def build_defender_army
      stacks = @user.user_units.where('garrison > 0').includes(:unit, :assigned_hero).map do |uu|
        {
          unit_name: uu.unit.name,
          quantity: uu.garrison,
          attack: uu.unit.attack,
          defense: uu.unit.defense,
          type: uu.unit.unit_type || 'infantry',
          element: uu.unit.element || 'physical',
          speed: uu.unit.speed || 5,
          abilities: uu.unit.abilities || {},
          hero: uu.assigned_hero ? { name: uu.assigned_hero.name, power: uu.assigned_hero.power } : nil
        }
      end

      {
        name: "Garrison",
        power: @user.current_power,
        stacks: stacks
      }
    end

    def build_void_army(target_power)
      stacks = []
      remaining = target_power

      # 1. Elite (30%) if power > 2000
      if target_power > 2000
        qty = ((remaining * 0.3) / 35).to_i
        if qty > 0
          stacks << { 
            unit_name: "Abyssal Horror", 
            quantity: qty, 
            attack: 15, defense: 20, 
            type: "magic", element: "void", speed: 7,
            abilities: { "splash_damage": 0.2 }
          }
          remaining -= (qty * 35)
        end
      end

      # 2. Soldiers (50%)
      qty = ((remaining * 0.5) / 8).to_i
      if qty > 0
        stacks << { 
            unit_name: "Shadow Walker", 
            quantity: qty, 
            attack: 4, defense: 4, 
            type: "infantry", element: "void", speed: 9, 
            abilities: {} 
        }
        remaining -= (qty * 8)
      end

      # 3. Fodder (Rest)
      qty = (remaining / 2).to_i
      qty = [qty, 5].max
      stacks << { 
        unit_name: "Void Mite", 
        quantity: qty, 
        attack: 1, defense: 1, 
        type: "infantry", element: "void", speed: 5,
        abilities: {}
      }

      {
        name: "Void Swarm",
        power: target_power,
        stacks: stacks
      }
    end

    def apply_penalties(penalty)
      @user.decrement!(:gold, penalty[:gold]) if penalty[:gold] > 0
      
      if penalty[:morale] > 0
        current = @user.current_base_morale
        new_val = [current - penalty[:morale], 0].max
        @user.update_morale!(new_val)
      end
    end
  end
end
