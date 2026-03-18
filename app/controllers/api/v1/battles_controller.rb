module Api
  module V1
    class BattlesController < BaseController
      def index
        last_scouted = current_user.last_scouted_at
        if last_scouted.nil? || last_scouted < 10.minutes.ago
          Battle::ScoutingService.new(current_user).call
          current_user.reload
        end

        render json: {
          targets: current_user.scouted_targets || [],
          can_refresh: current_user.last_scouted_at.present? && current_user.last_scouted_at < 5.minutes.ago,
          last_scouted_at: current_user.last_scouted_at
        }
      end

      def scout
        Battle::ScoutingService.new(current_user).call
        current_user.reload

        render json: {
          targets: current_user.scouted_targets || [],
          can_refresh: false,
          last_scouted_at: current_user.last_scouted_at,
          message: "Scouting report updated"
        }
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

      def serialize_battle_result(result)
        {
          outcome: result.winner.to_s,
          land_seized: result.land_seized || 0,
          attacker_army: serialize_army_summary(result.attacker_army),
          defender_army: serialize_army_summary(result.defender_army),
          log: result.log || []
        }
      end

      def serialize_army_summary(army)
        return nil unless army
        {
          name: army.name,
          stacks: army.stacks.map do |s|
            {
              name: s.name,
              unit_id: s.unit_id,
              unit_type: s.unit_type,
              element: s.element,
              attack: s.attack,
              defense: s.defense,
              speed: s.speed,
              initial: s.initial_quantity,
              remaining: s.quantity,
              lost: s.initial_quantity - s.quantity,
              hero: s.hero,
              hero_alive: s.hero ? (s.hero_hp || 0) > 0 : nil
            }
          end
        }
      end
    end
  end
end
