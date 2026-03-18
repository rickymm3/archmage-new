class AddHeroIdToUserUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :user_units, :hero_id, :integer
    add_index :user_units, :hero_id
  end
end
