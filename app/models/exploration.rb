class Exploration < ApplicationRecord
  belongs_to :user
  belongs_to :unit, optional: true

  enum :status, { active: 0, completed: 1, claimed: 2, failed: 3 }

  validates :quantity, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :finishes_at, presence: true

  # Scope for current active exploration
  scope :active, -> { where(status: :active) }
  scope :completed, -> { where(status: :completed) }
  scope :claimed, -> { where(status: :claimed) }
end
