class ActiveSpell < ApplicationRecord
  belongs_to :user
  belongs_to :spell

  scope :active, -> { where('expires_at > ?', Time.current) }
  
  def expired?
    expires_at < Time.current
  end
  
  def duration_remaining
    [expires_at - Time.current, 0].max
  end
end
