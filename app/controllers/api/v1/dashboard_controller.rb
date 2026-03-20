module Api
  module V1
    class DashboardController < BaseController
      def show
        user = current_user

        # Auto-process finished exploration
        active_exploration = user.explorations.active.first
        if active_exploration && active_exploration.finishes_at <= Time.current
          Explorations::ProcessService.new(active_exploration).call
          active_exploration = nil
        end

        completed_explorations = user.explorations.completed.order(finishes_at: :desc)

        render json: {
          player: serialize_player(user),
          production_rates: user.production_rates,
          active_spells: serialize_active_spells(user),
          unread_notifications: user.notifications.unread.count,
          army_summary: serialize_army_summary(user),
          active_orders: serialize_active_orders(user),
          exploration: {
            active: active_exploration ? serialize_exploration(active_exploration) : nil,
            completed: completed_explorations.map { |e| serialize_exploration(e) }
          }
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

      def serialize_active_orders(user)
        user.recruitment_orders.active.includes(:unit).map do |order|
          {
            id: order.id,
            unit_name: order.unit.name,
            tier: order.tier,
            total_quantity: order.total_quantity,
            accepted_quantity: order.accepted_quantity,
            available_to_accept: order.available_to_accept,
            progress_percent: order.progress_percent,
            estimated_completion: order.estimated_completion.iso8601
          }
        end
      end

      def serialize_exploration(exploration)
        {
          id: exploration.id,
          status: exploration.status,
          unit_name: exploration.unit&.name,
          quantity: exploration.quantity,
          started_at: exploration.started_at,
          finishes_at: exploration.finishes_at,
          land_reward: exploration.resources_found&.dig('land') || 0,
          gold_reward: exploration.resources_found&.dig('gold') || 0,
          mana_reward: exploration.resources_found&.dig('mana') || 0,
          potential_land: exploration.resources_found&.dig('potential_land'),
          survivors: exploration.resources_found&.dig('survivors') || exploration.quantity
        }
      end
    end
  end
end
