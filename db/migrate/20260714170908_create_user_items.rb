class CreateUserItems < ActiveRecord::Migration[8.0]
  def change
    create_table :user_items do |t|
      t.references :user, null: false, foreign_key: true
      t.references :item, null: false, foreign_key: true
      t.integer :quantity, default: 0, null: false
      t.boolean :equipped, default: false, null: false

      t.timestamps
    end
    add_index :user_items, [:user_id, :item_id], unique: true
  end
end
