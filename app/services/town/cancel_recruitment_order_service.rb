module Town
  class CancelRecruitmentOrderService
    attr_reader :user, :order, :errors, :result

    def initialize(user, order_id)
      @user = user
      @order = user.recruitment_orders.find_by(id: order_id)
      @errors = []
      @result = {}
    end

    def call
      unless @order
        @errors << "Recruitment order not found."
        return false
      end

      unless @order.active?
        @errors << "This recruitment order is no longer active."
        return false
      end

      available = @order.available_to_accept
      arrived = @order.arrived_quantity
      undelivered = @order.total_quantity - arrived

      # Refund 50% of gold proportional to undelivered units
      refund = ((undelivered.to_f / @order.total_quantity) * @order.gold_invested * 0.5).floor

      ActiveRecord::Base.transaction do
        # Auto-accept any arrived-but-unclaimed units
        if available > 0
          user_unit = @user.user_units.find_or_initialize_by(unit: @order.unit)
          user_unit.quantity = (user_unit.quantity || 0) + available
          user_unit.save!
          @order.accepted_quantity += available
        end

        # Refund gold
        @user.increment!(:gold, refund) if refund > 0

        @order.cancelled_at = Time.current
        @order.completed_at = Time.current
        @order.save!

        @result = {
          refund: refund,
          auto_accepted: available,
          unit_name: @order.unit.name,
          undelivered: undelivered
        }
      end

      true
    end
  end
end
