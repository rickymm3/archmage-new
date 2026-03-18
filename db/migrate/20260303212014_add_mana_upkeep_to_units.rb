class AddManaUpkeepToUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :units, :mana_upkeep, :integer
  end
end
