module Town
  class RecruitService
    attr_reader :user, :unit_id, :gold_amount, :errors, :result

    def initialize(user, unit_id, gold_amount)
      @user = user
      @unit_id = unit_id
      @gold_amount = gold_amount.to_i
      @unit = Unit.find(unit_id)
      @errors = []
      @result = {}
    end

    def call
      if @gold_amount <= 0
        @errors << "You must invest more than 0 gold."
        return false
      end

      if @user.gold < @gold_amount
        @errors << "You do not have enough gold."
        return false
      end

      unit_cost = @unit.requirements["gold"].to_i
      if unit_cost <= 0
        @errors << "This unit cannot be recruited with gold."
        return false
      end

      expected_count = (@gold_amount.to_f / unit_cost).floor
      if expected_count <= 0
        @errors << "Not enough gold to recruit even a single #{@unit.name}."
        return false
      end

      # Luck tier: 20% Poor (-20%), 60% Average, 20% Good (+20%)
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

      # Barracks bonus: +3% per barracks level
      barracks_bonus = barracks_level * 0.03

      # Active spell bonus (e.g. recruit_bonus spells)
      spell_bonus = active_recruit_bonus

      total_bonus = 1.0 + barracks_bonus + spell_bonus

      adjusted = expected_count * luck_modifier * total_bonus

      # Variance (+/- 10%)
      variance = rand(0.9..1.1)
      final_count = (adjusted * variance).round
      final_count = [final_count, 1].max if expected_count >= 1

      ActiveRecord::Base.transaction do
        @user.decrement!(:gold, @gold_amount)

        user_unit = @user.user_units.find_or_initialize_by(unit: @unit)
        user_unit.quantity ||= 0
        user_unit.quantity += final_count
        user_unit.save!

        @result = {
          unit: @unit,
          count: final_count,
          spent: @gold_amount,
          luck: luck_label,
          expected: expected_count,
          barracks_bonus: (barracks_bonus * 100).round(0),
          spell_bonus: (spell_bonus * 100).round(0)
        }
      end

      true
    end

    private

    def barracks_level
      barracks = @user.structures.find_by(slug: "barracks")
      return 0 unless barracks
      @user.user_structures.find_by(structure: barracks)&.level || 0
    end

    def active_recruit_bonus
      bonus = 0.0
      @user.active_spells.active.includes(:spell).each do |active|
        meta = active.metadata || {}
        bonus += meta["magnitude"].to_f if meta["stat_target"] == "recruit_bonus"
      end
      bonus
    end
  end
end
