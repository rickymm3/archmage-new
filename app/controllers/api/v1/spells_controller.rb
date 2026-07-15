module Api
  module V1
    class SpellsController < BaseController
      def index
        user_affinity = current_user.color
        user_spells = current_user.user_spells.includes(:spell).index_by(&:spell_id)
        affinities_data = {}

        Spell.distinct.pluck(:affinity).each do |affinity|
          is_native = (affinity == user_affinity || affinity == 'general')
          accessible_ids = Spell.accessible_ids(current_user, affinity)
          accessible_spells = Spell.where(id: accessible_ids).order(:rank, :name).to_a

          learned_spells = accessible_spells.select { |s| user_spells[s.id]&.learned }
          target_us = Spells::RollTargetService.current_target_for(current_user, affinity)

          affinities_data[affinity] = {
            native: is_native,
            total: accessible_spells.size,
            learned_count: learned_spells.size,
            mastered: learned_spells.size == accessible_spells.size,
            learned: learned_spells.map { |s| serialize_spell(s, user_spells[s.id]) },
            target: target_us ? serialize_spell(target_us.spell, target_us) : nil
          }
        end

        render json: {
          affinities: affinities_data,
          user_affinity: user_affinity,
          max_mana: current_user.max_mana,
          current_mana: current_user.mana
        }
      end

      def roll
        service = Spells::RollTargetService.new(current_user, params[:affinity], reroll: false)

        if service.call
          render json: {
            message: "Rolled #{service.result[:spell].name}!",
            spell: serialize_spell(service.result[:spell], service.result[:user_spell])
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def reroll
        service = Spells::RollTargetService.new(current_user, params[:affinity], reroll: true)

        if service.call
          render json: {
            message: "Rerolled — new target: #{service.result[:spell].name}",
            spell: serialize_spell(service.result[:spell], service.result[:user_spell]),
            mana: current_user.reload.mana
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def casting
        learned_spell_ids = current_user.user_spells.where(learned: true).pluck(:spell_id)
        spells = Spell.where(id: learned_spell_ids).order(:name)
        user_spells = current_user.user_spells.index_by(&:spell_id)

        render json: {
          spells: spells.map { |s| serialize_spell(s, user_spells[s.id]) },
          max_mana: current_user.max_mana,
          current_mana: current_user.mana,
          current_gold: current_user.gold,
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
            mana: current_user.reload.mana,
            gold: current_user.gold
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
          cost_resource: spell.cost_resource,
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
