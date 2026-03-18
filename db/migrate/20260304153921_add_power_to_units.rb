class AddPowerToUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :units, :power, :integer
  end
end
