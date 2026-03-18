module Api
  module V1
    class TreasuryController < BaseController
      def index
        tax_service = Treasury::TaxationService.new(current_user)

        render json: {
          taxable_amount: tax_service.base_taxable_amount,
          tax_rates: Treasury::TaxationService::TAX_RATES,
          gold: current_user.gold,
          mana: current_user.mana,
          max_mana: current_user.max_mana,
          mana_charge: current_user.current_mana_charge,
          net_mana_potential: current_user.net_mana_potential,
          mana_generation: current_user.mana_generation_potential,
          mana_upkeep: current_user.mana_upkeep_potential,
          last_recharge_at: current_user.last_mana_recharge_at&.iso8601,
          mana_drain_duration: current_user.mana_drain_duration.to_i,
          production_rates: current_user.production_rates
        }
      end

      def tax
        rate_tier = params[:tier].to_sym
        service = Treasury::TaxationService.new(current_user)

        if service.collect_tax(rate_tier)
          render json: {
            message: "Taxes collected successfully!",
            gold: current_user.reload.gold,
            mana: current_user.mana
          }
        else
          render json: { errors: service.errors }, status: :unprocessable_entity
        end
      end

      def mana_recharge
        service = Treasury::ChannelMana.new(current_user)
        result = service.call

        if result.success?
          data = { message: result.message, mana: current_user.reload.mana }
          data[:notification_id] = result.notification.id if result.notification
          render json: data
        else
          render json: { error: result.message }, status: :unprocessable_entity
        end
      end

      def mana_status
        render json: {
          mana: current_user.mana,
          max_mana: current_user.max_mana,
          mana_charge: current_user.current_mana_charge,
          last_recharge_at: current_user.last_mana_recharge_at
        }
      end
    end
  end
end
