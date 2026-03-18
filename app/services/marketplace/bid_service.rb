module Marketplace
  class BidService
    attr_reader :result

    def initialize(user, listing_id, amount)
      @user = user
      @listing = MarketListing.find(listing_id)
      @amount = amount
      @result = { success: false, message: nil, errors: [] }
    end

    def call
      if @listing.bidder_id == @user.id
        fail("You already have the highest bid.")
        return false
      end

      if @amount < @listing.current_price + @listing.min_bid_increment
        fail("Bid must be at least #{@listing.current_price + @listing.min_bid_increment}")
        return false
      end

      if @user.gold < @amount
        fail("Insufficient funds.")
        return false
      end

      # Perform bid
      # Call place_bid which now handles Bids creation and gold transfer
      if @listing.place_bid(@user, @amount)
        # Check if bid extends auction
        @result[:success] = true
        @result[:message] = "Bid placed successfully!"
        
        # In a real app, broadcast update via ActionCable here
        # Marketplace::BroadcastService.new(@listing).broadcast_update
        
        return true
      else
        fail("Failed to place bid.")
        return false
      end
    rescue ActiveRecord::RecordInvalid => e
      fail(e.message)
      false
    end

    private
    
    def fail(msg)
      @result[:message] = msg
      @result[:errors] << msg
    end
  end
end