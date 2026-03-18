class AddBattleStatsToUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :units, :unit_type, :string
    add_column :units, :element, :string
    add_column :units, :speed, :integer
    add_index :units, :speed
    add_column :units, :abilities, :json
  end
end
