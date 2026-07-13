module Battle
  # Who can you attack? Classic Archmage showed every kingdom within a set
  # range of you on the leaderboard, plus manual targeting by name if the
  # target was inside your allotted power range. This service implements
  # that as a live power-ratio band: anyone between MIN_RATIO and MAX_RATIO
  # of your net power is a legal target.
  class TargetingService
    MIN_RATIO = 0.4
    MAX_RATIO = 2.5

    def initialize(user)
      @user = user
    end

    def self.in_range?(attacker, defender)
      new(attacker).in_range?(defender)
    end

    def range
      my_power = @user.net_power
      { min: (my_power * MIN_RATIO).round, max: (my_power * MAX_RATIO).round }
    end

    def in_range?(target)
      r = range
      p = target.net_power
      p >= r[:min] && p <= r[:max]
    end

    # All kingdoms, ranked by power. Small playerbase: compute live.
    # (Swap for a cached ranking column when the realm grows.)
    def leaderboard
      @leaderboard ||= User.includes(user_structures: :structure, user_units: :unit)
        .to_a
        .map { |u| [u, u.net_power] }
        .sort_by { |_, p| -p }
    end

    def my_rank
      leaderboard.index { |u, _| u.id == @user.id }.to_i + 1
    end

    # Everyone within the strike range, in leaderboard order.
    def targets
      r = range
      leaderboard.filter_map.with_index do |(u, power), idx|
        next if u.id == @user.id
        next unless power >= r[:min] && power <= r[:max]
        serialize(u, power, idx + 1)
      end
    end

    # Manual targeting by name — always returns matches, flagging whether
    # each is attackable and why not otherwise.
    def search(query)
      q = query.to_s.strip
      return [] if q.length < 2

      pattern = "%#{q.downcase}%"
      matches = User.where("LOWER(username) LIKE :q OR LOWER(kingdom_name) LIKE :q", q: pattern).limit(10)
      r = range

      matches.map do |u|
        power = u.net_power
        rank = (leaderboard.index { |lu, _| lu.id == u.id } || -1) + 1
        reason =
          if u.id == @user.id then "That is your own kingdom."
          elsif power < r[:min] then "Too weak — beneath your notice."
          elsif power > r[:max] then "Too powerful — they would crush you."
          elsif u.under_protection? then "Under magical protection."
          end

        serialize(u, power, rank).merge(
          in_range: power >= r[:min] && power <= r[:max] && u.id != @user.id,
          reason: reason
        )
      end
    end

    private

    def serialize(u, power, rank)
      my_power = [@user.net_power, 1].max
      {
        id: u.id,
        username: u.username,
        kingdom_name: u.display_kingdom_name,
        rank: rank,
        net_power: power,
        land: u.land,
        ratio: (power.to_f / my_power).round(2),
        under_protection: u.under_protection?,
        protection_expires_at: u.protection_expires_at
      }
    end
  end
end
