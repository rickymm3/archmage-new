module Api
  module V1
    class BarbariansController < BaseController
      include BattleResultSerializable

      def index
        BarbarianSettlement.find_each(&:respawn_if_ready!)

        settlements = BarbarianSettlement.order(:level)
        render json: { settlements: settlements.map { |s| serialize_settlement(s) } }
      end

      def setup
        settlement = BarbarianSettlement.find_by(id: params[:id])
        return render json: { error: "Settlement not found" }, status: :not_found unless settlement

        settlement.respawn_if_ready!
        user_units = current_user.user_units.includes(:unit).where("quantity > 0")

        render json: {
          settlement: serialize_settlement(settlement),
          units: user_units.map { |uu| serialize_unit(uu) }
        }
      end

      def attack
        service = Barbarians::AttackService.new(
          user: current_user,
          settlement_id: params[:id],
          unit_allocations: params[:units] || {}
        )

        result = service.call

        if result.success?
          payload = serialize_battle_result(result)
          payload[:loot] = result.loot ? {
            gold: result.loot[:gold],
            item: result.loot[:item] ? { name: result.loot[:item].name, rarity: result.loot[:item].rarity } : nil
          } : nil
          render json: { result: payload }
        else
          render json: { error: "Attack could not be initiated: #{result.error}" }, status: :unprocessable_entity
        end
      end

      private

      def serialize_settlement(settlement)
        {
          id: settlement.id,
          slug: settlement.slug,
          name: settlement.name,
          description: settlement.description,
          element: settlement.element,
          level: settlement.level,
          min_level: settlement.min_level,
          max_level: settlement.max_level,
          power_target: settlement.power_target,
          on_cooldown: settlement.on_cooldown?,
          respawn_at: settlement.respawn_at
        }
      end

      def serialize_unit(uu)
        {
          id: uu.id,
          unit_id: uu.unit_id,
          name: uu.unit.name,
          unit_type: uu.unit.unit_type,
          quantity: uu.quantity,
          garrison: uu.garrison,
          available: uu.available_quantity,
          attack: uu.unit.attack,
          defense: uu.unit.defense,
          speed: uu.unit.speed
        }
      end
    end
  end
end
