module Api
  module V1
    class BattlesController < BaseController
      include BattleResultSerializable

      def index
        targeting = Battle::TargetingService.new(current_user)

        render json: {
          my_power: current_user.net_power,
          my_rank: targeting.my_rank,
          range: targeting.range,
          targets: targeting.targets
        }
      end

      def search
        targeting = Battle::TargetingService.new(current_user)
        render json: { results: targeting.search(params[:q]) }
      end

      def setup
        target = User.find_by(id: params[:id])

        if target.nil? || target.id == current_user.id
          render json: { error: "Invalid target" }, status: :unprocessable_entity
          return
        end

        if target.under_protection?
          render json: { error: "Target is under magical protection" }, status: :unprocessable_entity
          return
        end

        unless Battle::TargetingService.in_range?(current_user, target)
          render json: { error: "Target is outside your attack range" }, status: :unprocessable_entity
          return
        end

        user_units = current_user.user_units.includes(:unit).where("quantity > 0")
        heroes = current_user.user_units.joins(:unit).includes(:unit).where(units: { unit_type: "hero" }).where("quantity > 0")

        render json: {
          target: {
            id: target.id,
            username: target.username,
            kingdom_name: target.display_kingdom_name,
            net_power: target.net_power,
            land: target.land,
            under_protection: target.under_protection?
          },
          units: user_units.map { |uu| serialize_battle_unit(uu) },
          heroes: heroes.map { |uu| serialize_battle_unit(uu) }
        }
      end

      def create
        service = Battle::ResolutionService.new(
          attacker_id: current_user.id,
          defender_id: params[:target_id],
          unit_allocations: params[:units] || {},
          hero_allocations: params[:heroes] || {}
        )

        result = service.call

        if result.success?
          render json: { result: serialize_battle_result(result) }
        else
          render json: { error: "Battle could not be initiated: #{result.error}" }, status: :unprocessable_entity
        end
      end

      private

      def serialize_battle_unit(uu)
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
