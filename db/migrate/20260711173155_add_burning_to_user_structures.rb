class AddBurningToUserStructures < ActiveRecord::Migration[8.0]
  def change
    add_column :user_structures, :burning, :boolean, default: false, null: false
    add_column :user_structures, :damage_info, :json
  end
end
