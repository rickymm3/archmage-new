class RankingsController < ApplicationController
  def index
    # Fetch all users with basic associations to calculate power
    # This is an N+1 concern, but acceptable for small player base (Prototype)
    # Ideally, we should cache power in a 'power' or 'score' column.
    
    @rankings = User.all.includes(:user_structures => :structure, :user_units => :unit, :active_spells => :spell)
                    .map do |user|
                      {
                        user: user,
                        power: user.net_power,
                        land: user.land,
                        army_size: user.user_units.sum(:quantity) + user.user_units.sum(:garrison),
                        has_fog: user.active_spells.any? { |as| as.spell.name == "Fog" }
                      }
                    end
                    .sort_by { |r| -r[:power] }
                    .each_with_index.map { |r, i| r.merge(rank: i + 1) }
    
    # Paginate manually if needed, or just show top 50/100
    @rankings = @rankings.first(100)
  end
end
