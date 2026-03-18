class Spell < ApplicationRecord
  include Marketable

  has_many :user_spells, dependent: :destroy
  has_many :users, through: :user_spells
  
  has_many :attack_castings, class_name: "User", foreign_key: "active_attack_spell_id"
  has_many :defense_castings, class_name: "User", foreign_key: "active_defense_spell_id"

  scope :attack_spells, -> { where(spell_type: ['attack', 'enemy']) }
  scope :defense_spells, -> { where(spell_type: ['defense', 'self']) }
end
