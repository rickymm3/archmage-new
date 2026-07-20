module Spells
  class CastService
    attr_reader :user, :spell, :amount, :result

    def initialize(user, spell, amount: nil)
      @user = user
      @spell = spell
      @amount = (amount || spell.mana_cost).to_i
      @result = {}
    end

    def call
      user_spell = user.user_spells.find_by(spell: spell)
      
      unless user_spell&.learned?
        @result[:error] = "You haven't learned this spell yet."
        return false
      end
      
      # Ensure minimum cast amount
      if @amount < spell.mana_cost
        @result[:error] = "Not enough #{resource_name}. Minimum investment is #{spell.mana_cost}."
        return false
      end

      unless resource_available?(@amount)
         @result[:error] = "Not enough #{resource_name} available. You have #{current_resource_amount}, need #{@amount}."
         return false
      end

      case spell.spell_type
      when 'self'
        cast_self_buff(user_spell)
      when 'attack', 'enemy'
        cast_attack(user_spell)
      when 'defense'
        cast_defense(user_spell)
      when 'summon'
        cast_summon(user_spell)
      else
        @result[:error] = "Unknown spell type."
        return false
      end
    rescue => e
      @result[:error] = "Spell casting failed: #{e.message}"
      Rails.logger.error("CastService Error: #{e.message}\n#{e.backtrace.join("\n")}")
      false
    end

    private

    # Most spells cost mana to cast, but a spell can set cost_resource: "gold"
    # to instead draw its cost straight from the treasury (e.g. Meditation,
    # which trades gold for a mana-production boost so it doesn't eat into
    # the very mana pool it's meant to grow).
    def resource_name
      spell.cost_resource == 'gold' ? 'gold' : 'mana'
    end

    def current_resource_amount
      spell.cost_resource == 'gold' ? user.gold : user.mana
    end

    def resource_available?(amount)
      current_resource_amount >= amount
    end

    def deduct_cost!(amount)
      if spell.cost_resource == 'gold'
        user.decrement!(:gold, amount)
      else
        user.decrement!(:mana, amount)
      end
    end

    # Configuration Helper
    def spell_config
      # Default fallbacks if DB configuration is missing
      defaults = {
        'Serenity' => { 'stat' => 'morale', 'base' => 5, 'duration' => 4.hours },
        'Arcane Insight' => { 'stat' => 'research_speed', 'base' => 0.1, 'duration' => 24.hours },
        'Minor Heal' => { 'stat' => 'health_regen', 'base' => 2, 'duration' => 1.hour },
        'Mana Surge' => { 'stat' => 'mana_recovery', 'base' => 5, 'duration' => 6.hours },
        'Gold Rush' => { 'stat' => 'gold_income', 'base' => 10, 'duration' => 12.hours }
      }
      base_defaults = { 'stat' => 'unknown', 'base' => 0, 'duration' => 4.hours }
      
      target_defaults = defaults[spell.name] || base_defaults
      db_config = spell.configuration || {}
      
      # Merge DB config over defaults
      {
        stat: db_config['stat_target'] || target_defaults['stat'],
        base: (db_config['base_magnitude'] || target_defaults['base']).to_f,
        duration: (db_config['duration'] || target_defaults['duration']).to_i
      }
    end

    def calculate_magnitude(config)
      base_mag = config[:base]
      base_cost = spell.mana_cost.to_f
      
      # Logarithmic Scaling Formula: Effect = Base * log2((Invested / BaseCost) + 1)
      ratio = @amount.to_f / base_cost
      factor = Math.log2(ratio + 1)

      value = base_mag * factor
      # Affinity synergy for legacy-path spells too (+15% native color).
      value *= User::NATIVE_SPELL_BONUS if spell.affinity.to_s == user.color.to_s
      value.round(2)
    end
    
    def cast_self_buff(user_spell)
      # New Calculation Service
      effect = Spells::CalculateEffect.new(spell, @amount, user: user).call
      
      # Legacy fallback logic for spells not yet using the new system
      if effect[:value].nil?
        config = spell_config
        magnitude = calculate_magnitude(config)
        duration = config[:duration]
        stat_target = config[:stat]
        description = "+#{magnitude} #{stat_target.humanize} for #{duration / 3600} hours"
      else
        # New System Logic
        if effect[:attribute] == 'duration'
           duration = effect[:value]
           magnitude = 1 # Boolean/Toggle spells like Fog
           stat_target = spell.configuration['stat_target'] || 'unknown'
        else
           # Assume Magnitude scaling if not duration
           duration = spell.configuration['duration'] || 24.hours
           magnitude = effect[:value]
           stat_target = spell.configuration['stat_target'] || 'unknown'
        end
        description = effect[:description]
      end

      expires_at = Time.current + duration

      # Use a transaction for data integrity
      user.transaction do
        deduct_cost!(@amount)
        
        # Create or Update ActiveSpell
        active = user.active_spells.find_or_initialize_by(spell: spell)
        active.expires_at = expires_at
        active.metadata ||= {}
        active.metadata['stat_target'] = stat_target
        active.metadata['magnitude'] = magnitude
        active.metadata['invested_mana'] = @amount
        # Tag combat-relevant buffs so battle resolution can find them
        if stat_target.to_s.include?('attack')
          active.metadata['spell_type'] = 'attack'
        elsif stat_target.to_s.include?('defense')
          active.metadata['spell_type'] = 'defense'
        end
        active.save!
        
        @result[:success] = "Cast #{spell.name}. #{description}."
      end
      true
    end
    
    def cast_defense(user_spell)
      config = spell_config
      magnitude = calculate_magnitude(config)
      duration = config[:duration] > 0 ? config[:duration] : 4.hours
      stat_target = config[:stat]
      expires_at = Time.current + duration

      user.transaction do
        deduct_cost!(@amount)
        
        active = user.active_spells.find_or_initialize_by(spell: spell)
        active.expires_at = expires_at
        active.metadata ||= {}
        active.metadata['stat_target'] = stat_target
        active.metadata['magnitude'] = magnitude
        active.metadata['invested_mana'] = @amount
        active.metadata['spell_type'] = 'defense'
        active.save!
        
        @result[:success] = "Defense raised! #{spell.name} (+#{magnitude} #{stat_target.to_s.humanize}) active for #{duration / 3600} hours."
      end
      true
    end

    def cast_attack(user_spell)
      config = spell_config
      magnitude = calculate_magnitude(config)
      duration = config[:duration] > 0 ? config[:duration] : 4.hours
      stat_target = config[:stat]
      expires_at = Time.current + duration

      user.transaction do
        deduct_cost!(@amount)
        
        active = user.active_spells.find_or_initialize_by(spell: spell)
        active.expires_at = expires_at
        active.metadata ||= {}
        active.metadata['stat_target'] = stat_target
        active.metadata['magnitude'] = magnitude
        active.metadata['invested_mana'] = @amount
        active.metadata['spell_type'] = 'attack'
        active.save!
        
        @result[:success] = "#{spell.name} cast! (+#{magnitude} #{stat_target.to_s.humanize}) active for #{duration / 3600} hours."
      end
      true
    end
    
    def cast_summon(user_spell)
      # New Calculation Service
      effect = Spells::CalculateEffect.new(spell, @amount, user: user).call
      
      config = spell.configuration || {}
      target_slug = (config['unit_slug'] || config[:unit_slug])&.to_s&.strip
      
      unless target_slug.present?
         @result[:error] = "Configuration error: missing unit_slug"
         return false
      end
      
      unit = ::Unit.find_by(slug: target_slug)
      unless unit
         @result[:error] = "Unit not found: #{target_slug}"
         return false
      end

      user.transaction do
        deduct_cost!(@amount)
        
        if effect[:value].nil?
            # Legacy Logic
            cost = spell.mana_cost
            base_quantity = (config['quantity'] || config[:quantity]) || 1
            multiplier = user.summon_quantity_multiplier || 1.0
            
            investment_ratio = @amount.to_f / cost.to_f
            total_quantity_float = base_quantity.to_f * multiplier * investment_ratio
            total_quantity = total_quantity_float.floor
            fraction = total_quantity_float - total_quantity
            total_quantity += 1 if rand < fraction
        else
            # New Step Logic
            base_count = effect[:value]
            multiplier = user.summon_quantity_multiplier || 1.0
            total_quantity = (base_count * multiplier).floor
        end
        
        if total_quantity > 0
          user_unit = user.user_units.find_or_initialize_by(unit: unit)
          user_unit.quantity = (user_unit.quantity || 0) + total_quantity
          user_unit.save!
          @result[:success] = "Summoned #{total_quantity}x #{unit.name}."
        else
          @result[:success] = "Summon failed (insufficient mana for a single unit)."
        end
      end
      true
    end
  end
end
