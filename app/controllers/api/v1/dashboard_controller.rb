module Api
  module V1
    class DashboardController < BaseController
      def show
        user = current_user

        render json: {
          player: serialize_player(user),
          production_rates: user.production_rates,
          active_spells: serialize_active_spells(user),
          unread_notifications: user.notifications.unread.count,
          army_summary: serialize_army_summary(user)
        }
      end

      private

      def serialize_player(user)
        {
          id: user.id,
          username: user.username,
          kingdom_name: user.display_kingdom_name,
          color: user.color,
          affinity: user.affinity.name,
          gold: user.gold,
          mana: user.mana,
          max_mana: user.max_mana,
          land: user.land,
          free_land: user.free_land,
          morale: user.respond_to?(:current_morale) ? user.current_morale : user.morale,
          net_power: user.net_power,
          magic_power: user.magic_power,
          protection_expires_at: user.protection_expires_at,
          under_protection: user.under_protection?,
          mana_charge: user.current_mana_charge
        }
      end

      def serialize_active_spells(user)
        user.active_spells.includes(:spell).map do |as|
          {
            id: as.id,
            spell_name: as.spell.name,
            spell_type: as.spell.spell_type,
            expires_at: as.expires_at,
            stack_count: as.stack_count
          }
        end
      end

      def serialize_army_summary(user)
        holdings = user.user_units.includes(:unit)
        {
          total_units: holdings.sum(&:quantity),
          total_strength: user.army_strength,
          total_upkeep: holdings.sum { |uu| uu.quantity * uu.unit.upkeep_cost },
          unit_count: holdings.count
        }
      end
    end
  end
end
