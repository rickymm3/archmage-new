class MarketplaceController < ApplicationController
  def index
    # Ensure listings exist
    Marketplace::GeneratorService.maintain_market_size
    
    @filter = params[:filter] || 'regular'
    
    base_scope = MarketListing.active.includes(:item, :bidder).order(:expires_at)
    
    @listings = case @filter
    when 'heroes'
      base_scope.heroes
    else
      base_scope.regular
    end

    @won_listings = MarketListing.won_by(current_user).includes(:item)
  end

  def bid
    @listing = MarketListing.find(params[:id])
    amount = params[:amount].to_i
    
    service = Marketplace::BidService.new(current_user, @listing.id, amount)
    
    if service.call
      flash[:notice] = "Bid placed successfully!"
    else
      flash[:alert] = service.result[:message]
    end
    
    redirect_to marketplace_index_path
  end
  
  def collect
    @listing = MarketListing.find(params[:id])
    
    if @listing.collect!(current_user)
      flash[:notice] = "Item collected successfully!"
    else
      flash[:alert] = "Could not collect item."
    end
    
    redirect_to marketplace_index_path
  end
end
