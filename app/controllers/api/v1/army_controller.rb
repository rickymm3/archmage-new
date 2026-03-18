module Api
  module V1
    class ArmyController < BaseController
      def show
        holdings = current_user.user_units.includes(:unit, :assigned_hero).where("quantity > 0")

        morale_service = Treasury::MoraleService.new(current_user)

        render json: {
          units: holdings.map { |uu| serialize_user_unit(uu) },
          stats: {
            total_quantity: holdings.sum(&:quantity),
            total_upkeep: holdings.sum { |uu| uu.quantity * uu.unit.upkeep_cost },
            total_mana_upkeep: holdings.sum { |uu| uu.quantity * (uu.unit.respond_to?(:mana_upkeep) ? (uu.unit.mana_upkeep || 0) : 0) },
            total_attack: holdings.sum { |uu| uu.quantity * uu.unit.attack },
            total_defense: holdings.sum { |uu| uu.quantity * uu.unit.defense },
            daily_upkeep: morale_service.daily_upkeep,
            morale: current_user.respond_to?(:current_morale) ? current_user.current_morale : current_user.morale
          },
          gold: current_user.gold
        }
      end

      def pay_upkeep
        amount = params[:amount].to_i
        service = Treasury::MoraleService.new(current_user)

        if service.pay_upkeep(amount)
          render json: {
            message: "Paid upkeep",
            gold: current_user.reload.gold,
            morale: current_user.respond_to?(:current_morale) ? current_user.current_morale : current_user.morale
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def disband
        user_unit = current_user.user_units.includes(:unit).find_by(unit_id: params[:unit_id])

        unless user_unit
          render json: { error: "Unit not found in your army" }, status: :not_found
          return
        end

        # Summoned units cannot be disbanded
        if !user_unit.unit.recruitable && user_unit.unit.unit_type != 'hero'
          render json: { error: "Summoned units cannot be disbanded. They are bound to your kingdom." }, status: :unprocessable_entity
          return
        end

        quantity = params[:quantity].to_i
        available = user_unit.quantity - user_unit.garrison

        if quantity <= 0
          render json: { error: "Invalid quantity" }, status: :unprocessable_entity
        elsif quantity > available
          render json: { error: "Cannot disband more units than are currently active" }, status: :unprocessable_entity
        else
          user_unit.quantity -= quantity
          if user_unit.quantity == 0 && user_unit.garrison == 0
            user_unit.destroy
          else
            user_unit.save!
          end
          render json: { message: "Disbanded #{quantity} #{user_unit.unit.name.pluralize(quantity)}" }
        end
      end

      def garrison
        user_units = current_user.user_units.includes(:unit, :assigned_hero).where("quantity > 0")

        hero_unit_ids = current_user.user_units.joins(:unit).where(units: { unit_type: "hero" }).where("quantity > 0").pluck(:unit_id)
        heroes = Unit.where(id: hero_unit_ids)

        available_spells = current_user.spells.where(spell_type: [ "Battle", "Enchantment" ]).order(:name)

        render json: {
          units: user_units.map { |uu| serialize_user_unit(uu) },
          heroes: heroes.map { |h| { id: h.id, name: h.name, attack: h.attack, defense: h.defense } },
          available_spells: available_spells.map { |s| { id: s.id, name: s.name, spell_type: s.spell_type } },
          active_defense_spell_id: current_user.active_defense_spell_id
        }
      end

      def update_garrison
        updates = params[:units] || []

        ActiveRecord::Base.transaction do
          updates.each do |unit_update|
            uu = current_user.user_units.find(unit_update[:id])
            uu.update!(garrison: unit_update[:garrison].to_i)
          end

          if params[:active_defense_spell_id].present?
            current_user.update!(active_defense_spell_id: params[:active_defense_spell_id])
          end
        end

        render json: { message: "Defenses updated" }
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def assign_hero
        user_unit = current_user.user_units.find_by(unit_id: params[:unit_id])

        unless user_unit
          render json: { error: "Unit group not found" }, status: :not_found
          return
        end

        if params[:hero_id].present?
          hero = Unit.find_by(id: params[:hero_id], unit_type: "hero")

          unless hero && current_user.user_units.where(unit_id: hero.id).where("quantity > 0").exists?
            render json: { error: "Invalid hero or you don't own this hero" }, status: :unprocessable_entity
            return
          end

          if user_unit.update(hero_id: hero.id)
            render json: { message: "#{hero.name} assigned to #{user_unit.unit.name}" }
          else
            render json: { errors: user_unit.errors.full_messages }, status: :unprocessable_entity
          end
        else
          user_unit.update(hero_id: nil)
          render json: { message: "Hero removed from #{user_unit.unit.name}" }
        end
      end

      private

      def serialize_user_unit(uu)
        {
          id: uu.id,
          unit_id: uu.unit_id,
          name: uu.unit.name,
          slug: uu.unit.slug,
          unit_type: uu.unit.unit_type,
          quantity: uu.quantity,
          garrison: uu.garrison,
          exploring: uu.exploring,
          available: uu.available_quantity,
          attack: uu.unit.attack,
          defense: uu.unit.defense,
          speed: uu.unit.speed,
          upkeep_cost: uu.unit.upkeep_cost,
          mana_upkeep: uu.unit.respond_to?(:mana_upkeep) ? uu.unit.mana_upkeep : 0,
          element: uu.unit.element,
          abilities: uu.unit.abilities,
          hero: uu.assigned_hero ? { id: uu.assigned_hero.id, name: uu.assigned_hero.name } : nil
        }
      end
    end
  end
end
