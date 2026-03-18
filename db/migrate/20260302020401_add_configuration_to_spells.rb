class AddConfigurationToSpells < ActiveRecord::Migration[8.0]
  def change
    add_column :spells, :configuration, :json
  end
end
