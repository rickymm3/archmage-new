module Marketplace
  class GeneratorService
    RARITY_WEIGHTS = {
      common: 50,
      uncommon: 30,
      rare: 15,
      legendary: 5
    }

    MAX_REGULAR_LISTINGS = 20
    MAX_HERO_LISTINGS = 5

    def self.generate_listings(count = 1, force_hero: false)
      count.times do
        if force_hero
          generate_single_hero_listing
        else
          generate_single_listing
        end
      end
    end

    def self.maintain_market_size
      # Resolve any expired auctions first
      MarketListing.where(status: :active).where('expires_at <= ?', Time.current).find_each do |listing|
        listing.resolve_auction!
      end

      # Regular listings
      current_regular = MarketListing.active.regular.count
      needed_regular = MAX_REGULAR_LISTINGS - current_regular
      if needed_regular > 0
        generate_listings(needed_regular, force_hero: false)
      end

      # Hero listings
      current_heroes = MarketListing.active.heroes.count
      needed_heroes = MAX_HERO_LISTINGS - current_heroes
      if needed_heroes > 0
        generate_listings(needed_heroes, force_hero: true)
      end
    end
    
    def self.generate_single_hero_listing
       hero = Unit.where(unit_type: 'hero').sample
       return unless hero
       
       # Heroes are expensive
       base_price = hero.power * 50 # adjust multiplier as needed
       price_variance = rand(0.9..1.5)
       starting_price = (base_price * price_variance).to_i
       
       MarketListing.create!(
        item: hero,
        quantity: 1,
        current_price: starting_price,
        min_bid_increment: [starting_price / 20, 100].max,
        expires_at: rand(12..48).hours.from_now,
        status: :active
      )
    end

    def self.generate_single_listing
      rarity = pick_rarity
      type = pick_type
      
      # Find potential items
      items = type.where(rarity: rarity)
      
      # Fallback if no items of that rarity exist
      if items.empty?
        items = type.all
        return if items.empty? # No items at all in DB
      end
      
      # Ensure we don't pick a hero for regular listings, if type is Unit
      if type == Unit
         candidate_items = items.where.not(unit_type: 'hero')
         # If filtering removed everything (e.g. only heroes exist at rarity), fallback to others
         if candidate_items.empty?
            candidate_items = Unit.where.not(unit_type: 'hero')
         end
         items = candidate_items
         return if items.empty?
      end
      
      item = items.sample
      
      # Determine quantity and price
      quantity = 1
      if type == Unit
        # Common units appear in bulk
        case rarity
        when :common then quantity = rand(50..200)
        when :uncommon then quantity = rand(20..50)
        when :rare then quantity = rand(5..10)
        when :legendary then quantity = rand(1..5)
        end
      end

      # Calculate base price
      base_price = item.base_price * quantity
      # Add some variance (+/- 20%)
      price_variance = rand(0.8..1.2)
      starting_price = (base_price * price_variance).to_i

      MarketListing.create!(
        item: item,
        quantity: quantity,
        current_price: starting_price,
        min_bid_increment: [starting_price / 10, 1].max,
        expires_at: rand(4..24).hours.from_now,
        status: :active
      )
    end

    private

    def self.pick_rarity
      total_weight = RARITY_WEIGHTS.values.sum
      roll = rand(total_weight)
      
      current_weight = 0
      RARITY_WEIGHTS.each do |rarity, weight|
        current_weight += weight
        return rarity if roll < current_weight
      end
      
      :common # Fallback
    end

    def self.pick_type
      # 50/50 split for now between Unit and Spell
      [Unit, Spell].sample
    end
  end
end