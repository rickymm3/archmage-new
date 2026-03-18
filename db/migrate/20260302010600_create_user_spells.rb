class CreateUserSpells < ActiveRecord::Migration[8.0]
  def change
    create_table :user_spells do |t|
      t.references :user, null: false, foreign_key: true
      t.references :spell, null: false, foreign_key: true
      t.integer :research_progress
      t.boolean :learned
      t.boolean :active

      t.timestamps
    end
  end
end
