class AddExploringToUserUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :user_units, :exploring, :integer, default: 0
  end
end
