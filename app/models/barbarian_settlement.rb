class BarbarianSettlement < ApplicationRecord
  COOLDOWN_BASE_MINUTES = 60
  COOLDOWN_PER_LEVEL_MINUTES = 10

  # Mirrors Explorations::ProcessService's tc_power_table idiom — indexed by level.
  LEVEL_POWER_TABLE = [0, 40, 90, 160, 260, 400, 600, 900, 1300, 1850, 2600].freeze

  validates :name, :slug, presence: true
  validates :slug, uniqueness: true
  validates :level, :min_level, :max_level, numericality: { greater_than: 0 }

  def on_cooldown?
    respawn_at.present? && respawn_at > Time.current
  end

  # Lazy respawn: call before reading/attacking, same idiom as User#under_protection?.
  def respawn_if_ready!
    return unless respawn_at.present? && respawn_at <= Time.current

    update!(level: rand(min_level..max_level), respawn_at: nil, defeated_at: nil)
  end

  def mark_defeated!
    cooldown = COOLDOWN_BASE_MINUTES + (level * COOLDOWN_PER_LEVEL_MINUTES)
    update!(defeated_at: Time.current, respawn_at: cooldown.minutes.from_now)
  end

  def power_target
    LEVEL_POWER_TABLE[level] || LEVEL_POWER_TABLE.last
  end

  # Mirrors Marketplace::GeneratorService::RARITY_WEIGHTS shape, skewed by level.
  def rarity_weights
    {
      common: [65 - level * 5, 10].max,
      uncommon: 25 + level,
      rare: 8 + level * 3,
      legendary: 2 + level * 2
    }
  end
end
