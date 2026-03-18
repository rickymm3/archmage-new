class CreateSpells < ActiveRecord::Migration[8.0]
  def change
    create_table :spells do |t|
      t.string :name
      t.text :description
      t.integer :rank
      t.string :affinity
      t.integer :mana_cost
      t.integer :research_cost
      t.string :spell_type

      t.timestamps
    end
  end
end
