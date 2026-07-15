module Items
  class EquipService
    attr_reader :result

    def initialize(user, user_item)
      @user = user
      @user_item = user_item
      @result = { success: false, message: nil }
    end

    def call
      return fail("This item cannot be equipped.") if @user_item.item.consumable?
      return fail("You don't own this item.") if @user_item.quantity <= 0

      ActiveRecord::Base.transaction do
        @user.user_items.joins(:item)
             .where(equipped: true, items: { item_type: @user_item.item.item_type })
             .where.not(id: @user_item.id)
             .update_all(equipped: false)
        @user_item.update!(equipped: true)
      end

      @result[:success] = true
      true
    rescue ActiveRecord::RecordInvalid => e
      fail(e.message)
    end

    private

    def fail(message)
      @result[:message] = message
      false
    end
  end
end
