class Item < ApplicationRecord
  include Marketable

  enum :item_type, { weapon: 0, armor: 1, accessory: 2, consumable: 3 }

  has_many :user_items, dependent: :destroy
  has_many :users, through: :user_items

  validates :name, :slug, presence: true
  validates :slug, uniqueness: true

  def equippable?
    !consumable?
  end
end
