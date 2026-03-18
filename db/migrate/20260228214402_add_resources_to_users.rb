class AddResourcesToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :gold, :integer
    add_column :users, :mana, :integer
  end
end
