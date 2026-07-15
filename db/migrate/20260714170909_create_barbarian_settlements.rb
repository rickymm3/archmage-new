class CreateBarbarianSettlements < ActiveRecord::Migration[8.0]
  def change
    create_table :barbarian_settlements do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :element, default: "physical", null: false
      t.integer :min_level, null: false
      t.integer :max_level, null: false
      t.integer :level, null: false
      t.datetime :defeated_at
      t.datetime :respawn_at

      t.timestamps
    end
    add_index :barbarian_settlements, :slug, unique: true
  end
end
