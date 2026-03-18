class AddScoutingToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :scouted_targets, :json
    add_column :users, :last_scouted_at, :datetime
  end
end
