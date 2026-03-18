module Treasury
  class TaxationService
    attr_reader :errors

    TAX_RATES = {
      lenient:   { multiplier: 0.5, cooldown: 1.hour, label: "Lenient", color: "success" },
      standard:  { multiplier: 1.0, cooldown: 4.hours, label: "Standard", color: "primary" },
      heavy:     { multiplier: 1.5, cooldown: 8.hours, label: "Heavy", color: "warning" },
      extortion: { multiplier: 2.0, cooldown: 24.hours, label: "Extortion", color: "danger" }
    }

    def initialize(user)
      @user = user
      @errors = []
    end

    def base_taxable_amount
      calculated = (@user.production_rates[:gold] || 0) * 5 
      base = [500, calculated].max
      (base * @user.tax_multiplier).to_i
    end

    def collect_tax(tier)
      unless TAX_RATES.key?(tier)
        @errors << "Invalid tax tier."
        return false
      end

      if @user.tax_cooldown.present? && @user.tax_cooldown > Time.current
        @errors << "You cannot collect taxes yet."
        return false
      end

      config = TAX_RATES[tier]
      amount = (base_taxable_amount * config[:multiplier]).to_i

      ActiveRecord::Base.transaction do
        @user.increment!(:gold, amount)
        @user.update!(tax_cooldown: Time.current + config[:cooldown])
      end

      true
    end
  end
end
