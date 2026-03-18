module Town
  class DemolishService
    include ActiveModel::Validations

    attr_reader :user, :structure, :quantity, :user_structure

    validate :validate_quantity_check

    def initialize(user, structure, quantity)
      @user = user
      @structure = structure
      @quantity = structure.level_based? ? 1 : quantity 
      @user_structure = user.user_structures.find_or_initialize_by(structure: structure)
    end

    def call
      return false unless valid?

      User.transaction do
        user.lock!
        
        # Safety check inside lock
        if structure.level_based?
          if user_structure.level <= 1
            errors.add(:base, "Cannot downgrade below level 1")
            raise ActiveRecord::Rollback
          end
        else
          if (user_structure.quantity || 0) < quantity
            errors.add(:base, "Not enough buildings to demolish")
            raise ActiveRecord::Rollback
          end
        end

        # No resource refund for now, just freeing land
        if structure.level_based?
          user_structure.decrement!(:level)
        else
          user_structure.decrement!(:quantity, quantity)
        end
        
        user.touch
      end

      true
    rescue ActiveRecord::Rollback
      false
    end

    private

    def validate_quantity_check
        if structure.level_based?
          if user_structure.level <= 1
             errors.add(:base, "Cannot downgrade below Level 1")
          end
        else
          current = user_structure.quantity || 0
          if current < quantity
             errors.add(:base, "Not enough to demolish")
          end
        end
    end
  end
end
