class AddLevelToUserStructures < ActiveRecord::Migration[8.0]
  def change
    add_column :user_structures, :level, :integer, default: 1
    
    # Ensure all existing structures have at least level 1
    # This might be redundant with default: 1 on add_column for new rows, 
    # but good for ensuring clarity
  end
end
