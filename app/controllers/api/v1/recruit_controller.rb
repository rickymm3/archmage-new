module Api
  module V1
    class RecruitController < BaseController
      RECRUIT_TIERS = {
        "cautious" => { label: "Cautious", multiplier: 0.5, color: "#2ecc71", description: "Small recruitment drive" },
        "standard" => { label: "Standard", multiplier: 1.0, color: "#3498db", description: "Standard recruitment campaign" },
        "aggressive" => { label: "Aggressive", multiplier: 2.0, color: "#f39c12", description: "Aggressive recruitment push" },
        "conscription" => { label: "Conscription", multiplier: 4.0, color: "#e74c3c", description: "Forced conscription — expensive but effective" }
      }.freeze

      def index
        barracks_level = current_user.barracks_level

        json_order = if ActiveRecord::Base.connection.adapter_name == "PostgreSQL"
          Arel.sql("CAST(requirements->>'barracks_level' AS INTEGER) ASC")
        else
          Arel.sql("CAST(json_extract(requirements, '$.barracks_level') AS INTEGER) ASC")
        end
        units = Unit.where(recruitable: true).order(json_order)
        user_units = current_user.user_units.index_by(&:unit_id)

        recruit_bonus = calculate_recruit_bonus

        active_orders = current_user.active_recruitment_orders.includes(:unit).recent
        completed_orders = current_user.recruitment_orders.finished
                                       .where(cancelled_at: nil)
                                       .or(current_user.recruitment_orders.finished.where.not(cancelled_at: nil))
                                       .order(completed_at: :desc).limit(5).includes(:unit)

        render json: {
          barracks_level: barracks_level,
          units: units.map { |u| serialize_unit(u, user_units[u.id], barracks_level) },
          gold: current_user.gold,
          recruit_tiers: RECRUIT_TIERS.transform_values { |t| t.except(:color) },
          recruit_bonus: recruit_bonus,
          max_slots: current_user.recruitment_slots,
          used_slots: active_orders.size,
          active_orders: active_orders.map { |o| serialize_order(o) },
          completed_orders: completed_orders.map { |o| serialize_order(o) }
        }
      end

      def create
        service = ::Town::CreateRecruitmentOrderService.new(current_user, params[:unit_id], params[:tier])

        if service.call
          order = service.result[:order]
          render json: {
            message: service.result[:message],
            order: serialize_order(order),
            gold: current_user.reload.gold
          }
        else
          render json: { error: service.errors.first || "Recruitment failed" }, status: :unprocessable_entity
        end
      end

      def accept
        service = ::Town::AcceptRecruitsService.new(current_user, params[:id])

        if service.call
          render json: {
            message: "#{service.result[:accepted]} #{service.result[:unit_name].pluralize(service.result[:accepted])} joined your army!",
            result: service.result,
            order: serialize_order(service.order)
          }
        else
          render json: { error: service.errors.first || "Accept failed" }, status: :unprocessable_entity
        end
      end

      def cancel
        service = ::Town::CancelRecruitmentOrderService.new(current_user, params[:id])

        if service.call
          r = service.result
          msg = "Order cancelled."
          msg += " #{r[:auto_accepted]} #{r[:unit_name].pluralize(r[:auto_accepted])} accepted." if r[:auto_accepted] > 0
          msg += " #{r[:refund]} gold refunded." if r[:refund] > 0

          render json: {
            message: msg,
            result: r,
            gold: current_user.reload.gold
          }
        else
          render json: { error: service.errors.first || "Cancel failed" }, status: :unprocessable_entity
        end
      end

      private

      def calculate_recruit_bonus
        bonus = 0
        current_user.active_spells.where("expires_at > ?", Time.current).each do |active|
          meta = active.metadata || {}
          if meta["stat_target"] == "recruit_bonus"
            bonus += meta["magnitude"].to_f
          end
        end
        bonus.round(1)
      end

      def serialize_unit(unit, user_unit, barracks_level)
        required_level = unit.requirements["barracks_level"].to_i rescue 0
        base_cost = unit.requirements["gold"].to_i rescue 0
        {
          id: unit.id,
          name: unit.name,
          slug: unit.slug,
          description: unit.description,
          attack: unit.attack,
          defense: unit.defense,
          speed: unit.speed,
          upkeep_cost: unit.upkeep_cost,
          unit_type: unit.unit_type,
          element: unit.element,
          base_cost: base_cost,
          required_level: required_level,
          unlocked: barracks_level >= required_level,
          owned_quantity: user_unit&.quantity || 0,
          tier_costs: RECRUIT_TIERS.transform_values { |t|
            (base_cost * t[:multiplier] * 10).to_i
          }
        }
      end

      def serialize_order(order)
        {
          id: order.id,
          unit: { id: order.unit_id, name: order.unit.name, slug: order.unit.slug },
          tier: order.tier,
          total_quantity: order.total_quantity,
          accepted_quantity: order.accepted_quantity,
          available_to_accept: order.available_to_accept,
          progress_percent: order.progress_percent,
          started_at: order.started_at.iso8601,
          duration_seconds: order.duration_seconds,
          estimated_completion: order.estimated_completion.iso8601,
          next_unit_at: order.next_unit_at&.iso8601,
          gold_invested: order.gold_invested,
          luck: order.luck,
          status: order.status_label
        }
      end
    end
  end
end
