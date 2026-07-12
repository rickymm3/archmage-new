class UserStructure < ApplicationRecord
  belongs_to :user
  belongs_to :structure

  # Level-based validation
  validates :level, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 10 }, if: -> { structure.level_based? }

  # A structure is "on fire" after being razed in an attack, until the
  # player acknowledges the loss (puts out the fire).
  def burning?
    burning == true
  end

  # Record damage from a raid. `kind` is "level" or "quantity"; `amount` is how
  # much was lost. If already burning, the losses accumulate under the newest
  # attacker so a fresh raid doesn't erase the memory of an unacknowledged one.
  def record_raze!(kind:, amount:, attacker_name:)
    info = (damage_info || {}).dup
    prior = info["kind"] == kind ? info["amount"].to_i : 0

    update!(
      burning: true,
      damage_info: {
        "attacker_name" => attacker_name,
        "structure_name" => structure.name,
        "kind" => kind,
        "amount" => prior + amount,
        "occurred_at" => Time.current.iso8601
      }
    )
  end

  # Put out the fire — clears the visual/alert. The lost levels/buildings
  # stay lost; this is acknowledgment only.
  def extinguish!
    update!(burning: false, damage_info: nil)
  end

  def can_upgrade?
    return false if structure.level_based? && level >= structure.max_level
    
    # Calculate costs for NEXT level
    next_level = level + 1
    # Cost to reach level N from level N-1 is usually:
    # Gold: Base * N
    # Land: Base Land Cost * 1 (Since we just need ONE more 'unit' of land cost worth)
    # Wait, the prompt says "Level 2 might require an additional 5 land".
    
    # Check land
    return false if user.free_land < structure.land_cost

    # Check resources (Gold/Mana)
    # Resource cost scales with level? Or is it flat?
    # "Leveling a structure also costs gold and or mana..."
    # Let's assume linear scaling: Level 2 upgrade costs more than Level 1.
    cost = upgrade_cost(next_level)
    
    user.has_resources?(cost)
  end

  def upgrade!
    return false unless can_upgrade?
    
    transaction do
      # Deduct Resources
      user.deduct_resources!(upgrade_cost(level + 1))
      
      # Deduct Land (We don't actually subtract land, we just make it 'used' by incrementing the level)
      # User.rb calculates used_land dynamically based on structure levels.
      
      if structure.level_based?
        increment!(:level)
      else
        increment!(:quantity) # For farms, 'upgrade' means build another one
      end
    end
  end

  def downgrade!
    return false if structure.level_based? && level <= 1
    return false if !structure.level_based? && quantity <= 0

    transaction do
      if structure.level_based?
        decrement!(:level)
        # Refund? Maybe later. For now, land is freed automatically.
      else
        decrement!(:quantity)
      end
    end
  end

  def upgrade_cost(target_level)
    # Example: Base Gold 100 * Target Level 2 = 200 Gold
    # For Quantity based (Farms), cost is flat per unit usually.
    if structure.level_based?
      structure.requirements.transform_values { |v| (v.to_i * target_level).to_i }
    else
      structure.requirements # Flat cost for next farm
    end
  end
end
