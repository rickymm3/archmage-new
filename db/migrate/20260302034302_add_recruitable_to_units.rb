class AddRecruitableToUnits < ActiveRecord::Migration[8.0]
  def change
    add_column :units, :recruitable, :boolean, default: true
  end
end
