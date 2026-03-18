class AddRarityToUnitsAndSpells < ActiveRecord::Migration[8.0]
  def change
    add_column :units, :rarity, :integer, default: 0
    add_column :spells, :rarity, :integer, default: 0
  end
end
