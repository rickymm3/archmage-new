module Town
  class CreateRecruitmentOrderService
    RECRUIT_TIERS = {
      "cautious" => { label: "Cautious", multiplier: 0.5 },
      "standard" => { label: "Standard", multiplier: 1.0 },
      "aggressive" => { label: "Aggressive", multiplier: 2.0 },
      "conscription" => { label: "Conscription", multiplier: 4.0 }
    }.freeze

    attr_reader :user, :errors, :result

    def initialize(user, unit_id, tier)
      @user = user
      @unit = Unit.find(unit_id)
      @tier = tier.to_s
      @errors = []
      @result = {}
    end

    def call
      unless RECRUIT_TIERS.key?(@tier)
        @errors << "Invalid recruitment tier."
        return false
      end

      unless @unit.recruitable?
        @errors << "#{@unit.name} cannot be recruited."
        return false
      end

      required_level = @unit.requirements["barracks_level"].to_i
      if barracks_level < required_level
        @errors << "Barracks level too low. Need level #{required_level}."
        return false
      end

      if @user.active_recruitment_orders.count >= @user.recruitment_slots
        @errors << "All recruitment slots are in use. Cancel an order or wait for one to finish."
        return false
      end

      unit_cost = @unit.requirements["gold"].to_i
      if unit_cost <= 0
        @errors << "This unit cannot be recruited with gold."
        return false
      end

      tier_config = RECRUIT_TIERS[@tier]
      gold_amount = (unit_cost * tier_config[:multiplier] * 10).to_i

      if @user.gold < gold_amount
        @errors << "Not enough gold. Need #{gold_amount}."
        return false
      end

      expected_count = (gold_amount.to_f / unit_cost).floor
      if expected_count <= 0
        @errors << "Not enough gold to recruit even a single #{@unit.name}."
        return false
      end

      # Luck roll (20/60/20)
      luck_roll = rand(1..100)
      luck_modifier = if luck_roll <= 20
                        0.8
                      elsif luck_roll > 80
                        1.2
                      else
                        1.0
                      end

      luck_label = case luck_modifier
                   when 0.8 then "Poor"
                   when 1.2 then "Good"
                   else "Average"
                   end

      # Barracks bonus: +3% per level
      b_bonus = barracks_level * 0.03

      # Active spell bonus
      spell_bonus = active_recruit_bonus

      total_bonus = 1.0 + b_bonus + spell_bonus
      adjusted = expected_count * luck_modifier * total_bonus

      # Variance ±10%
      variance = rand(0.9..1.1)
      final_count = (adjusted * variance).round
      final_count = [final_count, 1].max if expected_count >= 1

      # Duration: base_minutes = gold_cost / 5, scaled by barracks speed
      base_minutes = unit_cost.to_f / 5
      duration = (base_minutes * 60) / (1 + barracks_level * 0.1)
      duration_seconds = duration.round.clamp(60, 4 * 3600)

      ActiveRecord::Base.transaction do
        @user.decrement!(:gold, gold_amount)

        order = @user.recruitment_orders.create!(
          unit: @unit,
          tier: @tier,
          gold_invested: gold_amount,
          total_quantity: final_count,
          duration_seconds: duration_seconds,
          started_at: Time.current,
          luck: luck_label
        )

        @result = {
          order: order,
          message: "#{tier_config[:label]} recruitment started: #{final_count} #{@unit.name.pluralize(final_count)} arriving over #{format_duration(duration_seconds)}.",
          gold: @user.gold
        }
      end

      true
    end

    private

    def barracks_level
      @barracks_level ||= @user.barracks_level
    end

    def active_recruit_bonus
      bonus = 0.0
      @user.active_spells.where("expires_at > ?", Time.current).each do |active|
        meta = active.metadata || {}
        bonus += meta["magnitude"].to_f if meta["stat_target"] == "recruit_bonus"
      end
      bonus
    end

    def format_duration(seconds)
      if seconds >= 3600
        hours = seconds / 3600.0
        "#{hours.round(1)} hours"
      else
        minutes = seconds / 60.0
        "#{minutes.round(0)} minutes"
      end
    end
  end
end
