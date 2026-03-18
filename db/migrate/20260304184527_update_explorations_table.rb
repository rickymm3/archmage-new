class UpdateExplorationsTable < ActiveRecord::Migration[8.0]
  def change
    # Wipe incompatible data
    execute "DELETE FROM explorations"

    add_reference :explorations, :unit, null: false, foreign_key: true
    add_column :explorations, :quantity, :integer, default: 0
    
    # Add new JSON columns for detailed results
    add_column :explorations, :resources_found, :json, default: {}
    add_column :explorations, :events, :json, default: []
  end
end
