class UserItem < ApplicationRecord
  belongs_to :user
  belongs_to :item

  scope :equipped, -> { where(equipped: true) }

  validates :quantity, numericality: { greater_than_or_equal_to: 0 }
  validate :only_one_equipped_per_slot, if: :equipped?
  validate :consumables_are_never_equipped

  def available_quantity
    quantity
  end

  private

  def only_one_equipped_per_slot
    return unless item&.equippable?

    conflict = user.user_items.joins(:item)
                   .where(equipped: true, items: { item_type: item.item_type })
                   .where.not(id: id)
    errors.add(:equipped, "already have an item equipped in this slot") if conflict.exists?
  end

  def consumables_are_never_equipped
    errors.add(:equipped, "consumables cannot be equipped") if equipped? && item&.consumable?
  end
end
