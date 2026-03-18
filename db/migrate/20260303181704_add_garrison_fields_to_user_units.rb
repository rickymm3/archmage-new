class AddGarrisonFieldsToUserUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :user_units, :garrison, :integer
  end
end
