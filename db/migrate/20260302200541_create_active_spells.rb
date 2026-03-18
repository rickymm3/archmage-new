class CreateActiveSpells < ActiveRecord::Migration[8.0]
  def change
    create_table :active_spells do |t|
      t.references :user, null: false, foreign_key: true
      t.references :spell, null: false, foreign_key: true
      t.datetime :expires_at
      t.integer :stack_count
      t.json :metadata

      t.timestamps
    end
  end
end
