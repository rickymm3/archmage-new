module Api
  module V1
    class ExplorationsController < BaseController
      def index
        active = current_user.explorations.active.first
        completed = current_user.explorations.completed.order(finishes_at: :desc)
        claimed = current_user.explorations.claimed.order(updated_at: :desc).limit(5)

        # Auto-process finished explorations
        if active && active.finishes_at <= Time.current
          Explorations::ProcessService.new(active).call
          active = nil
          completed = current_user.explorations.completed.order(finishes_at: :desc)
        end

        available_units = current_user.user_units.includes(:unit)
          .select { |uu| uu.available_quantity > 0 && uu.unit.unit_type != 'hero' }

        render json: {
          active: active ? serialize_exploration(active) : nil,
          completed: completed.map { |e| serialize_exploration(e) },
          claimed: claimed.map { |e| serialize_exploration(e) },
          land: current_user.land,
          available_units: available_units.map { |uu|
            {
              unit_id: uu.unit_id,
              name: uu.unit.name,
              available: uu.available_quantity,
              speed: uu.unit.speed,
              attack: uu.unit.attack,
              defense: uu.unit.defense
            }
          }
        }
      end

      def create
        service = Explorations::StartService.new(current_user, exploration_params)

        if service.call
          render json: {
            message: "Exploration party sent out!",
            exploration: serialize_exploration(current_user.explorations.active.first)
          }, status: :created
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def claim
        exploration = current_user.explorations.completed.find(params[:id])

        service = Explorations::ClaimService.new(exploration)
        if service.call
          render json: {
            message: "Exploration rewards claimed!",
            exploration: serialize_exploration(exploration.reload)
          }
        else
          render json: { error: "Could not claim rewards" }, status: :unprocessable_entity
        end
      end

      private

      def exploration_params
        params.require(:exploration).permit(:unit_id, :quantity)
      end

      def serialize_exploration(exploration)
        {
          id: exploration.id,
          status: exploration.status,
          unit_id: exploration.unit_id,
          unit_name: exploration.unit&.name,
          quantity: exploration.quantity,
          started_at: exploration.started_at,
          finishes_at: exploration.finishes_at,
          land_reward: exploration.land_reward,
          resources_found: exploration.resources_found,
          events: exploration.events
        }
      end
    end
  end
end
