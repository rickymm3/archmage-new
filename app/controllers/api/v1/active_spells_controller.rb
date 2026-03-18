module Api
  module V1
    class ActiveSpellsController < BaseController
      def index
        active_spells = current_user.active_spells.includes(:spell)
        sustained_spells = current_user.user_spells.where(active: true).includes(:spell)

        render json: {
          active_spells: active_spells.map { |as| serialize_active_spell(as) },
          sustained_spells: sustained_spells.map { |us| serialize_sustained_spell(us) }
        }
      end

      def destroy
        if params[:type] == "sustained"
          user_spell = current_user.user_spells.find(params[:id])

          if user_spell.update(active: false)
            render json: { message: "Spell deactivated. Mana restored." }
          else
            render json: { error: "Could not deactivate spell" }, status: :unprocessable_entity
          end
        else
          active_spell = current_user.active_spells.find(params[:id])
          active_spell.destroy
          render json: { message: "Enchantment dispelled" }
        end
      end

      private

      def serialize_active_spell(as)
        {
          id: as.id,
          spell_id: as.spell_id,
          spell_name: as.spell.name,
          spell_type: as.spell.spell_type,
          expires_at: as.expires_at,
          stack_count: as.stack_count,
          duration_remaining: as.duration_remaining,
          metadata: as.metadata
        }
      end

      def serialize_sustained_spell(us)
        {
          id: us.id,
          spell_id: us.spell_id,
          spell_name: us.spell.name,
          spell_type: us.spell.spell_type,
          active: us.active
        }
      end
    end
  end
end
