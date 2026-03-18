module Game
  class StatCalculator
    def initialize(user, stat)
      @user = user
      @stat = stat.to_s
    end

    def call
      base_value + active_spell_modifiers + structure_modifiers
    end

    private

    def base_value
      # This could be fetched from a config or constants based on the entity
      case @stat
      when 'morale' then 100
      when 'research_speed' then 1.0
      when 'gold_income' then 0
      when 'mana_recovery' then 10
      else 0
      end
    end

    def active_spell_modifiers
      # Sum up the magnitude of all active spells targeting this stat
      @user.active_spells
           .select { |s| s.metadata['stat_target'] == @stat }
           .sum { |s| s.metadata['magnitude'].to_f }
    end

    def structure_modifiers
      # Placeholder for future structure modifiers
      0
    end
  end
end
