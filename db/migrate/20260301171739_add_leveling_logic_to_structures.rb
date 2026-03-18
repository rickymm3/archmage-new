class AddLevelingLogicToStructures < ActiveRecord::Migration[8.0]
  def change
    add_column :structures, :level_based, :boolean, default: true
    add_column :structures, :max_level, :integer, default: 10
    add_column :structures, :land_cost, :integer, default: 1
    add_column :structures, :base_income_gold, :integer, default: 0
    add_column :structures, :base_income_mana, :integer, default: 0
    # For now, we assume linear scaling for income and land
    
    # Add index if we want (not strictly necessary for small tables)
  end
end
