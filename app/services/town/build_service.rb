module Town
  class BuildService
    include ActiveModel::Validations

    attr_reader :user, :structure, :quantity, :user_structure

    validate :validate_resources

    def initialize(user, structure, quantity)
      @user = user
      @structure = structure
      @quantity = structure.level_based? ? 1 : quantity 
      # IMPORTANT: If record exists, we fetch it. If not, we init it.
      # The problem was find_or_create_by was CREATING a record immediately if not found
      # but if it was found, it might not have had the default 'level' set correctly if migrated?
      # No, find_or_create_by should return the existing record.
      
      @user_structure = user.user_structures.find_or_initialize_by(structure: structure)
      
      # Ensure defaults if new record
      if @user_structure.new_record?
         @user_structure.level = 1
         @user_structure.quantity = 0
      end
    end

    def call
      return false unless valid?

      User.transaction do
        user.lock! # Prevent race conditions
        
        # Double check inside transaction for safety
        if !user.has_resources?(total_cost)
          errors.add(:base, "Not enough resources")
          raise ActiveRecord::Rollback
        end

        if user.free_land < land_needed
          errors.add(:base, "Not enough free land (Need #{land_needed})")
          raise ActiveRecord::Rollback
        end

        if structure.level_based? && user_structure.level >= structure.max_level
          errors.add(:base, "Structure already at max level")
          raise ActiveRecord::Rollback
        end

        # Deduct resources
        user.deduct_resources!(total_cost)

        # Apply changes
        if structure.level_based?
          # increment! method bypasses validations unless we are careful, and it saves immediately.
          # The issue might be that user_structure was initialized but not saved if it was new?
          # Or increment! is failing silently?
          
          # Let's be explicit
          user_structure.level ||= 1
          user_structure.level += 1
          user_structure.save!
        else
          user_structure.quantity ||= 0
          user_structure.quantity += quantity
          user_structure.save!
        end
        
        # Touch user to update timestamps if needed
        user.touch
      end

      true
    rescue ActiveRecord::Rollback
      false
    end

    private

    def total_cost
      if structure.level_based?
         # Scale cost by current level (Linear: Base * Current Level)
         # e.g. Base 1000.
         # Level 1 -> 2: 1000 * 1 = 1000
         # Level 2 -> 3: 1000 * 2 = 2000
         # Level 3 -> 4: 1000 * 3 = 3000
         current_level = user_structure.try(:level) || 1
         structure.requirements.transform_values { |v| (v.to_i * current_level).to_i }
      else
         # For farms, quantity multiplied
         structure.requirements.transform_values { |v| (v.to_i * quantity).to_i }
      end
    end

    def land_needed
      if structure.level_based?
        current_level = user_structure.try(:level) || 1
        structure.land_cost_for_upgrade(current_level)
      else
        quantity * structure.land_cost
      end
    end

    def validate_resources
      required = total_cost
      unless user.has_resources?(required)
        missing = []
        required.each do |res, amount|
          available = user.send(res)
          missing << "#{res.to_s.humanize} (#{available}/#{amount})" if available < amount
        end
        errors.add(:base, "Not enough resources: #{missing.join(', ')}")
      end

      if user.free_land < land_needed
        errors.add(:base, "Not enough free land.")
      end
      
      if structure.level_based? && user_structure.level >= structure.max_level
        errors.add(:base, "Max Level Reached")
      end

      # Town Center soft gate: no structure can exceed TC level
      if structure.level_based? && structure.slug != 'town_center'
        tc_level = user.user_structures.joins(:structure).where(structures: { slug: 'town_center' }).pick(:level) || 1
        target_level = (user_structure.try(:level) || 1) + 1
        if target_level > tc_level
          errors.add(:base, "Town Center must be level #{target_level} first")
        end
      end
    end
  end
end
