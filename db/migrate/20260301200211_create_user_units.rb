class CreateUserUnits < ActiveRecord::Migration[8.0]
  def change
    create_table :user_units do |t|
      t.references :user, null: false, foreign_key: true
      t.references :unit, null: false, foreign_key: true
      t.integer :quantity

      t.timestamps
    end
  end
end
