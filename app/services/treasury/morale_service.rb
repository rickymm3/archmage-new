module Treasury
  class MoraleService
    attr_reader :errors

    MAX_MORALE = 100
    
    def initialize(user)
      @user = user
      @errors = []
    end

    def daily_upkeep
      # Sum of all unit upkeep costs
      @user.user_units.includes(:unit).sum { |uu| uu.quantity * uu.unit.upkeep_cost }
    end

    def pay_upkeep(gold_amount)
      if gold_amount <= 0
        @errors << "Amount must be positive."
        return false
      end

      if @user.gold < gold_amount
        @errors << "Not enough gold."
        return false
      end

      current_upkeep = daily_upkeep
      if current_upkeep.zero?
        @errors << "You have no upkeep to pay."
        return false
      end

      # Formula: Paying Full Daily Upkeep restores ~20 Morale?
      # Or: Paying X gold restores (X / Daily Upkeep) * 20 Morale
      # Let's say restoring 100% morale costs 5x Daily Upkeep (so 20% cost for 20% gain)
      
      # Simplified: 1 Day of Upkeep buys 100 Morale points
      morale_gain = (gold_amount.to_f / current_upkeep) * 100.0
      
      # Cap the gain so you don't overpay for >100
      effective_morale = @user.current_base_morale # Use base to avoid unintended spell bonus persistence
      max_possible_gain = MAX_MORALE - effective_morale
      
      if max_possible_gain <= 0
        @errors << "Morale is already at maximum."
        return false
      end

      # Clamp morale gain and only deduct the gold actually needed
      if morale_gain > max_possible_gain
        morale_gain = max_possible_gain
        # Only charge for the morale we actually restore
        gold_amount = (morale_gain / 100.0 * current_upkeep).ceil
      end

      new_morale = [effective_morale + morale_gain, MAX_MORALE.to_f].min

      ActiveRecord::Base.transaction do
        @user.decrement!(:gold, gold_amount)
        @user.update_morale!(new_morale)
      end

      true
    end
  end
end
