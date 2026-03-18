class AddManaChargeToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :last_mana_recharge_at, :datetime
  end
end
