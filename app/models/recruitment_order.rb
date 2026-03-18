class RecruitmentOrder < ApplicationRecord
  belongs_to :user
  belongs_to :unit

  validates :tier, presence: true
  validates :gold_invested, numericality: { greater_than: 0 }
  validates :total_quantity, numericality: { greater_than: 0 }
  validates :duration_seconds, numericality: { greater_than: 0 }
  validates :started_at, presence: true

  scope :active, -> { where(completed_at: nil, cancelled_at: nil) }
  scope :finished, -> { where.not(completed_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  def elapsed_fraction
    elapsed = Time.current - started_at
    [elapsed.to_f / duration_seconds, 1.0].min
  end

  def arrived_quantity
    (total_quantity * elapsed_fraction).floor
  end

  def available_to_accept
    [arrived_quantity - accepted_quantity, 0].max
  end

  def fully_arrived?
    elapsed_fraction >= 1.0
  end

  def progress_percent
    (elapsed_fraction * 100).round
  end

  def estimated_completion
    started_at + duration_seconds.seconds
  end

  def next_unit_at
    arrived = arrived_quantity
    return nil if arrived >= total_quantity

    started_at + (duration_seconds * (arrived + 1).to_f / total_quantity).seconds
  end

  def active?
    completed_at.nil? && cancelled_at.nil?
  end

  def status_label
    if cancelled_at.present?
      "cancelled"
    elsif completed_at.present?
      "completed"
    else
      "active"
    end
  end
end
