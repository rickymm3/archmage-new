class CreateItems < ActiveRecord::Migration[8.0]
  def change
    create_table :items do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.integer :item_type, default: 0, null: false
      t.integer :rarity, default: 0, null: false
      t.json :abilities
      t.json :use_effect

      t.timestamps
    end
    add_index :items, :slug, unique: true
    add_index :items, :item_type
  end
end
