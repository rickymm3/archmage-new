module Api
  module V1
    class MarketplaceController < BaseController
      def index
        Marketplace::GeneratorService.maintain_market_size

        filter = params[:filter] || "regular"
        base_scope = MarketListing.active.includes(:item, :bidder).order(:expires_at)

        listings = case filter
        when "heroes"
          base_scope.heroes
        else
          base_scope.regular
        end

        won_listings = MarketListing.won_by(current_user).includes(:item)

        render json: {
          listings: listings.map { |l| serialize_listing(l) },
          won_listings: won_listings.map { |l| serialize_listing(l) },
          filter: filter,
          gold: current_user.gold
        }
      end

      def bid
        listing = MarketListing.find(params[:id])
        amount = params[:amount].to_i

        service = Marketplace::BidService.new(current_user, listing.id, amount)

        if service.call
          render json: {
            message: "Bid placed successfully!",
            listing: serialize_listing(listing.reload),
            gold: current_user.reload.gold
          }
        else
          render json: { error: service.result[:message] }, status: :unprocessable_entity
        end
      end

      def collect
        listing = MarketListing.find(params[:id])

        if listing.collect!(current_user)
          render json: { message: "Item collected successfully!" }
        else
          render json: { error: "Could not collect item" }, status: :unprocessable_entity
        end
      end

      private

      def serialize_listing(listing)
        {
          id: listing.id,
          item_type: listing.item_type,
          item_id: listing.item_id,
          item: serialize_item(listing.item),
          current_price: listing.current_price,
          min_next_bid: listing.min_next_bid,
          expires_at: listing.expires_at,
          status: listing.status,
          quantity: listing.quantity,
          bidder: listing.bidder ? { id: listing.bidder.id, username: listing.bidder.username, kingdom_name: listing.bidder.display_kingdom_name } : nil
        }
      end

      def serialize_item(item)
        return nil unless item
        base = { id: item.id, name: item.name }
        if item.is_a?(Unit)
          base.merge(
            unit_type: item.unit_type,
            attack: item.attack,
            defense: item.defense,
            speed: item.speed
          )
        elsif item.is_a?(Spell)
          base.merge(
            spell_type: item.spell_type,
            affinity: item.affinity,
            rank: item.rank,
            mana_cost: item.mana_cost
          )
        else
          base
        end
      end
    end
  end
end
