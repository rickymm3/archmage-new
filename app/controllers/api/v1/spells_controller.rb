module Api
  module V1
    class SpellsController < BaseController
      def index
        user_affinity = current_user.color
        user_spells = current_user.user_spells.index_by(&:spell_id)

        all_spells = Spell.order(:rank, :name).to_a
        affinities_data = {}

        # Group spells by affinity
        grouped = all_spells.group_by(&:affinity)

        grouped.each do |affinity, spells|
          is_native = (affinity == user_affinity || affinity == 'general')
          max_spells = is_native ? spells.length : 8
          capped_spells = spells.first(max_spells)

          # Linear unlock: each spell requires the previous one in same affinity to be learned
          prev_learned = true
          serialized = capped_spells.map do |s|
            us = user_spells[s.id]
            learned = us&.learned || false
            unlocked = prev_learned
            prev_learned = learned

            serialize_spell(s, us).merge(
              unlocked: unlocked,
              native: is_native
            )
          end

          affinities_data[affinity] = serialized
        end

        render json: {
          affinities: affinities_data,
          user_affinity: user_affinity,
          max_mana: current_user.max_mana,
          current_mana: current_user.mana
        }
      end

      def casting
        learned_spell_ids = current_user.user_spells.where(learned: true).pluck(:spell_id)
        spells = Spell.where(id: learned_spell_ids).order(:name)
        user_spells = current_user.user_spells.index_by(&:spell_id)

        render json: {
          spells: spells.map { |s| serialize_spell(s, user_spells[s.id]) },
          max_mana: current_user.max_mana,
          current_mana: current_user.mana,
          magic_power: current_user.magic_power
        }
      end

      def research
        spell = Spell.find(params[:id])
        amount = params[:amount].to_i

        service = Spells::ResearchService.new(current_user, spell, amount)

        if service.call
          result = service.result
          render json: {
            message: result[:learned] ?
              "Invested #{result[:invested]} mana. You have learned #{spell.name}!" :
              "Invested #{result[:invested]} mana",
            result: result,
            mana: current_user.reload.mana
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def cast
        spell = Spell.find(params[:id])
        amount = [ params[:amount].to_i, spell.mana_cost, 1 ].max

        service = Spells::CastService.new(current_user, spell, amount: amount)

        if service.call
          render json: {
            message: service.result[:success],
            result: service.result,
            mana: current_user.reload.mana
          }
        else
          render json: { error: service.result[:error] }, status: :unprocessable_entity
        end
      end

      private

      def serialize_spell(spell, user_spell)
        {
          id: spell.id,
          name: spell.name,
          rank: spell.rank,
          affinity: spell.affinity,
          mana_cost: spell.mana_cost,
          research_cost: spell.research_cost,
          spell_type: spell.spell_type,
          rarity: spell.rarity,
          description: spell.description,
          configuration: spell.configuration,
          learned: user_spell&.learned || false,
          research_progress: user_spell&.research_progress || 0,
          active: user_spell&.active || false
        }
      end
    end
  end
end
