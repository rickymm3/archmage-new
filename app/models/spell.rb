class Spell < ApplicationRecord
  include Marketable

  has_many :user_spells, dependent: :destroy
  has_many :users, through: :user_spells
  
  has_many :attack_castings, class_name: "User", foreign_key: "active_attack_spell_id"
  has_many :defense_castings, class_name: "User", foreign_key: "active_defense_spell_id"

  scope :attack_spells, -> { where(spell_type: ['attack', 'enemy']) }
  scope :defense_spells, -> { where(spell_type: ['defense', 'self']) }

  # Spell ids a given user may research within `affinity`. Native (general,
  # or the user's own color) gets the full affinity list; foreign affinities
  # are capped to the first 8 by (rank, name).
  def self.accessible_ids(user, affinity)
    scope = where(affinity: affinity).order(:rank, :name)
    native = affinity == 'general' || affinity == user.color
    native ? scope.pluck(:id) : scope.limit(8).pluck(:id)
  end
end
