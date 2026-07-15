module Items
  class UseService
    attr_reader :result

    def initialize(user, user_item)
      @user = user
      @user_item = user_item
      @item = user_item.item
      @result = { success: false, message: nil }
    end

    def call
      return fail("This item cannot be used directly — equip it instead.") unless @item.consumable?
      return fail("You don't have any of this item.") if @user_item.quantity <= 0

      effect = @item.use_effect || {}
      applied = {}
      settlements = nil

      ActiveRecord::Base.transaction do
        grant = effect.slice('gold', 'mana', 'land').transform_values(&:to_i).select { |_, v| v > 0 }
        if grant.any?
          @user.grant_resources!(grant)
          applied.merge!(grant)
        end

        if effect['restore_morale'].to_i > 0
          @user.update_morale!([@user.current_morale + effect['restore_morale'].to_i, 100.0].min)
          applied['restore_morale'] = effect['restore_morale'].to_i
        end

        if effect['protection_minutes'].to_i > 0
          base = [@user.protection_expires_at, Time.current].compact.max
          @user.update!(protection_expires_at: base + effect['protection_minutes'].to_i.minutes)
          applied['protection_minutes'] = effect['protection_minutes'].to_i
        end

        settlements = BarbarianSettlement.all.to_a if effect['reveal_settlements']

        @user_item.decrement!(:quantity, 1)
        @user_item.destroy! if @user_item.quantity <= 0
      end

      @result = { success: true, message: "#{@item.name} used.", effect: applied, settlements: settlements }
      true
    rescue => e
      fail(e.message)
    end

    private

    def fail(message)
      @result = { success: false, message: message }
      false
    end
  end
end
