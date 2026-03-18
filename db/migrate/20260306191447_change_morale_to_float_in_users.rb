class ChangeMoraleToFloatInUsers < ActiveRecord::Migration[8.0]
  def change
    change_column :users, :morale, :float, default: 100.0
  end
end
