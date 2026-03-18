class MarketListing < ApplicationRecord
  belongs_to :item, polymorphic: true
  belongs_to :bidder, class_name: "User", optional: true
  has_many :bids, dependent: :destroy

  enum :status, { active: 0, sold: 1, expired: 2, cancelled: 3, collected: 4 }

  scope :active, -> { where(status: :active).where('expires_at > ?', Time.current) }
  scope :won_by, ->(user) { where(status: :sold, bidder: user) }
  
  scope :heroes, -> { 
    where(item_type: 'Unit')
    .joins("INNER JOIN units ON units.id = market_listings.item_id AND market_listings.item_type = 'Unit'")
    .where("units.unit_type = ?", 'hero') 
  }
  
  scope :regular, -> { 
    where.not(id: heroes.select(:id))
  }
  
  validates :current_price, numericality: { greater_than_or_equal_to: 0 }
  validates :quantity, numericality: { greater_than: 0 }

  # Constants
  MAX_LISTINGS = 20
  DEFAULT_DURATION = 4.hours
  BID_EXTENSION = 5.minutes

  def expired?
    expires_at < Time.current
  end

  def place_bid(user, amount)
    return false if expired?
    return false if user.gold < amount
    return false if amount < min_next_bid

    transaction do
      lock!

      # Refund previous bidder immediately
      if bidder
        bidder.increment!(:gold, current_price)
      end

      # Deduct from new bidder immediately
      user.decrement!(:gold, amount)

      # Record the bid
      bids.create!(user: user, amount: amount)

      # Update listing
      self.bidder = user
      self.current_price = amount
      
      # Anti-Sniping: If less than 30 minutes remain, reset the clock to 5 minutes.
      remaining = expires_at - Time.current
      if remaining < 30.minutes
         # Ensure we don't reduce time if it happens to be > 5 mins (unlikely with < 30 condition, but safe)
         self.expires_at = [expires_at, 5.minutes.from_now].max
      end
      
      save!
    end
  end

  def min_next_bid
    return current_price if current_price == 0 
    current_price + min_bid_increment
  end
  
  def resolve_auction!
    return if status != 'active'
    return if expires_at > Time.current
    
    transaction do
      if bidder
        # Mark as sold (awaiting collection)
        update!(status: :sold)
      else
        # No bids
        update!(status: :expired)
      end
    end
  end

  def collect!(user)
    return false unless status == 'sold'
    return false unless bidder == user

    transaction do
      case item_type
      when 'Unit'
        # Add units to user
        user_unit = user.user_units.find_or_create_by(unit: item)
        user_unit.increment!(:quantity, quantity)
      when 'Spell'
        # Learn spell logic
        if user.spells.exists?(item.id)
          # Spell Fizzles - refund the bidder since they can't use it
          Rails.logger.info "User #{user.id} already knows spell #{item.name}. Fizzled — refunding #{current_price} gold."
          user.increment!(:gold, current_price)
        else
          user.user_spells.create!(spell: item, learned: true)
        end
      end
      
      update!(status: :collected)
    end
    true
  end
end