module Town
  class AcceptRecruitsService
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
      if available <= 0
        @errors << "No units available to accept yet."
        return false
      end

      ActiveRecord::Base.transaction do
        user_unit = @user.user_units.find_or_initialize_by(unit: @order.unit)
        user_unit.quantity = (user_unit.quantity || 0) + available
        user_unit.save!

        @order.accepted_quantity += available

        if @order.accepted_quantity >= @order.total_quantity
          @order.completed_at = Time.current
          create_completion_notification(available)
        end

        @order.save!

        @result = {
          accepted: available,
          unit_name: @order.unit.name,
          total_accepted: @order.accepted_quantity,
          total_quantity: @order.total_quantity,
          completed: @order.completed_at.present?
        }
      end

      true
    end

    private

    def create_completion_notification(last_batch)
      @user.notifications.create!(
        title: "Recruitment Complete",
        content: "Your recruitment of #{@order.total_quantity} #{@order.unit.name.pluralize(@order.total_quantity)} is complete! All units have joined your army.",
        category: "recruitment",
        data: {
          unit_id: @order.unit_id,
          unit_name: @order.unit.name,
          total_quantity: @order.total_quantity,
          order_id: @order.id
        }
      )
    end
  end
end
