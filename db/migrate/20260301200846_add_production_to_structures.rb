class AddProductionToStructures < ActiveRecord::Migration[8.0]
  def change
    add_column :structures, :production, :json
  end
end
