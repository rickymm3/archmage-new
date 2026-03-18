module Explorations
  class StartService
    attr_reader :errors, :exploration

    def initialize(user, params)
      @user = user
      @unit_id = params[:unit_id]
      @quantity = params[:quantity].to_i
      @errors = []
    end

    def call
      if @unit_id.present? && @quantity <= 0
        @errors << "Quantity must be greater than 0 if a unit is selected."
        return false
      end

      # 1. Validate Active Explorations
      if @user.explorations.active.exists?
        @errors << "You already have an exploration party in the field."
        return false
      end

      unit = nil
      speed_bonus = 0
      user_unit = nil
      
      if @unit_id.present?
        unit = Unit.find_by(id: @unit_id)
        unless unit
          @errors << "Invalid unit selected."
          return false
        end

        user_unit = @user.user_units.find_by(unit: unit)
        unless user_unit && user_unit.available_quantity >= @quantity
          @errors << "Not enough units available."
          return false
        end
        
        speed_bonus = unit.speed.to_f
      else
        @quantity = 0 # No units attached
      end

      # 2. Calculate Duration and Potential
      # Exponential Scaling: 10 * e^(0.08 * Land)
      # 10 Land -> ~22s
      # 50 Land -> ~9m
      # 100 Land -> ~8.3h
      
      base_duration = (10 * Math.exp(0.08 * @user.land)).ceil
      
      # Speed reduction from escort
      # Example: Speed 30 reduces duration by ~15%
      reduction_percent = [speed_bonus * 0.5, 50].min # Max 50% reduction
      duration = (base_duration * (1.0 - (reduction_percent / 100.0))).ceil
      
      # Land Potential (Diminishing Returns)
      # Base potential is 1. Survivors/Escorts multiply this.
      # Formula: Base 1 + (Log(Qty) * Speed/20)
      if @quantity > 0 && unit
        log_qty = Math.log(@quantity + 1)
        # Default speed to 5 if nil to prevent crash
        speed_val = (unit.speed || 5).to_f
        speed_factor = speed_val / 20.0
        max_potential = (1 + (log_qty * speed_factor)).ceil
      else
        max_potential = 1
      end
      
      max_potential = [max_potential, 1].max

      Exploration.transaction do
        # Lock Units only if present
        if unit && @quantity > 0
          user_unit.class.update_counters(user_unit.id, exploring: @quantity)
        end

        # Create Exploration
        @exploration = @user.explorations.create!(
          unit: unit,
          quantity: @quantity,
          started_at: Time.current,
          finishes_at: Time.current + duration.seconds,
          status: :active,
          resources_found: { potential_land: max_potential }, 
          events: []
        )
      end
      
      true
    rescue StandardError => e
      @errors << e.message
      puts e.backtrace
      false
    end
  end
end
