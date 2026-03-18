class Notification < ApplicationRecord
  belongs_to :user
  
  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc) }
  
  # Ensure category is present, default to system
  after_initialize :set_defaults
  
  def read?
    read_at.present?
  end

  def mark_as_read!
    update(read_at: Time.current)
  end
  
  def self.mark_all_read!(user)
    user.notifications.unread.update_all(read_at: Time.current)
  end
  
  private
  
  def set_defaults
    self.category ||= 'system'
    self.data ||= {}
  end
end
