class AddUsernameToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :username, :string
    add_index :users, :username

    User.reset_column_information
    User.find_each do |user|
      user.update!(username: user.email_address.split('@').first)
    end
  end
end
