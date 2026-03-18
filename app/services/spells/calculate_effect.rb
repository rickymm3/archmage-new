module Spells
  class CalculateEffect
    attr_reader :spell, :amount

    def initialize(spell, amount)
      @spell = spell
      @amount = amount.to_i
    end

    def call
      config = spell.configuration&.dig('scaling') || {}
      
      # Fallback for spells without new scaling config
      return legacy_fallback(config) if config.empty?

      value = case config['function']
              when 'linear'
                calculate_linear(config)
              when 'step'
                calculate_step(config)
              when 'log'
                calculate_log(config)
              else
                0
              end

      {
        value: value,
        attribute: config['attribute'],
        unit: config['unit'],
        description: format_description(value, config)
      }
    end

    private

    def calculate_linear(config)
      # Formula: Value = (Invested Mana * Rate) + Base
      rate = config['rate'].to_f
      base = config['base'].to_f
      
      (amount * rate) + base
    end

    def calculate_step(config)
      # Formula: Value = floor(Invested Mana / Cost Per Unit)
      cost_per_unit = config['cost_per_unit'].to_i
      return 0 if cost_per_unit.zero?
      
      (amount / cost_per_unit).floor
    end

    def calculate_log(config)
      # Formula: Value = Base * log2((Invested / BaseCost) + 1)
      # Used for diminishing returns on power/magnitudes
      base_magnitude = config['base_magnitude'].to_f
      base_cost = (config['base_cost'] || spell.mana_cost).to_f
      return 0 if base_cost.zero?

      ratio = amount.to_f / base_cost
      factor = Math.log2(ratio + 1)
      
      (base_magnitude * factor).round(2)
    end

    def legacy_fallback(config)
      # Preserves behavior for spells not yet migrated
      {
        value: nil,
        attribute: 'unknown',
        description: "Standard Effect"
      }
    end

    def format_description(value, config)
      case config['attribute']
      when 'duration'
        # Convert seconds to hours/days
        hours = value / 3600.0
        if hours >= 24
          "Duration: #{(hours / 24.0).round(1)} Days"
        else
          "Duration: #{hours.round(1)} Hours"
        end
      when 'quantity'
        "Summon: #{value.to_i} Units"
      else
        "Effect: #{value} #{config['unit']}"
      end
    end
  end
end
