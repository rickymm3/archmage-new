module Api
  module V1
    class TownController < BaseController
      def show
        structures = Structure.all.order(:id)
        current_user.grant_initial_structures if current_user.user_structures.empty?
        user_structures = current_user.user_structures.index_by(&:structure_id)

        render json: {
          structures: structures.map { |s| serialize_structure(s, user_structures[s.id]) },
          land: current_user.land,
          free_land: current_user.free_land,
          gold: current_user.gold,
          mana: current_user.mana
        }
      end

      def build
        structure = Structure.find(params[:structure_id])
        quantity = [ params[:quantity].to_i, 1 ].max

        service = ::Town::BuildService.new(current_user, structure, quantity)

        if service.call
          us = current_user.user_structures.find_by(structure: structure)
          render json: {
            message: structure.level_based? ?
              "Upgraded #{structure.name} to Level #{us.level}" :
              "Built #{quantity} #{structure.name.pluralize(quantity)}",
            user_structure: serialize_user_structure(us),
            gold: current_user.reload.gold,
            mana: current_user.mana
          }
        else
          render json: { errors: service.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def demolish
        structure = Structure.find(params[:structure_id])
        quantity = [ params[:quantity].to_i, 1 ].max

        service = ::Town::DemolishService.new(current_user, structure, quantity)

        if service.call
          us = current_user.user_structures.find_by(structure: structure)
          render json: {
            message: structure.level_based? ?
              "Downgraded #{structure.name} to Level #{us&.level || 0}" :
              "Demolished #{quantity} #{structure.name.pluralize(quantity)}",
            user_structure: us ? serialize_user_structure(us) : nil,
            gold: current_user.reload.gold,
            mana: current_user.mana
          }
        else
          render json: { errors: service.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def recruit
        unit = Unit.find(params[:unit_id])
        tier = params[:tier] || "standard"

        service = ::Town::CreateRecruitmentOrderService.new(current_user, unit.id, tier)

        if service.call
          render json: {
            message: service.result[:message],
            gold: service.result[:gold]
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      private

      def serialize_structure(structure, user_structure)
        current_level = user_structure&.level || 0
        tc_level = @tc_level ||= current_user.user_structures.joins(:structure).where(structures: { slug: 'town_center' }).pick(:level) || 1
        target_level = [current_level, 1].max + 1
        tc_gated = structure.level_based? && structure.slug != 'town_center' && target_level > tc_level

        {
          id: structure.id,
          name: structure.name,
          slug: structure.slug,
          description: structure.description,
          level_based: structure.level_based?,
          max_level: structure.max_level,
          land_cost: structure.level_based? ? structure.land_cost_for_upgrade(current_level) : structure.land_cost,
          production: structure.production,
          resource_cost: structure.resource_cost(current_level),
          user_structure: user_structure ? serialize_user_structure(user_structure) : nil,
          tc_required: tc_gated ? target_level : nil
        }
      end

      def serialize_user_structure(us)
        {
          id: us.id,
          structure_id: us.structure_id,
          level: us.level,
          quantity: us.quantity,
          can_upgrade: us.respond_to?(:can_upgrade?) ? us.can_upgrade? : nil
        }
      end
    end
  end
end
