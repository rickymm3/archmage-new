class UserUnit < ApplicationRecord
  belongs_to :user
  belongs_to :unit
  belongs_to :assigned_hero, class_name: 'Unit', foreign_key: 'hero_id', optional: true

  validates :garrison, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :exploring, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validate :allocation_cannot_exceed_quantity
  validate :hero_must_be_owned, if: -> { self.hero_id.present? }
  validates :hero_id, uniqueness: { scope: :user_id, message: "is already leading another unit" }, allow_nil: true

  def available_quantity
    quantity - garrison - (exploring || 0)
  end

  private

  def hero_must_be_owned
    # Ensure the hero exists in user's roster
    unless user.user_units.exists?(unit_id: hero_id, quantity: 1..)
      errors.add(:hero_id, "is not owned or available") 
    end
    
    # Ensure it is actually a hero
    hero = Unit.find_by(id: hero_id)
    if hero && hero.unit_type != 'hero'
      errors.add(:hero_id, "is not a valid hero")
    end
  end

  def allocation_cannot_exceed_quantity
    return unless garrison.present? && quantity.present?
    
    total_allocated = garrison + (exploring || 0)
    if total_allocated > quantity
      errors.add(:base, "Total allocated units (Garrison + Exploring) cannot exceed total quantity")
    end
  end
end
