class AddCombatSpellsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :active_attack_spell_id, :integer
    add_column :users, :active_defense_spell_id, :integer
  end
end
