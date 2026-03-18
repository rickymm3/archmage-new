class CreateUnits < ActiveRecord::Migration[8.0]
  def change
    create_table :units do |t|
      t.string :name
      t.string :slug
      t.text :description
      t.json :requirements
      t.integer :upkeep_cost
      t.integer :attack
      t.integer :defense

      t.timestamps
    end
  end
end
