class CreateUserStructures < ActiveRecord::Migration[8.0]
  def change
    create_table :user_structures do |t|
      t.references :user, null: false, foreign_key: true
      t.references :structure, null: false, foreign_key: true
      t.integer :quantity

      t.timestamps
    end
  end
end
