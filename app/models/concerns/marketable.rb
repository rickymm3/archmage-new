module Marketable
  extend ActiveSupport::Concern

  included do
    has_many :market_listings, as: :item, dependent: :destroy
    
    enum :rarity, {
      common: 0,
      uncommon: 1,
      rare: 2,
      legendary: 3
    }, default: :common, suffix: true

    # Base price calculation - override in models if needed
    def base_price
      case rarity
      when 'common' then 100
      when 'uncommon' then 500
      when 'rare' then 2500
      when 'legendary' then 10000
      else 100
      end
    end
    
    def rarity_color
      case rarity
      when 'common' then 'light'
      when 'uncommon' then 'success'
      when 'rare' then 'info'
      when 'legendary' then 'warning'
      else 'secondary'
      end
    end
  end
end