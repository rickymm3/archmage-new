class Structure < ApplicationRecord
  has_many :user_structures
  has_many :users, through: :user_structures

  # Scopes
  scope :level_based, -> { where(level_based: true) }
  scope :quantity_based, -> { where(level_based: false) }

  # Constants
  DEFAULT_MAX_LEVEL = 10

  # Escalating land cost per upgrade level for core (level-based) structures.
  # Index = current_level (cost to go FROM that level to the next).
  # Level 1 is free (granted at registration), so index 0 is unused.
  LEVEL_LAND_COSTS = [0, 4, 5, 6, 6, 6, 6, 7, 9, 11].freeze

  def land_cost_for_upgrade(current_level)
    return land_cost unless level_based?
    LEVEL_LAND_COSTS[current_level] || 0
  end

  def cumulative_land_cost(level)
    return 0 unless level_based?
    (1...level).sum { |l| LEVEL_LAND_COSTS[l] || 0 }
  end

  def production_at_level(current_level)
    base = self.production || {}
    base.transform_values { |v| (v.to_f * current_level).to_i }
  end

  def resource_cost(current_level)
    base_reqs = requirements
    mult = level_based ? [current_level, 1].max : 1
    base_reqs.transform_values { |v| (v.to_i * mult).to_i }
  end
end
