class AddMoraleUpdatedAtToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :morale_updated_at, :datetime
  end
end
