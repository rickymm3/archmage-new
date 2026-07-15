class AddRolledAtToUserSpells < ActiveRecord::Migration[8.0]
  def change
    add_column :user_spells, :rolled_at, :datetime
  end
end
