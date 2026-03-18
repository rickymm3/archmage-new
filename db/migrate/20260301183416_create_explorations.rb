class CreateExplorations < ActiveRecord::Migration[8.0]
  def change
    create_table :explorations do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :started_at
      t.datetime :finishes_at
      t.integer :land_reward
      t.integer :status

      t.timestamps
    end
  end
end
