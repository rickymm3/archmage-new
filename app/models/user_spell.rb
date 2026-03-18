class UserSpell < ApplicationRecord
  belongs_to :user
  belongs_to :spell
end
