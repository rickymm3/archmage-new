class AddTreasuryFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :tax_cooldown, :datetime
    add_column :users, :morale, :integer
  end
end
