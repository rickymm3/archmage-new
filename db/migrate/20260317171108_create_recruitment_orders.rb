class CreateRecruitmentOrders < ActiveRecord::Migration[8.0]
  def change
    create_table :recruitment_orders do |t|
      t.references :user, null: false, foreign_key: true
      t.references :unit, null: false, foreign_key: true
      t.string :tier, null: false
      t.integer :gold_invested, null: false
      t.integer :total_quantity, null: false
      t.integer :accepted_quantity, null: false, default: 0
      t.integer :duration_seconds, null: false
      t.datetime :started_at, null: false
      t.datetime :cancelled_at
      t.datetime :completed_at
      t.string :luck
      t.timestamps
    end

    add_index :recruitment_orders, [:user_id, :completed_at]
  end
end
