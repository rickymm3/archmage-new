class AddCostResourceToSpells < ActiveRecord::Migration[8.0]
  def change
    add_column :spells, :cost_resource, :string, default: "mana", null: false
  end
end
