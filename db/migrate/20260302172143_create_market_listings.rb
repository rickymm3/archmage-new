class CreateMarketListings < ActiveRecord::Migration[8.0]
  def change
    create_table :market_listings do |t|
      t.references :item, polymorphic: true, null: false
      t.integer :current_price, default: 0
      t.integer :min_bid_increment, default: 50
      t.datetime :expires_at
      t.references :bidder, foreign_key: { to_table: :users }
      t.integer :status, default: 0
      t.integer :quantity, default: 1

      t.timestamps
    end
  end
end
