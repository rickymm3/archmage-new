module Explorations
  class ClaimService
    def initialize(exploration)
      @exploration = exploration
    end

    def call
      return false unless @exploration.completed? && !@exploration.claimed?

      Exploration.transaction do
        user = @exploration.user
        unit = @exploration.unit
        resources = @exploration.resources_found || {}
        
        # Determine casualties
        survivors = (resources['survivors'] || @exploration.quantity).to_i
        initial_qty = @exploration.quantity
        casualties = initial_qty - survivors
        
        # 1. Update Units
        # Remove ALL from 'exploring' as the mission is over
        user_unit = user.user_units.find_by(unit: unit)
        if user_unit
          # Decrement exploring count (unlocks them)
          # Use update_counters to avoid race conditions if possible, but simple decrement! is fine here
          user_unit.decrement(:exploring, initial_qty)
          
          # Remove casualties permanently from total quantity
          if casualties > 0
            user_unit.decrement(:quantity, casualties)
          end
          
          user_unit.save!
        end

        # 2. Add Rewards
        land_gain = (resources['land'] || 0).to_i
        gold_gain = (resources['gold'] || 0).to_i
        mana_gain = (resources['mana'] || 0).to_i
        
        user.increment(:land, land_gain)
        user.increment(:gold, gold_gain)
        user.increment(:mana, mana_gain)
        
        # Handle unit rewards (finding survivors/mercenaries)
        if resources['units_found'].present?
          resources['units_found'].each do |found|
            unit_type = Unit.find_by(slug: found['slug'])
            next unless unit_type
            
            uu = user.user_units.find_or_initialize_by(unit: unit_type)
            uu.quantity = (uu.quantity || 0) + found['amount'].to_i
            uu.save!
          end
        end
        
        user.save!
        
        # 3. Mark Claimed
        @exploration.claimed!
      end
      
      true
    rescue StandardError => e
      Rails.logger.error("ClaimService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      false
    end
  end
end
