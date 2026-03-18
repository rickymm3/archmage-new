class ChangeGarrisonDefaultInUserUnits < ActiveRecord::Migration[8.0]
  def change
    change_column_default :user_units, :garrison, 0
    # Update existing records to 0 where garrison is null
    UserUnit.where(garrison: nil).update_all(garrison: 0)
    
    change_column_default :users, :auto_reinforce, false
    # Update existing records to false where auto_reinforce is null
    User.where(auto_reinforce: nil).update_all(auto_reinforce: false)
  end
end
