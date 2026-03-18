class CreateBids < ActiveRecord::Migration[8.0]
  def change
    create_table :bids do |t|
      t.references :user, null: false, foreign_key: true
      t.references :market_listing, null: false, foreign_key: true
      t.integer :amount

      t.timestamps
    end
  end
end
