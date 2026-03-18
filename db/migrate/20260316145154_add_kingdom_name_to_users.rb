class AddKingdomNameToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :kingdom_name, :string, limit: 15
    add_index :users, :kingdom_name, unique: true
  end
end
