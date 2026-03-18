class AddAutoReinforceToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :auto_reinforce, :boolean
  end
end
