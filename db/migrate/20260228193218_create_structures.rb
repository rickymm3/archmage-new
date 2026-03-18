class CreateStructures < ActiveRecord::Migration[8.0]
  def change
    create_table :structures do |t|
      t.string :name
      t.string :slug
      t.text :description
      t.json :requirements

      t.timestamps
    end
  end
end
