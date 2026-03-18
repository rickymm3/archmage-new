class MakeExplorationUnitOptional < ActiveRecord::Migration[8.0]
  def change
    change_column_null :explorations, :unit_id, true
  end
end

