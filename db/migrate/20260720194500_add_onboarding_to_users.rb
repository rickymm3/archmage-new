class AddOnboardingToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :onboarding_step, :string, null: false, default: "welcome"
    add_column :users, :onboarding_state, :json, null: false, default: {}
    add_column :users, :onboarding_completed_at, :datetime
    add_column :users, :onboarding_skipped_at, :datetime
  end
end
