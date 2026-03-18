class AddGameAttributesToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :color, :string
    add_column :users, :land, :integer, default: 10, null: false
    add_column :users, :protection_expires_at, :datetime
    
    # Add index for faster queries on color (faction based queries)
    add_index :users, :color
  end
end
