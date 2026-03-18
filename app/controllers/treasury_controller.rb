class TreasuryController < ApplicationController
  def index
    @tax_service = Treasury::TaxationService.new(current_user)
    
    @taxable_amount = @tax_service.base_taxable_amount
    @tax_rates = Treasury::TaxationService::TAX_RATES
  end

  def tax
    rate_tier = params[:tier].to_sym
    service = Treasury::TaxationService.new(current_user)
    
    if service.collect_tax(rate_tier)
      redirect_to treasury_index_path, notice: "Taxes collected successfully!"
    else
      redirect_to treasury_index_path, alert: service.errors.to_sentence
    end
  end
end
